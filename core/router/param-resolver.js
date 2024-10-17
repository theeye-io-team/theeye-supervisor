const logger = require('../lib/logger')(':router:middleware:params-resolver')
const Host = require('../entity/host').Entity
const Customer = require('../entity/customer').Entity
const isMongoId = require('validator/lib/isMongoId')
const { ClientError, ServerError } = require('../lib/error-handler')

module.exports = {
  idToEntityByCustomer (options) {
    options||(options={})

    if (!options.param) {
      throw new Error('param name is required')
    }

    const paramName = options.param
    const entityName = (options.entity||options.param)
    const targetName = (options.into||paramName)

    return function (req, res, next) {
      try {
        const customer = req.customer
        let _id = (
          req.params[paramName] ||
          (req.body && req.body[paramName]) ||
          req.query[paramName]
        )

        if (isObject(_id)) {
          _id = ( _id._id || _id.id || undefined )
        } else if (typeof _id !== 'string') {
          _id = undefined
        }

        if (!_id) {
          if (options.required) {
            throw new ClientError(`${options.param} is required`)
          }

          req[targetName] = null
          return next()
        } else if (!isMongoId(_id)) {
          if (options.required) {
            throw new ClientError(`${options.param} invalid value`)
          }

          req[targetName] = null
          return next()
        } else {
          logger.debug('resolving "%s" with id "%s"', targetName, _id)

          const EntityModule = require('../entity/' + entityName)
          const Entity = (
            EntityModule.Entity || 
            EntityModule[ firstToUpper(entityName) ] || 
            EntityModule
          )

          // filter by customer
          Entity.findOne({
            _id, 
            $or: [
              { customer: customer._id },
              { customer_id: customer._id.toString() },
              { customer_id: customer._id },
              { customer_name: customer.name }
            ]
          }).then(dbDoc => {
            if (!dbDoc) {
              if (options.required) {
                throw new ClientError(`${options.param } not found`, { statusCode: 404 })
              }

              req[targetName] = null
              return next()
            }

            logger.debug('instances of "%s" found', options.param)
            req[targetName] = dbDoc
            return next()
          })
        }
      } catch (err) {
        res.sendError(err)
      }
    }
  },
  idToEntity (options) {
    options||(options={})

    if (!options.param) {
      throw new Error('param name is required')
    }

    const paramName = options.param
    const entityName = (options.entity||options.param)
    const targetName = (options.into||paramName)

    return function (req, res, next) {
      let _id = (
        req.params[paramName] ||
        (req.body && req.body[paramName]) ||
        req.query[paramName]
      )

      if (isObject(_id)) {
        _id = ( _id._id || _id.id || undefined )
      } else if (typeof _id !== 'string') {
        _id = undefined
      }

      if (!_id) {
        if (options.required) {
          return res.send(400, options.param + ' is required')
        }

        logger.debug('no param "%s"', targetName)
        req[targetName] = null
        return next()
      }

      if (!isMongoId(_id)) {
        if (options.required) {
          return res.send(400, options.param + ' id is invalid')
        }

        req[targetName] = null;
        return next();
      }

      logger.debug('resolving "%s" with id "%s"', targetName, _id);

      var entityModule = require('../entity/' + entityName);
      var Entity = (
        entityModule.Entity || 
        entityModule[ firstToUpper(entityName) ] || 
        entityModule
      );

      Entity.findById( _id, (err, resource) => {
        if (err) {
          logger.error(err);
          req[targetName] = null;
          return next(err);
        }

        if (!resource) {
          if (options.required) {
            return res.send(404, options.param + ' not found')
          }

          req[targetName] = null;
          return next();
        }

        logger.debug('instances of "%s" found', options.param);
        req[targetName] = resource;
        next(null, resource);
      })
    }
  },
  hostnameToHost (options) {
    options||(options={})

    return (req, res, next) => {
      const hostname = (
        req.params.hostname ||
        (req.body && req.body.hostname) ||
        req.query.hostname
      )
      const customer = req.customer

      if (!customer) {
        logger.debug('no customer yet present');
        req.host = null;
        return next();
      }

      if (!hostname) {
        if (options.required) {
          return res.send(400, 'hostname is required')
        }

        logger.debug('no hostname');
        req.host = null;
        return next();
      }

      logger.debug('resolving host with hostname "%s"', hostname);

      Host.findOne({
        hostname: hostname,
        customer_name: customer.name
      },function(err,host){
        if(err) {
          logger.debug(err);
          next(err);
        } else if(host == null) {
          req.host = null ;
          return next();
        } else {
          req.host = host
          return next()
        }
      })
    }
  },
  customerSessionToEntity (options) {
    return (req, res, next) => {
      if (!req.session) {
        throw new Error('authentication middleware must go first')
      }

      const name = req.session?.customer_name
      if (!name) {
        return res.send(403, 'session organization is not set')
      }

      logger.debug('resolving customer with name "%s"', name);

      const query = { name }
      Customer.findOne(query, (err, customer) => {
        if (err) {
          logger.error(err)
          return next(err)
        }

        if (!customer) {
          const message = `${name} organization not found`
          logger.error(message)
          return res.send(404, message)
        }

        req.customer = customer
        next()
      })
    }
  },
  customerNameToEntity (options) {
    options || (options={})

    return function (req,res,next) {
      const name = (
        req.params.customer ||
        (req.body && req.body.customer) ||
        (req.query && req.query.customer) ||
        (req.session?.customer_name)
      )

      if (!name) {
        if (options.required) {
          return res.send(403, 'organization is required')
        }

        logger.debug('no customer');
        req.customer = null;
        return next();
      }

      logger.debug('resolving customer with name "%s"', name);

      const query = { name }
      Customer.findOne(query, (err, customer) => {
        if (err) {
          logger.error(err)
          return next(err)
        }

        if (!customer) {
          if (options.required) {
            return res.send(404, 'organization not found')
          }

          req.customer = null
          return next()
        }

        req.customer = customer
        next()
      })
    }
  },
  /**
   * Use customer name or customer id to resolve.
   *
   * NOTE: this middleware ignores path params
   *
   * Values must be provided using body or query via property name "customer"
   * This middleware creates the property req.customer with resolved model
   * 
   * @param {Object} options
   * @prop {Object} options.required if true abort request with status 403 / 404
   * @return {Function}
   */
  customerToEntity (options) {
    options || (options={})

    return function (req, res, next) {

      if (req.params.customer) {
        logger.error('***** customerToEntity middleware must not be used when "customer" is defined as path parameter')
      }

      const value = (
        (req.body && req.body.customer) ||
        (req.query && req.query.customer) ||
        (req.session?.customer_name)
      )

      if (!value) {
        if (options.required === true) {
          return res.send(403, 'organization is required')
        }

        logger.debug('no customer')
        req.customer = null
        return next()
      }

      logger.debug('resolving customer by value "%s"', value)

      let query
      if (isMongoId(value)) {
        query = { _id: value }
      } else {
        query = { name: value }
      }

      Customer
        .findOne(query)
        .then(customer => {
          if (!customer) {
            if (options.required) {
              return res.send(404, 'organization not found')
            }

            req.customer = null
            return next()
          }

          req.customer = customer
          next()
        })
        .catch(err => {
          logger.error(err)
          return next(err)
        })
    }
  }
}

function firstToUpper (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

const isObject = (value) => {
  return Object.prototype.toString.call(value) == '[object Object]'
}
