const fs = require('fs')
const md5 = require('md5')
const multer = require('multer')
const config = require('config')
const App = require('../app')
const router = require('../router')
const logger = require('../lib/logger')('eye:controller:file')
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
    router.ensurePermissions(),
    router.dbFilter(),
    fetchFiles
  )

  // FETCH
  server.get('/file',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.ensurePermissions(),
    router.dbFilter(),
    fetchFiles
  )

  // GET
  server.get('/:customer/file/:file',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'file', required: true }),
    router.ensureAllowed({ entity: { name: 'file' } }),
    getFile
  )

  // DOWNLOAD SCRIPTS
  server.get('/:customer/file/:file/download',
    server.auth.bearerMiddleware,
    router.requireCredential('user'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'file', required: true }),
    (req, res, next) => {
      if (req.user.credential === 'agent') {
        return next()
      } else {
        return router.ensureAllowed({ entity: { name: 'file' } })(req, res, next)
      }
    },
    downloadFile
  )

  // GET LINKED MODELS
  server.get('/:customer/file/:file/linkedmodels',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param:'file', required:true }),
    router.ensureAllowed({ entity: { name: 'file' } }),
    getLinkedModels
  )

  // UPDATE
  server.put('/:customer/file/:file',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param:'file', required:true }),
    //router.ensureAllowed({ entity: { name: 'file' } }),
    upload.single('file'),
    updateFile,
    App.state.postUpdate('file'),
    checkAfectedModels,
    //audit.afterUpdate('file', { display: 'filename' })
  )

  server.put('/:customer/file/:file/upload',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param:'file', required:true }),
    router.ensureAllowed({ entity: { name: 'file' } }),
    upload.single('file'),
    uploadFile,
    App.state.postUpdate('file'),
    checkAfectedModels,
    //audit.afterUpdate('file', { display: 'filename' })
  )

  // CREATE
  server.post('/:customer/file',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    upload.single('file'),
    createFile,
    App.state.postCreate('file')
    //audit.afterCreate('file', { display: 'filename' })
  )

  server.put('/:customer/file/:file/schema',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'file', required: true }),
    updateContentSchema,
    App.state.postUpdate('file'),
    checkAfectedModels,
    //audit.afterUpdate('file', { display: 'filename' })
  )

  // DELETE
  server.del('/:customer/file/:file',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'file', required: true }),
    removeFile,
    App.state.postRemove('file')
    //audit.afterRemove('file', { display: 'filename' })
  )
}

/**
 *
 * @method GET
 *
 */
const fetchFiles = (req, res, next) => {
  const query = Object.assign(
    {},
    req.dbQuery,
    { sort: { filename: 1 } }
  )

  App.Models.File.File.fetchBy(query, (error, files) => {
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
const uploadFile = async (req, res) => {
  try {
    //const fileModel = (req.file || req.script)
    const fileModel = req.file
    const fileUploaded = req.files?.file
    if (!fileUploaded) {
      throw new ClientError('file required')
    }

    logger.log('Updating file content')
    const storeData = await new Promise((resolve, reject) => {
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
      size: fileUploaded.size,
      keyname: storeData.keyname,
      md5: md5(buf)
    }

    logger.log('updating file metadata')
    fileModel.set(data)
    await fileModel.save()

    res.send(200, fileModel)
  } catch (err) {
    res.sendError(err)
  }
}

/**
 *
 * @method PUT/PATCH
 *
 */
const updateFile = async (req, res) => {
  try {
    //const fileModel = (req.file || req.script)
    const fileModel = req.file
    const fileUploaded = req.files?.file
    if (!fileUploaded) {
      throw new ClientError('file required')
    }
    const params = req.params || {}

    let acl
    if (params.acl) {
      acl = params.acl
      if (!Array.isArray(acl)) {
        let parsed
        try {
          parsed = JSON.parse(acl)
        } catch (err) { }

        if (!Array.isArray(parsed)) {
          throw new ClientError('Invalid ACL definition')
        }

        acl = parsed
      }
    } else {
      acl = fileModel.acl
    }

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
      acl,
      mimetype: params.mimetype,
      extension: params.extension,
      description: params.description,
      size: fileUploaded.size,
      keyname: storeData.keyname,
      md5: md5(buf)
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

const updateContentSchema = async (req, res) => {
  try {
    const file = req.file
    file.content_schema = req.body
    await file.save()
    res.send(200, file.content_schema)
  } catch (err) {
    res.sendError(err)
  }
}

/**
 *
 * @method POST
 *
 */
const createFile = async (req, res) => {
  try {
    const customer = req.customer
    const file = req.files?.file
    if (!fileUploaded) {
      throw new ClientError('file required')
    }
    const params = req.params || {}
    const description = params?.description
    const isPublic = (params?.public || false)
    const mimetype = params?.mimetype
    const extension = params?.extension

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
    req.file = model // assign to the route for state post processing
    res.send(200, model)
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
  FileHandler.getStream(file).then(stream => {
    logger.log('streaming file to client')
    const headers = {
      'Content-Disposition': 'attachment; filename=' + file.filename
    }
    res.writeHead(200,headers)
    stream.pipe(res)
  })
    .catch(res.sendError)
}

/**
 *
 * @method DELETE
 *
 */
const removeFile = async (req, res) => {
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
const getLinkedModels = async (req, res) => {
  try {
    const file = req.file
    const linkedModels = await App.file.getLinkedModels({ file })

    res.send(200, linkedModels)
  } catch (err) {
    logger.error(err)
    res.send(500)
  }
}


const checkAfectedModels = async (req, res) => {
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
}
