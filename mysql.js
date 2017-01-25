const mysql = require('mysql');

module.exports = class Mysql {
	
	constructor(server, device, parameters) {

		this.device = device;
		this.server = server;

		this.staging = {};
		this.staging.stale = this.device.values.length;
		this.staging.data = {};

		// the time to wait for other parameters to report their value
		this.waitTime = 5000;
		this.countdown = null;

		this.connect(parameters);

		if (this.connection) {
			this.startObservers();

			server.info("MySQL application initialized for device " + this.device.name + "@" + parameters.host);
		}
	}

	startObservers() {

		const deviceQuery = this.server.from('*').where({name:this.device.name});

		const self = this;

		this.server.observe([deviceQuery], function(dev) {

			const innerDev = dev;
			self.device.values.forEach(function(value) {

			    //If a monitored value changes it is inserted into the staging area
			    innerDev.streams[value].on('data', function(message) {
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

		// store to db table
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

		this.connection.query(sql, function(err, result) {
			if (err) {
				self.server.error("MySQL " + err + " -> " + sql);
			}
		});
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
	}

}
