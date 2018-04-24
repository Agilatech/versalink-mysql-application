## VersaLink MySQL Application

This application is specifically designed to be used with the Agilatech® VersaLink IoT Platform.
Please visit [agilatech.com](https://agilatech.com/software) to download a copy of the system. 

### Installation
```
$> npm install @agilatech/versalink-mysql-application
```
Install in the same directory in which VersaLink is installed.

### Design

This application is designed to query devices for their values, and insert values to a MySQL database. Devices may exist on the local server, or on any connected peer server. Device values may be either monitored properties or streams.  When a new value is published by the device, the value is inserted or updated.

While this application can be used as-is in a production system, for the most part it was designed to be demonstation code from which a production application could be developed. Your needs and database design will most likely differ, which will require some changes to the code.

This application is meant to be as generic and reusuable as possible, with most details controlled by the config file. Devices specify their table, values to be stored, and associated columns. Different devices may even use different databases. Local and remote connections may be configured.

The code is 100% Javascript, and is meant to be a simple example of a VersaLink application which can be used as a starting place for any other type of VersaLink app.

### Usage
This application is designed to be consumed by the Agilatech® VersaLink IoT system.  As such, it is not really applicable or useful in other environments.

To us it with VersaLink, insert its object definition as an element in the apps array in the _applist.json_ file.
```
{
  "apps":[
    {
      "name":"mysql",
      "module":"@agilatech/versalink-mysql-application"
    }
  ]
}
```


### Configuration
In the _config.json_ file is where the devices storage is defined, as well as the database connections. This file lives alongisde the code in node_modules/@agilatech/versalink-mysql-application in the VersaLink directory. The file is formatted as JSON, and must conform to JSON syntax and rules.

There are two main compontents, "devices" and "connections", and each is an array of objects. Each device for which storage is desired has an object entry in the "devices" array, and each database connection has an object entry in the "connections" array.

#### *devices* object element
A device object has seven possible definitions, given as key:value pairs:
1. **name** : The name of the device. This is the name used in the query, so it must be correct.  If a device cannot be found by name, then it is simply assumed to not exist, and will be ignored.
2. **database** : The name of the database in which the storage table will be found. The database must already exist.
3. **table** : The name of the table in which to store values. The table must also already exist.
4. **insertDelay** : This is the time in milliseconds to wait for other device values to appear before DB insertion. See below for further explanation.
5. **values** : An array of device values to store. Monitored values are simple the name of the property, while streaming values are the name of the property followed by '_stream'.
6. **columns** : An array of table columns in which to store the associated values.  NOTE: the value array index will be stored in the corresponding column array index. If values is defined as ["temperature", "humidity"] and columns is defined as ["humidity", "termperature"], then the device temperature will be stored in the table's humidity column (and likewise for the device humidity value).
7. **storeType** : Optional parameter, one of _insert_ or _update_. Specify 'update' to overwrite a single row over and over. Defualts to 'insert'.

#### insertDelay explained
The _insertDelay_ parameter grew out of a desire to insert multiple values from a sensor into one record. A sensor which reports multiple values may not report them all at the exact same time, so the app waits around for _insertDelay_ milliseconds to see if other values can be combined in a DB insert. Better to insert new values for 3 parameters in one row, rather than have three new rows separated by a few milliseconds time.


#### *connections* object element
A connection object contains the parameters needed for the mysql createConnection method.  At a minimum, these should be:
1. **host** : The domain name or ip address of the host running the mysqld server. localhost is commonly used for the local server.
2. **user** : The username for the mysql database.  This user must already exist, and be granted update and insert privileges.
3. **password** : The password for the user, unless the database is not password protected, which is a bad idea.

Any parameter defined by key:value in the connection object will be passed to the connection handler of the mysql driver. There are some 22 options, most of which are likely not relevant to this app, but some optional ones which may be useful are:

* **socketPath** : If the database you employ does not store the socket file in the standard /tmp/mysql.sock location, this path can be specified here. For example, some MariaDB installations use '/var/run/mariadb/mysqld.sock'.
* **connectTimeout** : Milliseconds before a timeout occurs during the initial connection to the MySQL server. (Defaults to 10000)
* **ssl** : Object with ssl parameters or a string containing name of ssl profile.


### Operation
The very first thing the app does is connect to every __database__ defined in the connections configuration.  Then, as coded, the app sets up two observers--one for the local server and one for any and all connected peers. It first queries the server for the device matching the __name__, and then uses the result of that query for the observers. The observer subscribes to the data feed from the device on all the __values__ given in the configuration.  Upon arrival of data, the value is staged, and will wait __insertDelay__ milliseconds for other values to arrive before storing in the __table__ using the corresponding __columns__.

In addition to storing values into their associated columns, the app also stores a __devicetime__ timestamp, which is the UNIX epoch including milliseconds.


### Database expectations
The app does not create any database structure, which includes the database and the table--these must exist in advance.

The table named by the table parameter in the devices object should at a minimum contain all the columns specified as well as a column named 'devicetime' to hold a int 13 digits long. It's good practice to use an auto-incremented index as the primary key, and we also like to include an 'arrival' timestamp, which shows the time the DB insert occurred.  

The table creation statement we use for the mock device is:
```
CREATE TABLE `mock` (
  `idx` int(11) NOT NULL AUTO_INCREMENT,,
  `arrival` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `devicetime` bigint(14) NOT NULL,
  `value` float DEFAULT NULL,
  PRIMARY KEY (`idx`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
```


### Dependencies
* mysql driver for node.js - refer to the [README](https://www.npmjs.com/package/mysql?activeTab=readme) of this module for connection options, error message, and general operation.


### Compatibility
This driver is designed to run within the VersaLink IoT platform.  While VersaLink will run on nearly any operating system, this driver employs UNIX-specific protocols and as such will run on the following operating systems:
* 32 or 64-bit Linux
* macOS and OS X
* SunOS
* AIX


### Copyright
Copyright © 2018 [Agilatech®](https://agilatech.com). All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


