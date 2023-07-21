const CustomerConstants = require('../constants/customer')
const passport = require('passport')

module.exports = function (server) {
  /**
   * agents basic authentication
   */

  /** 
  * @openapi
  * /indicator:
  *   post:
  *     summary: Authentication.
  *     description: Authentication.
  *     tags:
  *       - Auth
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Auth'
  *     responses:
  *       '201':
  *         description: Authentication successful.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Auth'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.post(
    '/token',
    (req, res, next) => {
      passport.authenticate('basic', (err, token) => {
        if (err) {
          res.send(err.statusCode, err.message)
        } else {
          res.send(200, token)
        }
      }, {session:false})(req, res, next)
    }
  )
}
