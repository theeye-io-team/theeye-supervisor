const after = require('lodash/after')
const Task = require("../entity/task").Entity;
const logger = require('../lib/logger')('service:file');
const storage = require('../lib/storage').get();
const FileHandler = require('../lib/file')
const crypto = require('crypto')

const FileModel = require('../entity/file')
const Monitor = require('../entity/monitor').Entity

module.exports = {
  remove (input, next) {
    next || (next = () => {})
    let file = input.file
    let filter = { _id: file._id }
    FileModel.File.deleteOne(filter, function (error) {
      if (error) { return next(error) }
      storage.remove({ key: file.keyname }, function (error, data) {
        if (error) { return next(error) }
        next()
      })
    })
  },
  getLinkedModels (input) {
    return new Promise((resolve, reject) => {

      const file = input.file
      const done = after(2, () => next(null, models))

      const tasksPromise = Task
        .find({ script_id: file._id.toString() })
        .select({ name: 1, _type: 1, host_id: 1 })
        .exec()

      const monitorsPromise = Monitor
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
        .select({ name: 1, _type: 1, host_id: 1, type: 1, config: 1 })
        .exec()

      let linked = []

      Promise.all([ tasksPromise, monitorsPromise ]).then(models => {
        if (models[0] && models[0].length > 0) {
          Array.prototype.push.apply(linked, models[0])
        }
        if (models[1] && models[1].length > 0) {
          Array.prototype.push.apply(linked, models[1])
        }
        resolve(linked)
      }).catch(reject)
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
  createTemplates (input) {
    const { group, files } = input
    const templates = []
    for (let file of files) {
      file.hostgroup_id = group._id
      file.hostgroup = group._id

      const model = FileModel.Template.FactoryCreate(file)
      templates.push(model.save())
    }
    return Promise.all(templates)
  },
  /**
   *
   *
   */
  createFromTemplate (input, done) {
    let { template, customer } = input

    let templateData
    if (template.toObject) {
      templateData = template.toObject()
    } else {
      templateData = template
    }

    logger.log('creating file from template %j', template)
    const data = Object.assign({}, templateData, {
      customer: customer._id,
      customer_id: customer._id,
      customer_name: customer.name,
      template: template._id,
      template_id: template._id
    })

    delete data._id
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
  },
  /**
   * @summary get file recipe
   * @param {Mixed} file model instance or id
   * @param {Function} next
   */
  getRecipe (file, next) {
    const getFileContent = (fileModel) => {
      FileHandler.getBuffer(fileModel, (error, buff) => {
        let props = fileModel.templateProperties() // convert to plain object ...
        if (error) {
          logger.error('error getting file buffer. %s', error)
          props.data = '' // cannot obtain file content
        } else {
          props.data = buff.toString('base64') // ... assign data to file plain object only
        }
        next(null, props)
      })
    }

    if (isFileModel(file)) {
      getFileContent(file)
    } else {
      FileModel.File.findById(file, (err, model) => {
        if (err) { return next(err) }
        if (!model) { return next(null) }

        getFileContent(model)
      })
    }
  }
}

const isFileModel = (file) => {
  let isModel = (
    file instanceof FileModel.Script ||
    file instanceof FileModel.File
  )
  return isModel
}
