const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const users = {}; // socket.id -> nickname
const nicknames = new Set();

io.on('connection', (socket) => {
  let nickname = `User${Math.floor(Math.random() * 1000)}`;
  users[socket.id] = nickname;
  nicknames.add(nickname);

  socket.broadcast.emit('user connected', nickname);
  io.emit('update users', Array.from(nicknames));

  socket.on('set nickname', (name) => {
    if (!nicknames.has(name)) {
      nicknames.delete(users[socket.id]);
      users[socket.id] = name;
      nicknames.add(name);
      io.emit('update users', Array.from(nicknames));
    }
  });

  socket.on('chat message', (msg) => {
    const sender = users[socket.id];

    // Private message
    if (msg.startsWith('/w ')) {
      const split = msg.split(' ');
      const recipientName = split[1];
      const privateMsg = split.slice(2).join(' ');

      for (let [id, name] of Object.entries(users)) {
        if (name === recipientName) {
          io.to(id).emit('private message', { from: sender, msg: privateMsg });
          socket.emit('private message sent', { to: recipientName, msg: privateMsg });
          return;
        }
      }

      socket.emit('error', `User "${recipientName}" not found.`);
    } else {
      socket.broadcast.emit('chat message', { user: sender, msg });
      socket.emit('my message', msg);
    }
  });

  socket.on('typing', () => {
    socket.broadcast.emit('typing', users[socket.id]);
  });

  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', users[socket.id]);
  });

  socket.on('disconnect', () => {
    const name = users[socket.id];
    nicknames.delete(name);
    delete users[socket.id];
    io.emit('user disconnected', name);
    io.emit('update users', Array.from(nicknames));
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
