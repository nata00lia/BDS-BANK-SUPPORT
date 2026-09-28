const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Main page = HOST panel
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

// Chat page
app.get('/chat/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

io.on('connection', (socket) => {
  
  socket.on('create-room', () => {
    const roomId = Math.random().toString(36).substring(2, 9);
    const link = `https://bds-bank-support.onrender.com/chat/${roomId}`;
    // For localhost testing: http://localhost:3000/chat/${roomId}
    socket.emit('room-created', { roomId, link });
  });

  socket.on('join-room', (roomId, isHost) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.isHost = isHost;
    socket.emit('joined', isHost);

    // Welcome message
    if (!isHost) {
      socket.to(roomId).emit('show-typing');
      setTimeout(() => {
        io.to(roomId).emit('auto-reply', 'Hello! Welcome to BDS.BANK Support. How can we help you today?');
      }, 1200);
    }
  });

  socket.on('send-message', (roomId, msg) => {
    socket.to(roomId).emit('receive-msg', msg);
  });

  socket.on('typing', (roomId) => {
    socket.to(roomId).emit('show-typing');
  });

  socket.on('close-room', (roomId) => {
    io.to(roomId).emit('room-closed');
  });

  socket.on('disconnect', () => {
    // optional cleanup
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});