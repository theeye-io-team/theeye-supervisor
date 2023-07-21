'use strict';

const mime = require('mime');
const fs = require('fs');
const extend = require('util')._extend;
const audit = require('../lib/audit')
const logger = require('../lib/logger')('controller:script')

var json = require('../lib/jsonresponse')
var router = require('../router')
var ScriptService = require('../service/script')
var ResourceService = require('../service/resource')
var Script = require('../entity/file').Script
var dbFilter = require('../lib/db-filter')

module.exports = function (server) {

  /** 
  * @openapi
  * /{customer}/script:
  *   get:
  *     summary: Get scripts list
  *     description: Get a list of scripts from specific customer.
  *     tags:
  *         - Script
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved script information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Script'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/script',
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    controller.fetch
  )

  /** 
  * @openapi
  * /{customer}/script/{script}:
  *   get:
  *     summary: Get script
  *     description: Get a specific scripts from customer.
  *     tags:
  *         - Script
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Script
  *         in: query
  *         description: Script Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved script information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Script'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/script/:script', 
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'script',required:true,entity:'file'}),
    controller.get
  )

  // clients can download scripts

  /** 
  * @openapi
  * /{customer}/script/{script}/download:
  *   get:
  *     summary: Download script
  *     description: Download a specific scripts from customer.
  *     tags:
  *         - Script
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Script
  *         in: query
  *         description: Script Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved script information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Script'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/script/:script/download',
    server.auth.bearerMiddleware,
    router.requireCredential('user'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'script',required:true,entity:'file'}),
    controller.download
  )
}

const controller = {
  /**
   *
   *
   */
  fetch (req, res, next) {
    var customer = req.customer;
    var input = req.query;
    var filter = dbFilter(input,{ sort: { filename: 1 } });
    filter.where.customer_id = customer.id;

    Script.fetchBy(filter, (error, scripts) => {
      res.send(200, scripts)
      next()
    });
  },
  /**
   *
   *
   */
  get (req, res, next) {
    res.send(200, req.script)
    next()
  },
  download (req, res, next) {
    var script = req.script;

    ScriptService.getScriptStream(script, (err,stream) => {
      if (err) {
        logger.error(err.message)
        res.send(500)
      } else {
        logger.log('streaming script to client');

        var headers = {
          'Content-Disposition':'attachment; filename=' + script.filename,
        }
        res.writeHead(200,headers);
        stream.pipe(res);
        next()
      }
    })
  }
}
