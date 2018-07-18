const after = require('underscore').after;
const Task = require("../entity/task").Entity;
const logger = require('../lib/logger')('service:file');
const storage = require('../lib/storage').get();
const FileHandler = require('../lib/file')
const asyncMap = require('async/map')
const lodashAssign = require('lodash/assign')
const crypto = require('crypto')

const FileModel = require('../entity/file')
const Monitor = require('../entity/monitor').Entity

module.exports = {
  remove (input,next) {
    next || (next = () => {})
    var file = input.file;
    var filter = { _id: file._id }
    FileModel.File.remove(filter, function (error) {
      if (error) { return next(error) }
      storage.remove({ key: file.keyname }, function (error, data) {
        if (error) { return next(error) }
        next()
      })
    })
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
          {
            $and: [
              { type: 'script' },
              { 'config.script_id': file._id.toString() }
            ]
          },
          {
            $and: [
              { type: 'file' },
              { 'config.file': file._id.toString() }
            ]
          }
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
  },
  /**
   *
   * @summary Create file template objects
   * @param {Object} input
   * @prop {HostGroup} input.group
   * @prop {Object} input.files files content and metadata
   * @param {Function} done
   *
   */
  createTemplates (input, done) {
    let { group, files } = input

    asyncMap(files, (file, next) => {
      file.source_model_id || (file.source_model_id = file._id)
      file.hostgroup_id = group._id
      file.hostgroup = group._id
      delete file.keyname // keyname must be generated during file template provisioning

      let tpl = FileModel.Template.FactoryCreate(file)
      tpl.save( (err, fileModel) => {
        if (err) { logger.error(err) }
        next(err, fileModel)
      })
    }, done)
  },
  createFromTemplate (input, done) {
    let { template, customer } = input

    logger.log('creating file from template %j', template)
    let data = lodashAssign({}, template.toObject(), {
      customer: customer._id,
      customer_id: customer._id,
      customer_name: customer.name,
      template: template,
      template_id: template._id
    })

    delete data.md5
    delete data.keyname

    this.createFromText({
      content: Buffer.from(template.data, 'base64').toString('utf8'),
      metadata: data,
      storename: customer.name,
      filename: data.filename
    }, done)
  },
  /**
   *
   * @summary create a file from it's content. all metadata must be provided. save content in the files storage and metadata in the database
   * @param {Object} input
   * @property {String} input.content file content to save in files storage
   * @property {Object} input.metadata file metadata to save in database
   * @property {String} input.storename files storage name
   * @property {String} input.filename file name
   *
   */
  createFromText (input, done) {
    let { content } = input
    logger.log('saving file in the store')

    FileHandler.storeText({
      storename: input.storename,
      filename: input.filename,
      text: input.content
    }, (err, storeData) => {
      if (err) {
        logger.error(err)
        return done(err)
      } else {
        let props = Object.assign({}, input.metadata)
        props.keyname = storeData.keyname
        props.md5 = crypto.createHash('md5').update(input.content).digest('hex')
        props._type = 'Script' // force to create all files as scripts

        let script = FileModel.Script(props)
        script.save( (err, model) => {
          if (err) { logger.error(err) }
          done(err, model)
        })
      }
    })
  }
}
