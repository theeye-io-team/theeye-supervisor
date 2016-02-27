var bcrypt = require('bcrypt');
var SALT_WORK_FACTOR = 10;


function hash(newPassword, cb)
{
  cb=!cb?(function(){}):cb;
  bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
    if (err) return cb(err);

    console.log('salt ',salt);

    bcrypt.hash(newPassword, salt, function(err, crypted) {
      if(err) return cb(err);

      console.log('hash ', crypted);

      return cb();
    });
  });
}

if( ! process.env.PASSWORD )
{
  console.error('define env var PASSWORD="yourpassword"');
  process.exit();
}

console.log('hashing :', process.env.PASSWORD);

hash(process.env.PASSWORD);
