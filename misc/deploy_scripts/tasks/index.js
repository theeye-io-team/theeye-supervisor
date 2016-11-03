"use strict";

global.APP_ROOT = __dirname + '/../../../core';
const lodash = require('lodash');
const debug = require('debug')('eye:deploy:task');

var deployProcessName = process.argv[2];
if( !deployProcessName ) {
  console.error(new Error('DeployProcessParameterRequired'),'deploy process failed');
  process.exit(1);
}

try  {
  var doDeploy = require( deployProcessName );
} catch (e) {
  console.error(e,'deploy process failed');
  process.exit(2);
}

var mongodb = require( APP_ROOT + '/lib/mongodb' ).connect(() => {

  var TM = require( APP_ROOT + '/entity/task' );
  require( APP_ROOT + '/entity/task/scraper' );

  var Task = TM.Entity;
  var TaskService = require( APP_ROOT + '/service/task');

  Task.find().exec( (err, tasks) => {
    if (err) {
      debug(err);
      process.exit(3);
    } else {

      startDeploy(tasks,(err) => {
        if(err) {
          debug(err);
          process.exit(4);
        } else {
          process.exit(0);
        }
      });

    }
  });

});

function startDeploy (tasks, done) {

  if( !(tasks.length>0) ) return done( new Error('no tasks to process') );

  var deployDone = lodash.after(tasks.length, done);

  tasks.forEach(task => doDeploy(task, deployDone) );

}
