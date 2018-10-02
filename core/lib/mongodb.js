"use strinct";

const mongoose = require('mongoose');
const config = require("config" ).get("mongo");
const debug = require('debug')('eye:lib:mongodb');
const format = require('util').format;

function connect () {
  var connection;
  if (!config) throw new Error('no mongo db connection provided!');
  if (config.user && config.password) {
    connection = format(
      'mongodb://%s:%s@%s/%s',
      encodeURIComponent(config.user),
      encodeURIComponent(config.password),
      config.hosts,
      config.database
    );
  } else {
    connection = format(
      'mongodb://%s/%s',
      config.hosts,
      config.database
    );
  }

  if (config.replicaSet) {
    connection += `?replicaSet=${config.replicaSet}`
  }

  if (config.debug) {
    mongoose.set("debug", true)
  }

  return mongoose.createConnection(connection, (config.options||{}))
}

function Connection () {
  var _db ;

  this.connect = function (done) {
    if (_db) return done() // already connected

    _db = connect();

    _db.on('error', function (err) {
      debug('MongoDB error encountered', err);
      process.kill(process.pid);
    });

    _db.once('close', function () {
      debug('MongoDB closed the connection');
      process.kill(process.pid);
    });

    _db.once('connected', function () {
      debug('MongoDB connected');
      done();
    });
  }

  this.disconnect = function (done) {
    _db.close()
  }

  Object.defineProperty(this, 'db', {
    get: function() { return _db; }
  });

  // return this just for the name.
  Object.defineProperty(this, 'connection', {
    get: function() { return _db; }
  });
}

module.exports = new Connection();
