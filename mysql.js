const mysql = require('mysql');

module.exports = class Mysql {
	
	constructor(server, device, parameters) {

		this.server = server;
		this.device = device;
		this.parameters = parameters;
		this.parameters['database'] = this.device.database;

		this.connection = null;
		this.countdown = null;

		this.staging = {};
		this.staging.stale = this.device.values.length;
		this.staging.data = {};

		// the time to wait for other parameters to report their value
		this.waitTime = (typeof device['insertDelay'] != 'undefined') ? device['insertDelay'] : 5000;

		this.connect();

		if (this.connection) {
			this.startObservers();

			server.info("MySQL application initialized for device " + this.device.name + "@" + parameters.host);
		}
	}

	startObservers() {
		// Devices can be queried from the local server by omitting the 'from' clause.
		// Devices from a peer server require the 'from' clause, which can be a wildcard *
		// to select from all connected peers.  The wildcard * does NOT match the local server.

		const peersDeviceQuery = this.server.from('*').where({name:this.device.name});
		const localDeviceQuery  = this.server.where({name:this.device.name});

		// Once we have two queries, we can either set up two observers as we've done
		// here, or maybe use Reactive-Extensions RxJS to merge the two observations

		this.server.observe([localDeviceQuery], (dev) => {

			this.device.values.forEach((value) => {

				if (dev.streams[value] == undefined) {  // or null
					this.server.warn(`${value} not defined for ${this.device.name} on this server`);
				}
				else {
			  // When data for this value is published, it is inserted into the staging area
				  dev.streams[value].on('data', (message) => {
				    this.stage(value, message.timestamp, message.data);
				  });
				}
  		});
  	});

		// The server.observe takes the query and executes the callback if and when the query succeeds.
		// The parameter of the callback is the object matching the query, in this case the device
		// named 'this.device.name' on any peer.
  	this.server.observe([peersDeviceQuery], (dev) => {

  		// Now we go through each value for this device object as defined in the config file, and
  		// set up a subscriber for its data.
			this.device.values.forEach((value) => {

				if (dev.streams[value] == undefined) {  // or null
					this.server.warn(`${value} not defined for ${this.device.name} on peer server`);
				}
				else {
					// When and how data for a particular value is published is dependent on the device itself
					dev.streams[value].on('data', (message) => {
				  	this.stage(value, message.timestamp, message.data);
					});
				}
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

		var sql = null;

		if (this.device.storeType === 'update') {
			sql = this.sqlUpdate();
		}
		else {
			sql = this.sqlInsert();
		}

		if (this.connection == undefined) {  // or null
			// try to reconnect
			this.connect();
		}
		else {
			this.connection.query(sql, (err, result) => {
				if (err) {
					this.server.error("MySQL " + err + " -> " + sql);
				}
			});
		}
	}

	sqlInsert() {

		var sql = "INSERT INTO " + this.device.table + " (devicetime";

		this.device.columns.forEach((col) => {
			sql += ", " + col;
		});

		sql += ") VALUES (" + this.staging.timestamp;

		this.device.values.forEach((name, index) => {
			if (this.staging.data[name] === undefined) {
				this.staging.data[name] = 'NULL';
			}

			sql += ", " + this.staging.data[name];
		});

		sql += ");";

		return sql;
	}

	sqlUpdate() {

		var sql = "UPDATE " + this.device.table + " SET devicetime = " + this.staging.timestamp;

		this.device.columns.forEach((col, index) => {
			if (typeof this.staging.data[this.device.values[index]] != 'undefined') {
				sql += ", " + col + " = " + this.staging.data[this.device.values[index]];
			}
		});

		sql += ";";

		return sql;

	}

	connect() {

		try {
			this.connection = mysql.createConnection(this.parameters);
		}
		catch (e) {
			this.server.error("MySQL connection creation error: " + e.message);
		}

		this.connection.connect((err) => {
			if (err) {
				this.server.error("MySQL connection error: " + err);
				this.connection = null;
			}
		});

		this.connection.on('error', (err) => {
			if (err.code == 'PROTOCOL_CONNECTION_LOST') {
				this.server.warn('MySQL disconnected... reconnecting');
			}
			else {
				this.server.error('MySQL disconnected on Unhandled error.  Attempting reconnect...');
			}
			this.connection.end();
			this.connect();  // could put a wait time in here be trying to connect again
		});
	}

}
