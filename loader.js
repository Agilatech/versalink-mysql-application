module.exports = function(server) {
  
  const config = require('./config');
  const mysql = require('./mysql');

  var sqlDevice = {};

  config.devices.forEach(function(device) {
  	config.connections.forEach(function(connection) {
  		sqlDevice[device.name] = new mysql(server, device, connection);
  	});
    
  });
  
}
