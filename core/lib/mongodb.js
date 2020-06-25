
const mongoose = require('mongoose')
const debug = require('debug')('eye:lib:mongodb')
const format = require('util').format

function MongoDBConnection () {
  let _db

  this.connect = (config) => {
    return new Promise( (resolve, reject) => {
      if (_db) { // already connected
        return resolve()
      }

      _db = connect(config)

      _db.on('error', (err) => {
        debug('MongoDB error encountered', err)
        process.kill(process.pid)
      })

      _db.once('close', () => {
        debug('MongoDB closed the connection')
        process.kill(process.pid)
      })

      _db.once('connected', () => {
        debug('MongoDB connected')
        resolve()
      })
    })
  }

  this.disconnect = (done) => {
    _db.close()
  }

  Object.defineProperty(this, 'db', {
    get () {
      return _db
    }
  })

  // return this just for the name.
  Object.defineProperty(this, 'connection', {
    get () {
      return _db
    }
  })
}

module.exports = new MongoDBConnection()

const connect = (config) => {
  let connectionString

  if (!config) {
    throw new Error('no mongo db connection provided!');
  }

  if (config.uri) {
    // sample uri
    // mongodb+srv://<user>:<password>@<host>/<db>?retryWrites=true&w=majority
    connectionString = config.uri
  } else {
    if (config.user && config.password) {
      connectionString = format(
        'mongodb://%s:%s@%s/%s',
        encodeURIComponent(config.user),
        encodeURIComponent(config.password),
        config.hosts,
        config.database
      )
    } else {
      connectionString = format(
        'mongodb://%s/%s',
        config.hosts,
        config.database
      )
    }

    if (config.replicaSet) {
      connectionString += `?replicaSet=${config.replicaSet}`
    }
  }

  if (config.debug) {
    mongoose.set("debug", true)
  }

  return mongoose.createConnection(connectionString, (config.options||{}))
}
