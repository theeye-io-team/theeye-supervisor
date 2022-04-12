const fs = require('fs')
const md5 = require('md5')
const multer = require('multer')
const config = require('config')

const App = require('../app')
const router = require('../router')
const logger = require('../lib/logger')('eye:controller:file')
const audit = require('../lib/audit')
const dbFilter = require('../lib/db-filter')
const FileHandler = require('../lib/file')

const { ClientError, ServerError } = require('../lib/error-handler')

module.exports = (server) => {

  const upload = multer({
    dest: config.system.file_upload_folder,
    rename: (fieldname, filename) => {
      return filename
    }
  })

  // FETCH
  server.get('/:customer/file',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    fetchFiles
  )

  // GET
  server.get('/:customer/file/:file',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'file', required: true }),
    getFile
  )

  // CREATE
  server.post('/:customer/file',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    upload.single('file'),
    createFile,
    audit.afterCreate('file', { display: 'filename' })
  )

  // UPDATE
  server.put('/:customer/file/:file',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param:'file', required:true }),
    upload.single('file'),
    updateFile,
    checkAfectedModels,
    audit.afterUpdate('file', { display: 'filename' })
  )

  // DELETE
  server.del('/:customer/file/:file',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'file', required: true }),
    removeFile,
    audit.afterRemove('file', { display: 'filename' })
  )

  // DOWNLOAD SCRIPTS
  server.get('/:customer/file/:file/download',
    server.auth.bearerMiddleware,
    router.requireCredential('user'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'file',required:true}),
    downloadFile
  )

  // GET LINKED MODELS
  server.get('/:customer/file/:file/linkedmodels',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param:'file', required:true }),
    getLinkedModels
  )
}

/**
 *
 * @method GET
 *
 */
const fetchFiles = (req, res, next) => {
  const customer = req.customer
  const query = req.query
  const filter = dbFilter(query, { sort: { filename: 1 } })
  filter.where.customer_id = customer.id

  App.Models.File.File.fetchBy(filter, (error, files) => {
    if (!files) { files = [] }
    res.send(200, files)
    next()
  })
}

/**
 *
 * @method GET
 *
 */
const getFile = (req, res, next) => {
  res.send(200, req.file)
}

/**
 *
 * @method PUT/PATCH
 *
 */
const updateFile = async (req, res, next) => {
  try {
    const fileModel = req.file || req.script
    const fileUploaded = req.files.file
    const description = req.params.description
    const isPublic = (req.params.public || false)
    const mimetype = req.params.mimetype
    const extension = req.params.extension

    if (!fileUploaded) {
      throw new ClientError('File and filename are required')
    }

    logger.log('Updating file content')
    const storeData = await new Promise( (resolve, reject) => {
      FileHandler.replace({
        model: fileModel,
        filepath: fileUploaded.path,
        filename: fileUploaded.name,
        storename: req.customer.name
      }, (err, data) => {
        if (err) { reject(err) }
        else { resolve(data) }
      })
    })

    const buf = fs.readFileSync(fileUploaded.path)

    const data = {
      filename: fileUploaded.name,
      mimetype: mimetype,
      extension: extension,
      size: fileUploaded.size,
      description: description,
      keyname: storeData.keyname,
      md5: md5(buf),
      public: isPublic
    }

    if (fileModel.template || fileModel.template_id) {
      data.template = null
      data.template_id = null
    }

    logger.log('File metadata is being updated')
    fileModel.set(data)
    await fileModel.save()

    res.send(200, fileModel)
  } catch (err) {
    res.sendError(err)
  }
}

/**
 *
 * @method POST
 *
 */
const createFile = async (req, res, next) => {
  try {
    const customer = req.customer
    const file = req.files.file
    const description = req.params.description
    const isPublic = (req.params.public || false)
    const mimetype = req.params.mimetype
    const extension = req.params.extension

    logger.log('creating file')

    const storeData = await new Promise( (resolve, reject) => {
      FileHandler.storeFile({
        filepath: file.path,
        filename: file.name,
        storename: req.customer.name
      }, (err, storeData) => {
        if (err) { reject(err) }
        else { resolve(storeData) }
      })
    })

    const buf = fs.readFileSync(file.path)

    const data = {
      _type: 'Script',
      filename: file.name,
      mimetype: mimetype,
      extension: extension,
      size: file.size,
      description: description,
      customer: customer,
      customer_id: customer._id,
      customer_name: customer.name,
      keyname: storeData.keyname,
      md5: md5(buf),
      public: isPublic
    }

    const model = App.Models.File.FactoryCreate(data)
    model.save()
    req.file = model // assign to the route to audit
    res.send(200, model)
    next()
  } catch (err) {
    res.sendError(err)
  }
}

/**
 *
 * @method GET
 *
 */
const downloadFile = (req, res, next) => {
  const file = req.file
  FileHandler.getStream(file, (error, stream) => {
    if (error) {
      logger.error(error)
      next(error)
    } else {
      logger.log('streaming file to client')
      const headers = {
        'Content-Disposition': 'attachment; filename=' + file.filename
      }
      res.writeHead(200,headers)
      stream.pipe(res)
    }
  })
}

/**
 *
 * @method DELETE
 *
 */
const removeFile = async (req, res, next) => {
  try {
    const file = req.file
    const linkedModels = await App.file.getLinkedModels({ file })

    if (linkedModels.length > 0) {
      throw new ClientError('Cannot delete this file. It is being used')
    }

    await new Promise((resolve, reject) => {
      App.file.remove({
        file,
        user: req.user,
        customer: req.customer
      }, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })

    res.send(204)
  } catch (err) {
    res.sendError(err)
  }
}

/**
 *
 * GET LINKED MODELS
 *
 */
const getLinkedModels = async (req, res, next) => {
  try {
    const file = req.file
    const linkedModels = await App.file.getLinkedModels({ file })

    res.send(200, linkedModels)
    next()
  } catch (err) {
    logger.error(err)
    return res.send(500)
  }
}


const checkAfectedModels = async (req, res, next) => {
  try {
    const file = req.file
    const linkedModels = await App.file.getLinkedModels({ file })

    if (Array.isArray(linkedModels) && linkedModels.length > 0) {
      for (let model of linkedModels) {
        if (
          model._type === 'ResourceMonitor'||
          model._type === 'FileMonitor' ||
          model._type === 'ScriptMonitor'
        ) {
          await App.resourceMonitor.updateMonitorWithFile(model, file)
        }
      }
    }
  } catch (err) {
    logger.error(err)
  }

  // call next middleware
  next()
}
