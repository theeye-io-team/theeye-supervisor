const after = require('underscore').after;
const Task = require("../entity/task").Entity;
const logger = require('../lib/logger')('service:file');
const storage = require('../lib/storage').get();

const File = require('../entity/file').File
const Monitor = require('../entity/monitor').Entity

module.exports = {
  remove (input,next) {
    next||(next=function(){});
    var file = input.file;
    var filter = {_id:file._id};
    File.remove(filter,function(error) {
      if(error) return next(error);
      storage.remove(file, function(error,data){
        if(error) return next(error);
        next();
      });
    });
  },
  getLinkedModels (input,next) {
    next||(next=function(){})
    const file = input.file

    var models = []
    const done = after(2, () => next(null, models))

    Task
      .find({ script_id: file._id })
      .select({
        name: 1,
        _type: 1,
        host_id: 1
      })
      .exec(function(error,tasks) {
        if (error) return next(error)
        if (tasks && tasks.length > 0) {
          Array.prototype.push.apply(models, tasks)
        }
        done()
      })

    Monitor
      .find({
        $or: [
          { $and: [{ type: 'script' }, { 'config.script_id': file._id.toString() }] },
          { $and: [{ type: 'file' }, { 'config.file': file._id.toString() }] }
        ]
      })
      .select({ name: 1, _type: 1, host_id: 1 })
      .exec(function(error, monitors) {
        if (error) return next (error)
        if (monitors && monitors.length > 0) {
          Array.prototype.push.apply(models, monitors)
        }
        done()
      })
  }
}
