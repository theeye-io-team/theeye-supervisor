/**
 *
 * scraper example with streams, using custom stream transformation.
 *
 * Facundo
 * 
 */

var util = require('util'),
    request = require('request'),
    stream = require('stream')
    ;

/**
 *
 * custom Parser stream helper
 *
 */

// node v0.10+ use native Transform, else polyfill
var Transform = stream.Transform ||
  require('readable-stream').Transform;

function Parser(options) {
  // allow use without new
  if (!(this instanceof Parser)) {
    return new Parser(options);
  }

  // init Transform
  Transform.call(this, options);

  this.pattern = new RegExp( options.pattern );
  this.result = null ;
}

util.inherits(Parser, Transform);

Parser.prototype._transform = function (chunk, encription, callback)
{
    // if is Buffer use it, otherwise coerce
    this.result = this.pattern.exec( chunk.toString() );
    callback();
};

Parser.prototype._flush = function (callback)
{
    if( this.result != null && this.pattern.test(this.result[0]) )
        this.push( this.result.input );

    else {
        var error = new Error('pattern doesn\' match');
        error.name = 'ParseError' ;

        this.emit( "error", error );
    }

    callback();
};


/**
 *
 * main process flow
 *
 */
var parser = new Parser({ pattern : 'Ciao' });

request({
    url     : "http://ccme.development.com",
    timeout : "1000",
    method  : "get",
    headers : {}
})
.on('error',function(error){

    // handle errors
    console.error('unable to connect!');

})
.pipe( parser ) // pipe request output to custom parser input
.on('error',function(error){

    console.error(error.name);
    console.error(error.message);

})
.on('finish',function(){

    // ... do someting with the pipe result
    console.log('end ok');
})
;
