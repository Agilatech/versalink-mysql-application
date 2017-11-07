const mysql = require('mysql');

module.exports = class Mysql {
	
	constructor(server, device, parameters) {

		this.device = device;
		this.server = server;

		this.staging = {};
		this.staging.stale = this.device.values.length;
		this.staging.data = {};

		// the time to wait for other parameters to report their value
		this.waitTime = (typeof device['insertDelay'] != 'undefined') ? device['insertDelay'] : 5000;
    
		this.countdown = null;

		this.connect(parameters);

		if (this.connection) {
			this.startObservers();

			server.info("MySQL application initialized for device " + this.device.name + "@" + parameters.host);
		}
	}

	startObservers() {

		// Hmmm, seems that the wildcard .from('*') is not a really a wildcard from 
		// the perspective of the local server.  So if we want to find devices on a
		// remote peer AND this local server, then we have to have two queries.

		const peersDeviceQuery = this.server.from('*').where({name:this.device.name});
		const localDeviceQuery  = this.server.where({name:this.device.name});

		const self = this;

		// Once we have two queries, we can either set up two observers as we've done
		// here, or maybe use Reactive-Extensions RxJS to merge the two observations

		this.server.observe([localDeviceQuery], function(dev) {

			self.device.values.forEach(function(value) {

			  //If a monitored value changes it is inserted into the staging area
			  dev.streams[value].on('data', function(message) {
			    self.stage(value, message.timestamp, message.data);
			  });
  		});
  	});

  	this.server.observe([peersDeviceQuery], function(dev) {

			self.device.values.forEach(function(value) {

				//If a monitored value changes it is inserted into the staging area
				dev.streams[value].on('data', function(message) {
			  	self.stage(value, message.timestamp, message.data);
				});
  		});
  	});

	}

	stage(label, timestamp, value) {

		this.staging.timestamp = timestamp;

		this.staging.data[label] = value;

		this.staging.stale--;

		// if there are no stale values, save right away
		if (!this.staging.stale) {
			this.saveToTable();
		}
		// else there are some stale values, so wait (a little while) for these values to be updated
		else {
			if (!this.countdown) {
				this.countdown = setTimeout((this.saveToTable).bind(this), this.waitTime);
			}
		}
	}
	
	saveToTable() {

		// clear the countdown timer (yes, fairly obvious)
		clearTimeout(this.countdown);
		this.countdown = null;

		// reset the stale counter 
		this.staging.stale = this.device.values.length;

		const self = this;

		var sql = null;

		if (this.device.storeType === 'update') {
			sql = this.sqlUpdate();
		}
		else {
			sql = this.sqlInsert();
		}

		this.connection.query(sql, function(err, result) {
			if (err) {
				self.server.error("MySQL " + err + " -> " + sql);
			}
		});
	}

	sqlInsert() {

		const self = this;

		var sql = "INSERT INTO " + this.device.table + " (devicetime";

		this.device.columns.forEach(function(col) {
			sql += ", " + col;
		});

		sql += ") VALUES (" + this.staging.timestamp;

		this.device.values.forEach(function(name, index) {
			if (self.staging.data[name] === undefined) {
				self.staging.data[name] = 'NULL';
			}

			sql += ", " + self.staging.data[name];
		});

		sql += ");";

		return sql;
	}

	sqlUpdate() {

		const self = this;

		var sql = "UPDATE " + this.device.table + " SET devicetime = " + this.staging.timestamp;

		this.device.columns.forEach(function(col, index) {
			if (typeof self.staging.data[self.device.values[index]] != 'undefined') {
				sql += ", " + col + " = " + self.staging.data[self.device.values[index]];
			}
		});

		sql += ";";

		return sql;

	}

	connect(params) {
		this.connection = mysql.createConnection({
			host : params.host,
			user : params.user,
			password : params.password,
			database : this.device.database
		});

		var self = this;

		this.connection.connect(function(err) {
			if (err) {
				self.server.error("MySQL connection error: " + err.stack);
				self.connection = null;
			}
		});

		this.connection.on('error', function(err) {
			if (err.code == 'PROTOCOL_CONNECTION_LOST') {
				self.server.warn('MySQL disconnected... reconnecting');
			}
			else {
				self.server.error('MySQL disconnected on Unhandled error.  Attempting reconnect...');
			}
			self.connection.end();
			self.connect(params);
		});
	}

}
