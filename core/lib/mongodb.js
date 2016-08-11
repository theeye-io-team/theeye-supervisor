var mongoose = require('mongoose');
var config = require("config" ).get("mongo");
var debug = require('debug')('eye:supervisor:lib:mongodb');
var format = require('util').format;

var Connect = function () {
	var connection;
	if(config.user && config.password) {
		connection = format(
			'mongodb://%s:%s@%s/%s',
			config.user,
			config.password,
			config.hosts,
			config.database
		);
	}else{
		connection = format(
			'mongodb://%s/%s',
			config.hosts,
			config.database
		);
	}

	this.db = mongoose.createConnection(connection);
	this.db.on('error', function (err) {
		debug('MongoDB error encountered', err);
		process.kill(process.pid);
	});
	this.db.once('close', function () {
		debug('MongoDB closed the connection');
		process.kill(process.pid);
	});
	this.db.once('connected', function () {
		debug('MongoDB connected');
	});
}

module.exports = new Connect();
