
var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');

var s3 = new AWS.S3();
var zlib = require('zlib');

var opts = { Bucket: 'theeye.scripts' };

if( ! process.env.ACTION ) {
  console.log('no ACTION');
  console.log('ACTION  : "list", "download_stream", "download_text", "delete"');
  console.log('OBJ_KEY : use with all ACTION but "list"');
  process.exit();
}

if( process.env.ACTION == 'list' )
{
    s3.listObjects(opts, function(err, data) {
        console.log(err);
        console.log(data);
    });
}

else if( process.env.ACTION == 'download_stream' )
{
    opts.Key = process.env.OBJ_KEY;
    var file = require('fs').createWriteStream('./scripts/' + process.env.OBJ_KEY);
    var stream = s3.getObject(opts).createReadStream().pipe( zlib.createGunzip() ).pipe(file);
}

else if( process.env.ACTION == 'download_text' )
{
    opts.Key = process.env.OBJ_KEY;
    s3.getObject(opts,function(err,data){
        console.log(data);
    });
}

else if( process.env.ACTION == 'delete' )
{
    opts.Key = process.env.OBJ_KEY;
    s3.deleteObject(opts,function(err,data){
        console.log(err);
        console.log(data);
    });
}
