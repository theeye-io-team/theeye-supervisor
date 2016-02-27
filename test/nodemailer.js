
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport();
transporter.sendMail({
    from: 'system@theeye.io',
    to: 'facugon@interactar.com',
    subject: 'hello',
    text: 'hello world!'
},function(error,info){
    console.log(error);
    console.log(info);
});
