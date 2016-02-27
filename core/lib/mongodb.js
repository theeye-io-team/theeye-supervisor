var mongoose = require('mongoose');
var config = require("config" ).get("mongo");
var debug = require('debug')('eye:supervisor:model:mongodb');
var format = require('util').format;

var singleton = function singleton() {
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
  if(singleton.caller != singleton.getInstance) {
    throw new Error("This object cannot be instanciated");
  }
};

/** singleton class definition **/
singleton.instance = null;

/**
 * Singleton getInstance definition
 * @return singleton class
 */
singleton.getInstance = function(){
  if(this.instance === null){
    this.instance = new singleton();
  }
  return this.instance;
};

module.exports = singleton.getInstance();
