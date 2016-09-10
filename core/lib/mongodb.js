var mongoose = require('mongoose');
var config = require("config" ).get("mongo");
var debug = require('debug')('eye:supervisor:lib:mongodb');
var format = require('util').format;

function connect () {
  var connection;
  if(!config) throw new Error('no mongo db connection provided!');
  if(config.user && config.password) {
    connection = format(
      'mongodb://%s:%s@%s/%s',
      config.user,
      config.password,
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
  return mongoose.createConnection(connection);
}

function Connection () {
  var _db ;

  this.connect = function (done) {
    if( _db ) return done(); // already connected

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

  Object.defineProperty(this, 'db', {
    get: function() { return _db; }
  });

  // return this just for the name.
  Object.defineProperty(this, 'connection', {
    get: function() { return _db; }
  });
}

module.exports = new Connection();
