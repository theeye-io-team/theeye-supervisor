var bcryptjs = require('bcryptjs');
var bcrypt = require('bcrypt');
var SALT_WORK_FACTOR = 10;


function hash1(newPassword)
{
  const salt = bcrypt.genSaltSync(SALT_WORK_FACTOR)
  console.log('salt bcrypt',salt);
  const crypted = bcrypt.hashSync(newPassword, salt)
  console.log('hash bcrypt', crypted);
}

function hash2(newPassword)
{
  const salt = bcryptjs.genSaltSync(SALT_WORK_FACTOR)
  console.log('salt bcryptjs',salt);
  const crypted = bcryptjs.hashSync(newPassword, salt)
  console.log('hash bcryptjs', crypted);
}

if( ! process.env.PASSWORD )
{
  console.error('define env var PASSWORD="yourpassword"');
  process.exit();
}

console.log('hashing :', process.env.PASSWORD);

hash1(process.env.PASSWORD);
hash2(process.env.PASSWORD);
