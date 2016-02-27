var config = require("config");
var _ = require("underscore");
var logger = require("../lib/logger")("eye:supervisor:service:customer");

var Customer = require("../entity/customer").Entity ;
var User = require("../entity/user").Entity ;
var ResourceMonitor = require("../entity/user").Entity ;


var Service = module.exports = {
  /**
   * search every user of with this customer
   * and extract its email.
   */
  getAlertEmails : function(customerName, next)
  {
    var self = this;

    Customer.findOne({
      'name': customerName
    },function(error, customer){
      if(error) {
        logger.log(error);
        return next(error);
      }

      if(!customer) {
        logger.log('customer %s data does not exist!', customerName);
        return next(null);
      }

      next(customer.emails);
      /**
      User.find({
        'customers._id' : customerName
      }, function(error, users){

      });
      */

    });

  },
  /**
   *
   *
   */
  getCustomerConfig : function(customer_id,next)
  {
    Customer.findById(customer_id, function(error,customer){
      if(!customer) {
        logger.error(error);
        return next(error);
      }
      // replace default options with customer defined options
      var cconfig = _.extend(config.get("monitor"), customer.config);
      if(next) next(null, cconfig);
    });
  },
  /**
   * no defined filters yet
   */
  fetch : function(filters, next)
  {
    var query = {};
    Customer.find(query, function(err, customers) {
      if(err) return next(err);
      else return next(null, customers);
    });
  },
  /**
   * creates a customer entity
   *
   * @author JuanSan
   * @param {Array} data
   * @param {Function} next
   * @return null
   */
  create : function (input, next)
  {
    var data = {
      emails : input.emails,
      name : input.name,
      description : input.description || ''
    };

    var customer = new Customer(data);
    customer.save(function(err, customer) {
      if(err) return next(err)
      else return next(null, customer);
    });  
  },
  /**
   * @author Facundo
   * @param {Object} customer
   * @param {Object} updates
   *    @attribute {String} description
   * @param {Function} doneFn callback
   * @return null
   */
  update : function(customer, updates, doneFn) {
    customer.description = updates.description;
    customer.emails = updates.emails;
    return customer.save(function(error){
      return doneFn(error, customer);
    });
  },
  /**
   *
   *
   */
  remove : function (customer, doneFn) {
    logger.log('removing customer %s from users', customer.name);

    User
    .find({'customers._id': customer._id})
    .exec(function(error,users){
      if(users && users.length > 0) {
        for(var i=0; i<users.length; i++) {
          var user = users[i];

          if(user.credential != 'agent')
          {
            var customers = user.customers;
            var filteredCustomers = filterCustomer(customer, customers);
            user.customers = filteredCustomers;
            user.save(function(error){
              if(error) logger.error(error);
              else logger.log('user customers updated');
            });
          }
          else
          {
            // is an agent user
            user.remove(function(error){
              if(error) logger.error(error);
              else logger.log('customer %s agent user removed', customer.name);
            });
          }
        }
      }
    });

    customer.remove(function(error){
      if(error) logger(error);
      else {
        logger.log('customer %s removed', customer.name);
        doneFn(null);
        return;
      }
    });
  }
};

/**
 *
 * remove customer from customers and return resulting array.
 * @author Facundo
 * @param {Object} customer
 * @param {Array} customers
 * @return {Array} result
 *
 */
function filterCustomer(customer, customers){
  var filtered = [];
  for(var i=0;i<customers.length; i++){
    var item = customers[i];
    if( item._id != customer._id ) {
      filtered.push( item );
    }
  }
  return filtered;
}
