var debug = require('debug')('eye:supervisor:service:task');

var Host = require('../entity/host').Entity;
var Task = require('../entity/task').Entity;
var Script = require('../entity/script').Entity;
var TaskTemplate = require('../entity/task/template').Entity;
var async = require('async');
var _ = require('lodash');

var validator = require('../router/param-validator');
var filter = require('../router/param-filter');
var elastic = require('../lib/elastic');
var config = require('config');

function registerTaskCRUDOperation(customer,data) {
  var key = config.elasticsearch.keys.task.crud;
  elastic.submit(customer,key,data);
}

var TaskService = {
  remove:function(options){
    Task.remove(options.task,function(error){
      if(error) {
        return options.fail(error);
      } else {
        registerTaskCRUDOperation(
          options.customer.name,{
            'task':options.task.name,
            'customer':options.customer.name,
            'user_id':options.user.id,
            'user_email':options.user.email,
            'operation':'delete'
          }
        );
        options.done();
      }
    });
  },
  update:function(options){
    var task = options.task;
    var updates = options.updates;
    task.update(updates, function(error){
      if(error){
        return options.fail(error);
      } else {
        debug('publishing task');
        task.publish(function(pub){
          registerTaskCRUDOperation(
            options.customer.name,{
              'task':task.name,
              'customer':options.customer.name,
              'user_id':options.user.id,
              'user_email':options.user.email,
              'operation':'update'
            }
          );
          options.done(pub);
        });
      }
    });
  },
  /**
   *
   * @author Facundo
   *
   */
  fetchBy : function(input,next)
  {
    var publishedTasks = [];
    Task.find(input, function(error,tasks){
      if(error) {
        debug('error %j', error);
        return next(error);
      }

      var notFound = tasks == null || 
        (tasks instanceof Array && tasks.length === 0);

      if( notFound ) {
        debug('cannot find task with that criteria');
        next(null, []);
      }
      else {
        debug('publishing tasks');

        var asyncTasks = [];
        tasks.forEach(function(task){
          asyncTasks.push(function(callback){
            task.publish(function(data){
              publishedTasks.push(data);
              callback();
            });
          });
        });

        async.parallel(asyncTasks,function(){
          next(null, publishedTasks);
        });
      }
    });
  },
  createResourceTask : function (input, doneFn){
    var hostId = input.resource.host_id;
    Host.findById(hostId, function(error, host){
      input.host = host;
      Task.create(input, function(error, task){

        registerTaskCRUDOperation(input.customer.name,{
          'task':task.name,
          'customer':input.customer.name,
          'user_id':input.user.id,
          'user_email':input.user.email,
          'operation':'create'
        });

        task.publish((published) => {
          debug('host id %s task created', hostId);
          doneFn(null, published);
        });
      });
    });
  },
  createManyTasks : function (input, doneFn) {
    var create = [];
    debug('creating tasks');
    var asyncTaskCreation = function(hostId) {
      return function(asyncCb) {
        debug('creating task with host id %s', hostId);
        if( hostId.match(/^[a-fA-F0-9]{24}$/) ) {
          Host.findById(hostId, function(error, host){
            var props = _.extend({}, input, { host: host });
            Task.create(props, function(err,task) {
              debug('task created');

              registerTaskCRUDOperation(input.customer.name,{
                'task':task.name,
                'customer':input.customer.name,
                'user_id':input.user.id,
                'user_email':input.user.email,
                'operation':'create'
              });

              task.publish(function(published) {
                debug('host id %s task created', hostId);
                asyncCb(null, published);
              });
            });
          });
        } else {
          debug('host id %s invalid', hostId);
          var error = new Error('invalid host id ' + hostId);
          asyncCb(error, null);
        }
      }
    }

    var hosts;
    if( ! (input.hosts instanceof Array) ) {
      hosts = [ input.hosts ] ;
    } else hosts = input.hosts ;

    debug('creating task on hosts %j', hosts);

    for( var i in hosts ) {
      var hostId = hosts[i];
      var createFn = asyncTaskCreation(hostId);
      create.push( createFn );
    }

    var endFn = function(error, results){
      doneFn(null, results);
    }

    async.parallel(create, endFn);
  }
};

/**
 *
 * handle tasks.
 * validate type and data
 * @author Facundo
 * @param {Array} tasks , array of plain objects
 * @param {Object} customer
 * @param {Object} user
 * @param {Function} done
 *
 */
TaskService.tasksToTemplates = function( 
  tasks, 
  customer,
  user,
  done 
) {
  if(!tasks) {
    var e = new Error('tasks definition required');
    e.statusCode = 400;
    return done(e);
  }

  if(! Array.isArray(tasks)) {
    var e = new Error('tasks must be an array');
    e.statusCode = 400;
    return done(e);
  }

  if(tasks.length == 0) {
    debug('no tasks. skipping');
    return done(null,[]);
  }

  var templates = [];

  var templatized = _.after( tasks.length, function(){
    debug('all tasks templates processed');
    done(null, templates);
  });

  debug('processing %s tasks', tasks.length);

  for(var i=0; i<tasks.length; i++){
    var value = tasks[i];
    debug('processing task %j', value);

    if( Object.keys( value ).length === 0 ) {
      var e = new Error('invalid task definition');
      e.statusCode = 400;
      return done(e);
    }

    // create template from existent task
    if( value.hasOwnProperty('id') ){
      if( validator.isMongoId(value.id) ){
        taskToTemplate(value.id, function(error, tpl){
          if(error) done(error);

          debug('task to template done');
          templates.push( tpl );
          templatized();
        });
      } else {
        var e = new Error('invalid task id');
        e.statusCode = 400;
        return done(e);
      }
    } else {
      // validate, set & instantiate template with data
      validateTaskTemplateData(value, function(valErr, data) {
        if(valErr || !data) {
          var e = new Error('invalid task data');
          e.statusCode = 400;
          e.data = valErr;
          return done(e);
        }

        data.customer = customer;
        data.user = user;
        data._type = 'TaskTemplate';
        TaskTemplate.create(data, function(e, template){
          debug('task template create from scratch done');
          templates.push( template );
          templatized();
        });
      });
    }
  }
}

/**
 * @author Facundo
 * @return null
 */
function validateTaskTemplateData(input, done){
  var scriptArgs = filter.toArray(input.script_arguments);
  if(!input.script_id) {
    var e = new Error('script is required');
    e.statusCode = 400;
    return done(e, false);
  }

  Script.findById( input.script_id, function(err, script){
    if(err) throw err;
    if(!script){
      var e = new Error('script not found');
      e.statusCode = 400;
      return done(e, false);
    }

    done(null, {
      'name': input.name,
      'description': input.description,
      'script': script,
      'script_arguments': scriptArgs,
    });
  });
}

/**
 * Create a template from task properties.
 * @author Facundo
 */
function taskToTemplate(id, doneFn){
  Task.findById( id , function(error, task){
    if(error) throw new Error(error);

    if(!task) {
      var e = new Error('task not found. invalid task id');
      e.statusCode = 400;
      return doneFn(e);
    }

    task.toTemplate( doneFn );
  });
}

module.exports = TaskService ;
