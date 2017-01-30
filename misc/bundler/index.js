"use strict";

var UglifyJS = require('uglify-js'),
  walk = require('walk').walkSync,
	fs = require('fs'),
  path = require('path'),
  babel = require('babel-core'),
  es2015 = require('babel-preset-es2015'),
  stage0 = require('babel-preset-stage-0'),
	targetDir = __dirname + '/bundle';


function create (name) {
  console.log('creating ' + name);
  if(!fs.existsSync(name)){
    fs.mkdirSync(name);
  }
}

create( targetDir );
create( path.join(targetDir,'core') );

var options = {listeners:{
	directories: function (root, dirStatsArray, next) {
		// dirStatsArray is an array of `stat` objects with the additional attributes 
		// * type 
		// * error 
		// * name 
		console.log( root + ' => ' + dirStatsArray.map( stat => stat.name ) );

    var coreDir = root.match('core.*')[0];

    dirStatsArray.forEach( stat => {
      create( path.join(targetDir,coreDir,stat.name) );
    });

		next();
	},
  file: function (root, stat, next) {

    const coreDir = root.match('core.*')[0],
    origFilename = path.join(root,stat.name),
    targetFilename = path.join(targetDir,coreDir,stat.name);

    console.log('processing '+ origFilename );

    if( path.extname(stat.name) != '.js' ){ // just copy

      console.log('NON JS file ' + targetFilename);
      fs.createReadStream(
        origFilename 
      ).pipe(
        fs.createWriteStream(targetFilename)
      );

    } else {

      var ast, compAst, compressor, uglyCode;

      try {

        const result = babel.transformFileSync(origFilename, {
          ast: false,
          presets: [es2015, stage0],
          comments: false,
        });
        const code = result.code;

        var ast = UglifyJS.parse(code);

        // compressor needs figure_out_scope too
        ast.figure_out_scope();
        compressor = UglifyJS.Compressor();
        compAst = ast.transform(compressor);

        // need to figure out scope again so mangler works optimally
        compAst.figure_out_scope();
        compAst.compute_char_frequency();
        compAst.mangle_names();

        // get Ugly code back 
        uglyCode = compAst.print_to_string();

        console.log('writing into ' + targetFilename);
        fs.writeFileSync(targetFilename, uglyCode);
      } catch (e) {
        console.log(e);
        process.exit();
      }
    }

    next();
  }
}};

var walker = walk(__dirname + '/../../core', options);

