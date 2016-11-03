"use strict";

const randomSecret = require(APP_ROOT + '/lib/random-secret');

module.exports = function(task, next){
  task.secret = randomSecret();
  task.save(err => {
    if(err) console.error('error in task ' + task._id + ' ' + task.name);
    else console.log('task '+ task.name +' updated');
    next(null, task);
  });
}
