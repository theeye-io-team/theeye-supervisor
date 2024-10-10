const after = require('lodash/after')
const isDataUrl = require('valid-data-url')
const Task = require("../entity/task").Entity;
const logger = require('../lib/logger')('service:file');
const FileHandler = require('../lib/file')
const crypto = require('crypto')

const FileModel = require('../entity/file')
const Monitor = require('../entity/monitor').Entity

module.exports = {
  //@TODO 
  /**
   * @todo REMOVE IS ONLY REMOVING THE LAST REVISION OF THE FILE
   * @todo PREVIOUS REVISIONS OF A FILE ARE NOT LINKED TO THE FILE MODEL
   *
   */
  remove (input, next) {
    next || (next = () => {})
    const { file } = input
    FileModel.File.deleteOne({ _id: file._id }, (err) => {
      if (err) { return next(err) }

      FileHandler
        .remove(file)
        .catch(err => logger.error(err))

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

    //delete data._id
    //delete data.md5
    //delete data.keyname
    //delete data.storage_key

    const text = fileDataDecode(template.data)

    const params = {
      text,
      metadata: data,
      storename: customer.name,
      filename: data.filename
    }

    createFromText(params, done)
  },
  /**
   * @param Object input 
   * @prop Customer customer
   * @prop String filename
   * @prop String pathname where to create the file
   * @prop String mimetype
   * @prop String extension
   * @prop Number size
   * @prop String description
   * @prop String md5 
   * @prop {Array<String>} tags
   * @prop String data 
   *
   * @param Array options
   * @prop Boolean encoded_data
   * @prop String pathname scripts, jobs..
   */
  create (input, options) {
    return new Promise((resolve, reject) => {
      const { customer } = input
      const props = Object.assign({}, input, {
        customer: customer._id,
        customer_id: customer._id,
        customer_name: customer.name,
        last_update: new Date(),
        creation_date: new Date()
      })

      const text = (options?.encoded_data) ? fileDataDecode(input.data) : input.data

      const params = {
        text,
        metadata: props,
        filename: props.filename,
        storename: customer.name,
        pathname: options.pathname
      }

      createFromText(params, (err, file) => {
        if (err) { reject(err) }
        else { resolve(file) }
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
    if (
      fileSerial.md5 &&
      fileSerial.size &&
      fileSerial.extension &&
      fileSerial.mimetype
    ) {
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

/**
 *
 * @summary create a file from it's content.
 * all metadata must be provided. 
 * save the content in the storage and the metadata in the database
 *
 * @param {Object} input
 * @property {String} input.text file content to save in files storage
 * @property {Object} input.metadata file metadata to save in database
 * @property {String} input.storename files storage name
 * @property {String} input.filename file name
 * @property {String} input.type file type
 *
 */
const createFromText = (input, done) => {
  const {
    text,
    storename,
    filename,
    pathname = 'scripts',
    metadata
  } = input

  let type = (pathname === 'scripts') ? 'Script' : 'File'
  switch (pathname) {
    case 'scripts': type = 'Script'; break;
    case 'outputs': type = 'Output'; break;
    default: type = 'File'
  }
  logger.log(`creating a ${type} file`)

  // remove 
  delete metadata._id
  delete metadata.id
  delete metadata.md5
  delete metadata.keyname
  delete metadata.storage_key
  delete metadata.template_id
  delete metadata.template

  const props = Object.assign({}, metadata)
  props._type = type
  props.md5 = crypto
    .createHash('md5')
    .update(text)
    .digest('hex')

  const file = FileModel.FactoryCreate(props)

  const params = {
    storename,
    pathname,
    filename: file._id.toString(),
    text
  }

  logger.log('saving file in the store')
  FileHandler.storeText(params, (err, storeData) => {
    if (err) {
      logger.error(err)
      return done(err)
    }

    file.storage_key = storeData.storage_key
    file.save( (err, model) => {
      if (err) { logger.error(err) }
      done(err, model)
    })
  })
}
