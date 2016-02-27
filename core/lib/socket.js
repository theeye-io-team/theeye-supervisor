var socket = require('socket.io');
var debug = require('debug')('eye:supervisor:config:socket');

module.exports = {
  connect : function connect(server) {
    config.sockets = socket.listen(server).sockets;
    config.sockets.on('connection', function (socket) {
      //socket.emit('news', { hello: 'world' });
      socket.on('subscribe', function (room) {
        debug('new client subscription to ' + room);
        socket.join(room);
      });
    });
  }
};
