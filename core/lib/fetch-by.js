'use strict';
var logger = require('./logger')('lib:fetch-by');
module.exports = function (filter, next) {
  var query = this.find(filter.where);
  if (filter.include) { query.select(filter.include) }
  if (filter.sort) { query.sort(filter.sort) }
  if (filter.limit) { query.limit(filter.limit) }
  if (filter.populate) {
    if (Array.isArray(filter.populate)) {
      query.populate(filter.populate.join(','))
    } else {
      query.populate(filter.populate)
    }
  }

  logger.data('%s query %j',this.modelName,filter);
  query.exec(function(error,models){
    if (error) {
      logger.error(error);
      return next(error,[]);
    }
    if (models===null||models.length===0) {
      return next(null,[]);
    }
    return next(null,models);
  })
}
