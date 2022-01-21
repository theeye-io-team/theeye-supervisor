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

const File = require('../entity/file').File
const Script = require('../entity/file').Script

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

  File.fetchBy(filter, (error, files) => {
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
  req.file.publish((err, file) => {
    if (err) { return next(err) }
    res.send(200, file)
  })
}

/**
 *
 * @method PUT/PATCH
 *
 */
const updateFile = (req, res, next) => {
  const fileModel = req.file || req.script
  const fileUploaded = req.files.file
  const description = req.params.description
  const isPublic = (req.params.public || false)
  const mimetype = req.params.mimetype
  const extension = req.params.extension

  if (!fileUploaded) {
    return res.send(400, 'file is required')
  }

  logger.log('Updating file content')
  FileHandler.replace({
    model: fileModel,
    filepath: fileUploaded.path,
    filename: fileUploaded.name,
    storename: req.customer.name
  }, function (err, storeData) {
    if (err) {
      logger.error(err)
      return next(err)
    }

    let buf = fs.readFileSync(fileUploaded.path)

    let data = {
      filename: fileUploaded.name,
      mimetype: mimetype,
      extension: extension,
      size: fileUploaded.size,
      description: description,
      keyname: storeData.keyname,
      md5: md5(buf),
      public: isPublic
    }

    logger.log('File model is being updated')
    fileModel.set(data)
    fileModel.save(err => {
      if (err) {
        logger.error(err)
        next(err)
      } else {
        fileModel.publish((err, pub) => {
          if (err) { return next(err) }
          res.send(200,pub)
          logger.log('Operation completed')
          next()
        })
      }
    })
  })
}

/**
 *
 * @method POST
 *
 */
const createFile = (req, res, next) => {
  const customer = req.customer
  const file = req.files.file
  const description = req.params.description
  const isPublic = (req.params.public || false)
  const mimetype = req.params.mimetype
  const extension = req.params.extension

  logger.log('creating file');

  FileHandler.storeFile({
    filepath: file.path,
    filename: file.name,
    storename: req.customer.name
  }, function (err, storeData) {
    if (err) {
      logger.error(err);
      return next(err);
    } else {

      let buf = fs.readFileSync(file.path);

      let data = {
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

      Script.create(data,(err,file) => {
        if (err) {
          logger.error(err)
          next(err)
        } else {
          file.publish((err,data) => {
            if (err) return next(err)

            req.file = file; // assign to the route to audit
            res.send(200,data)
            next()
          })
        }
      })
    }
  })
}

/**
 *
 * @method GET
 *
 */
const downloadFile = (req, res, next) => {
  let file = req.file
  FileHandler.getStream(file, (error, stream) => {
    if (error) {
      logger.error(error)
      next(error)
    } else {
      logger.log('streaming file to client')
      var headers = {
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
    //let file = req.file || req.script
    let file = req.file
    let models = await App.file.getLinkedModels({ file })

    if (models.length > 0) {
      let err = new Error('Cannot delete this file. It is being used')
      err.code = 'FileInUse'
      err.statusCode = 400
      throw err
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
  } catch (err) {
    logger.error(err)
    res.send(err.statusCode || 500, err.message)
    next()
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
    let models = await App.file.getLinkedModels({ file })

    res.send(200, models)
    next()
  } catch (err) {
    logger.error(err)
    return res.send(500)
  }
}


const checkAfectedModels = async (req, res, next) => {
  try {
    let file = req.file
    let models = await App.file.getLinkedModels({ file })
    if (Array.isArray(models) && models.length > 0) {
      for (let model of models) {
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
