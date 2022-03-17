
const secret = process.argv[2]
const user = process.argv[3]

if (!secret) {
  console.error('use : \n\n node issue.js "secret-key-to-sign-token" "user_id"')
  process.exit(1)
}


const jwt = require('jsonwebtoken');

const token = jwt.sign({ user_id: user }, secret, { })

console.log( token );



