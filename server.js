const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// STORAGE
const rooms = {}; // { roomId: { messages: [{text, from}], active: true, created: Date } }

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','host.html')));
app.get('/chat/:roomId', (req,res)=> res.sendFile(path.join(__dirname,'public','chat.html')));
app.get('/history', (req,res)=> res.json(rooms));

io.on('connection', (socket)=>{
  socket.on('create-room', ()=>{
    const roomId = Math.random().toString(36).substring(2,9);
    rooms[roomId] = { messages: [], active: true, created: new Date().toLocaleString() };
    const link = `https://bds-bank-support.onrender.com/chat/${roomId}`;
    socket.emit('room-created', { roomId, link });
    io.emit('rooms-update', rooms);
  });

  socket.on('join-room', (roomId, isHost)=>{
    if(!rooms[roomId]){ // if someone opens old invalid link
      rooms[roomId] = { messages: [], active: false, created: 'old' };
    }
    socket.join(roomId);
    socket.roomId = roomId;
    socket.isHost = isHost;
    socket.emit('joined', isHost);
    socket.emit('load-history', rooms[roomId].messages, rooms[roomId].active);

    if(!isHost && rooms[roomId].active && rooms[roomId].messages.length===0){
       // auto welcome only first time
       const welcome = 'Hello! Welcome to BDS.BANK Support. How can we help you today?';
       rooms[roomId].messages.push({text: welcome, me: false});
       setTimeout(()=>{ io.to(roomId).emit('auto-reply', welcome); }, 800);
    }
  });

  socket.on('send-message', (roomId, msg)=>{
    if(!rooms[roomId] ||!rooms[roomId].active){
      socket.emit('room-closed-msg');
      return;
    }
    // save message
    rooms[roomId].messages.push({text: msg, me: false}); // false means from sender side will be handled as other on receiver
    socket.to(roomId).emit('receive-msg', msg);
    io.emit('rooms-update', rooms);
  });

  socket.on('typing', (roomId)=>{
    if(rooms[roomId] && rooms[roomId].active) socket.to(roomId).emit('show-typing');
  });

  socket.on('close-room', (roomId)=>{
    if(rooms[roomId]) rooms[roomId].active = false;
    io.to(roomId).emit('room-closed');
    io.emit('rooms-update', rooms);
  });
});

server.listen(PORT, ()=> console.log('Running '+PORT));