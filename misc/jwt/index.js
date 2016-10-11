


var jwt = require('jsonwebtoken');

var token = jwt.sign({ email: 'tuvieja@gmail.com' }, 'secret2', { expiresIn: "1d"});

console.log( token );

var decoded = jwt.verify(token, 'secret2');

console.log(decoded);



