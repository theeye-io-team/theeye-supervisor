"use strict";

var appRoot = __dirname + '/../../../core';
var lodash = require('lodash');

var debug = require('debug')('eye:deploy:monitors');
var moment = require('moment');
var config = require('config');


var mongodb = require( appRoot + '/lib/mongodb' ).connect(() => {

  var Monitor = require( appRoot + '/entity/monitor' ).Entity;
  var ResourceService = require( appRoot + '/service/resource');
  var User = require( appRoot + '/entity/user' ).Entity;

  User.find({

    username: config.system.user.username

  }).exec( (err,theeyeUser) => {

    debug('theeye user %j', theeyeUser);

    Monitor.find().exec( (err, monitors) => {
      if(err) throw err;

      var next = lodash.after( monitors.length, () => process.exit(0) );

      monitors.forEach( m => {
        m.populate('resource', err => {
          if(err){
            debug('error populating monitor resource %j', m.toObject());
            debug(err);
            next();
          } else {

            if( ! m.resource ){
              debug('monitor [%s] resource cannot be found %j', m.name||m.description,m.toObject());
              m.remove( err => {
                if(err) {
                  debug(err);
                } else {
                  debug('monitor removed');
                }
                next();
              });
            } else {

              var name = m.name||m.description;
              var lastUpdate = moment(m.resource.last_update);
              var lastUpdateDays = lastUpdate.diff(new Date(),'days');

              if( m.resource.state == 'updates_stopped' && (lastUpdateDays > 60 || m.resource.fails_count > 100000)) {

                debug('monitor [%s] is DEAD ( last update %s|fails count %s). remove?..', name, lastUpdate.format('YYYY-MM-DD'), m.resource.fails_count);

                if( m.resource.type == 'host' ){
                  debug('[%s] is a host resource. removing everything',name);
                  //ResourceService.removeHostResource({
                    //  resource: m.resource,
                    //  user: theeyeUser
                 //});
                } else {
                  //ResourceService.remove({
                    //  resource: m.resource,
                    //  notifyAgents:true,
                    //  user: theeyeUser
                  //});
                }

                next();
              } else {
                //debug('monitor [%s] checks passed.', m.name||m.description);
                next();
              }

            }
          }
        });
      });
    });
  });
});
