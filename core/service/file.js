const after = require('lodash/after')
const isDataUrl = require('valid-data-url')
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
    const { file } = input
    FileModel.File.deleteOne({ _id: file._id }, (err) => {
      if (err) { return next(err) }
      storage.remove(file, (err, data) => {
        if (err) { logger.error(err) }
      })
      next()
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

    let text = fileDataDecode(template.data)

    this.createFromText({
      text,
      metadata: data,
      storename: customer.name,
      filename: data.filename
    }, done)
  },
  create (input) {
    return new Promise((resolve, reject) => {
      const { customer } = input
      const props = Object.assign({}, input, {
        customer: customer._id,
        customer_id: customer._id,
        customer_name: customer.name,
        last_update: new Date(),
        creation_date: new Date()
      })

      delete props.id
      delete props._id
      delete props.template_id
      delete props.template

      let text = fileDataDecode(input.data)

      this.createFromText({
        text,
        metadata: props,
        filename: props.filename,
        storename: customer.name
      }, (err, file) => {
        if (err) { reject(err) }
        else { resolve(file) }
      })
    })
  },
  /**
   *
   * @summary create a file from it's content. all metadata must be provided. save content in the files storage and metadata in the database
   * @param {Object} input
   * @property {String} input.text file content to save in files storage
   * @property {Object} input.metadata file metadata to save in database
   * @property {String} input.storename files storage name
   * @property {String} input.filename file name
   *
   */
  createFromText (input, done) {
    const { text, storename, filename = 'unknown', metadata } = input
    logger.log('saving file in the store')

    FileHandler.storeText({ storename, filename, text }, (err, storeData) => {
      if (err) {
        logger.error(err)
        return done(err)
      }

      const props = Object.assign({}, metadata)
      props.keyname = storeData.keyname
      props.md5 = crypto
        .createHash('md5')
        .update(text)
        .digest('hex')

      props._type = 'Script' // force to create all files as scripts

      const script = FileModel.Script(props)
      script.save( (err, model) => {
        if (err) { logger.error(err) }
        done(err, model)
      })
    })
  },
  async locateFile (customer, fileSerial) {
    let file

    // the original file or a template
    const fileId = (fileSerial._id || fileSerial.id)
    if (fileId) {

      // the original file is in this organization
      file = await FileModel.File.findOne({
        customer_id: customer._id.toString(),
        $or: [
          { template_id: fileId },
          { _id: fileId }
        ]
      })

      if (file) { return file }

    }

    // source_model_id
    if (fileSerial.source_model_id) {

      // a file was already created using the same template
      file = await FileModel.File.findOne({
        customer_id: customer._id.toString(),
        _id: fileSerial.source_model_id
      })

      if (file) { return file }

    }

    // file fingerprint
    if (fileSerial.md5 && fileSerial.size && fileSerial.extension && fileSerial.mimetype) {

      // search using the metadata and fingerprint
      file = await FileModel.File.findOne({
        customer_id: customer._id.toString(),
        md5: fileSerial.md5,
        size: fileSerial.size,
        extension: fileSerial.extension,
        mimetype: fileSerial.mimetype
      })

      if (file) { return file }

    }

    // no more options
    return null
  },
  /**
   * @summary get file recipe
   * @param {Mixed} file model instance or id
   * @param {Function} next
   */
  serialize (file, options, next) {
    const getSerializedFile = (fileModel) => {
      const props = fileModel.serialize(options) // convert to plain object ...
      props.source_model_id = fileModel._id.toString() // add always. @TODO check if neccesary
      FileHandler.getBuffer(fileModel, (error, buff) => {
        if (error) {
          logger.error('error getting file buffer. %s', error)
          props.data = 'ERROR: cannot obtain file content'
        } else {
          const data = buff.toString('base64') // ... assign data to data serialization
          props.data = `data:text/plain;base64,${data}` // as data uri
        }
        next(null, props)
      })
    }

    if (isFileModel(file)) {
      getSerializedFile(file)
    } else {
      FileModel.File.findById(file, (err, model) => {
        if (err) { return next(err) }
        if (!model) { return next(null) }
        getSerializedFile(model)
      })
    }
  },
  serializePromise (file, options) {
    return new Promise((resolve, reject) => {
      this.serialize(file, options, (err, data) => {
        if (err) { reject(err) }
        else { resolve(data) }
      })
    })
  }
}

const isFileModel = (file) => {
  let isModel = (
    file instanceof FileModel.Script ||
    file instanceof FileModel.File
  )
  return isModel
}

const fileDataDecode = (data) => {
  let text
  try {
    const encoded = (isDataUrl(data)) ? data.split(';base64,')[1] : data
    text = Buffer.from(encoded, 'base64').toString('utf8')
  } catch (err) {
    text = `Cannot decode the script. Invalid DataUrl encode, must be base64 encoded. Error: ${err.message}`
  }
  return text
}
