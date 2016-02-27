var Handlebars = require('handlebars');
var fs = require('fs');
var config = require('config').get("system");

var templatePath = config.view_teamplates_path ;

var header = fs.readFileSync( 
  templatePath + '/email/header.hbs', 
  {encoding:'utf8'} 
);

Handlebars.registerPartial(
  'email_header', 
  Handlebars.compile(header)
);

var footer = fs.readFileSync(
  templatePath + '/email/footer.hbs', 
  {encoding:'utf8'}
);

Handlebars.registerPartial(
  'email_footer', 
  Handlebars.compile(footer)({
    web_url:config.web_url
  })
);

module.exports = {
  render:function(tplName,data,done)
  {
    this.getTemplate(tplName, function(template){
      var view = Handlebars.compile( template );
      if(done) done( view(data) );
    });
  },
  getFileByName:function(name)
  {
    return templatePath + '/' + name + '.hbs' ;
  },
  getTemplate:function(name,done)
  {
    var file = this.getFileByName(name);

    fs.readFile(file,{encoding:'utf8'},function (error, data) {
      if(error) throw error;
      if(done) done(data);
    });
  }
}
