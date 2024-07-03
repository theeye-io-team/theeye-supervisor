
const App = require('../app')
const after = require('lodash/after')
const router = require('../router')
const logger = require('../lib/logger')('eye:controller:hostgroup')
const HostGroup = require('../entity/host/group').Entity
const audit = require('../lib/audit')
const TopicsConstants = require('../constants/topics')
const Recipe = require('../entity/recipe').Recipe

/**
 *
 * exports routes
 * @author Facundo
 *
 */
module.exports = function(server) {
  const crudTopic = TopicsConstants.hostgroup.crud
  const middleware = [
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerNameToEntity({}),
    router.ensureCustomer,
  ]

  /** 
  * @openapi
  * /{customer}/hostgroup:
  *   get:
  *     summary: Get host group list
  *     description: Get a list of host in the host group from specific customer.
  *     tags:
  *         - Host Group
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved host information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Hostgroup'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/hostgroup', middleware, controller.fetch)
  
  /** 
  * @openapi
  * /{customer}/hostgroup:
  *   post:
  *     summary: Create host group 
  *     description: Create host group for specific customer.
  *     tags:
  *         - Host Group
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully created host group.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Hostgroup'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.post('/:customer/hostgroup',
    middleware,
    controller.create,
    audit.afterCreate('group', { display: 'name', topic: crudTopic })
  )

  /** 
  * @openapi
  * /{customer}/hostgroup/{group}:
  *   get:
  *     summary: Get host group 
  *     description: Get a host group from specific customer.
  *     tags:
  *         - Host Group
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Group
  *         in: query
  *         description: Group Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved host information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Hostgroup'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/hostgroup/:group',
    middleware,
    router.resolve.idToEntity({ param: 'group', entity: 'host/group', required: true }),
    controller.get
  )

  /** 
  * @openapi
  * /{customer}/hostgroup/{group}:
  *   put:
  *     summary: Update host group 
  *     description: Update a host group from specific customer.
  *     tags:
  *         - Host Group
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Group
  *         in: query
  *         description: Group Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully updated host information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Hostgroup'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.put('/:customer/hostgroup/:group',
    middleware,
    router.resolve.idToEntity({ param: 'group', entity: 'host/group', required: true }),
    controller.replace,
    audit.afterReplace('group', { display: 'name', topic: crudTopic })
  )

  /** 
  * @openapi
  * /{customer}/hostgroup/{group}:
  *   delete:
  *     summary: Delete host group 
  *     description: Delete a host group from specific customer.
  *     tags:
  *         - Host Group
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Group
  *         in: query
  *         description: Group Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully updated host information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Hostgroup'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.del('/:customer/hostgroup/:group',
    middleware,
    router.resolve.idToEntity({ param: 'group', entity: 'host/group', required: true }),
    controller.remove,
    audit.afterRemove('group', { display: 'name', topic: crudTopic })
  )

  /** 
  * @openapi
  * /hostgroup/{group}/serialize:
  *   get:
  *     summary: Get host group 
  *     description: Get a host group.
  *     tags:
  *         - Host Group
  *     parameters:
  *       - name: Group
  *         in: query
  *         description: Group Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved host information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Hostgroup'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/hostgroup/:group/serialize',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'group', entity: 'host/group', required: true }),
    controller.serialize
  )
}

/**
 *
 * @route /group
 * group controller
 * @author Facundo
 *
 */
const controller = {
  async serialize (req, res) {
    try {
      const { customer, group } = req
      const recipe = await Recipe.findOne({
        customer_id: customer.id,
        hostgroup_id: group._id
      })

      res.send(200, recipe?.instructions)
    } catch (err) {
      res.sendError(err)
    }
  },
  /**
   *
   * @author Facundo
   * @method GET
   *
   */
  get (req,res,next) {
    const group = req.group
    App.hostTemplate.populate(group,(error,data) => {
      res.send(200,data)
    })
  },
  /**
   *
   * @author Facundo
   * @method GET
   *
   */
  fetch (req,res,next) {
    const customer = req.customer

    HostGroup.find({
      customer_name: customer.name
    }).exec(function (err,groups) {

      if (groups.length === 0) {
        return res.send(200,[])
      }

      const result = []
      const done = after(
        groups.length,
        () => res.send(200, result)
      )

      for (var i=0; i<groups.length; i++) {
        App.hostTemplate.populate(
          groups[i],
          function (err,data) {
            result.push(data)
            done()
          }
        )
      }
    })
  },
  /**
   *
   * @author Facundo
   * @method DELETE
   *
   */
  remove (req,res,next) {
    const group = req.group
    let deleteInstances = req.query.deleteInstances

    if (typeof deleteInstances === 'string') {
      if (deleteInstances === 'true') {
        deleteInstances = true
      } else {
        deleteInstances = false
      }
    } else {
      return res.send(400, 'Invalid parameter value: deleteInstances')
    }

    App.hostTemplate.remove({
      user: req.user,
      group,
      deleteInstances
    }, (err) => {
      if (err) {
        res.sendError(err)
      } else {
        res.send(200)
        next()
      }
    })
  },
  /**
   *
   * @author Facugon
   * @method POST
   *
   * @param {Object[]} req.body.hosts , hosts to add to the group
   * @param {Object[]} req.body.resources , resources/monitors templates definitions
   * @param {Object[]} req.body.tasks , tasks templates definitions
   * @param {Object[]} req.body.triggers , link monitors and tasks to anothe tasks view events
   * @todo req.body.triggers[] need validation here !
   * @param {String} req.body.triggers[].task_id , the id of the task for this trigger
   * @param {String[]} req.body.triggers[].events , array of event ids which belongs to the same host as the tasks host (can be triggered by tasks and monitors)
   * @param {Boolean} req.body.applyToSourceHost , determines if template should be applied to source host.
   *
   */
  create (req, res, next) {
    const body = req.body
    const hostname_regex = body.hostname_regex
    const source_host = req.body.source_host
    const applyToSourceHost = req.body.applyToSourceHost

    if (typeof applyToSourceHost !== 'boolean') {
      return res.send(400, 'Invalid parameter value')
    }

    if (typeof hostname_regex === 'string') {
      try {
        new RegExp(hostname_regex)
      } catch(e) {
        return res.send(400, 'Invalid regular expression')
      }
    }

    App.hostTemplate.create(
      Object.freeze({
        source_host,
        user: req.user,
        customer: req.customer,
        name: body.name,
        description: body.description,
        hostname_regex: hostname_regex,
        hosts: body.hosts || [], // Array of valid Host ids
        tasks: body.tasks || [], // Array of Objects with task definitions
        triggers: body.triggers || [], // Array of Objects with task ids related to the trigger id
        resources: body.resources || [], // Array of Objects with resources and monitors definition, all mixed
        files: body.files || [], // Array of Objects with file definitions
        applyToSourceHost: applyToSourceHost
      })
    ).then(group => {
      res.send(200, group)
      req.group = group
      next()
    }).catch(err => {
      res.sendError(err)
    })
  },
  /**
   *
   * @author Facundo
   * @method PUT
   *
   */
  replace (req, res, next) {
    const body = req.body

    const hostname_regex = body.hostname_regex
    const deleteInstances = req.body.deleteInstances

    if (typeof deleteInstances !== 'boolean') {
      return res.send(400, 'Invalid parameter value')
    }

    if (typeof hostname_regex === 'string') {
      try {
        new RegExp(hostname_regex)
      } catch(e) {
        return res.send(400, 'Invalid regular expression')
      }
    }

    App.hostTemplate.replace({
      customer: req.customer,
      group: req.group,
      name: body.name,
      description: body.description,
      hostname_regex: hostname_regex,
      hosts: body.hosts || [], // Array of valid Host ids
      tasks: body.tasks || [], // Array of Objects with task definition
      resources: body.resources || [], // Array of Objects with resources and monitors definition, all mixed
      deleteInstances: deleteInstances
    }).then(group => {
      res.send(200, group)
      next()
    }).catch(err => {
      res.sendError(err)
    })
  }
}
