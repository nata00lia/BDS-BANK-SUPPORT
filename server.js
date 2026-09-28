const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
let rooms = {};

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','host.html')));
app.get('/chat/:roomId', (req,res)=> res.sendFile(path.join(__dirname,'public','chat.html')));

io.on('connection', (socket)=>{
  socket.on('create-room', ()=>{
    const roomId = uuidv4().slice(0,6);
    rooms[roomId] = {closed:false, users:[], hostId:socket.id};
    socket.join(roomId);
    rooms[roomId].users.push(socket.id);
    const link = `https://bds-bank-support.onrender.com/chat/${roomId}`;
    socket.emit('room-created', {roomId, link});
  });

  socket.on('join-room', (roomId, isHost)=>{
    if(!rooms[roomId]) return socket.emit('error-msg','Link don expire');
    if(rooms[roomId].closed) return socket.emit('room-closed');
    if(rooms[roomId].users.length >=2 &&!rooms[roomId].users.includes(socket.id)){
      return socket.emit('error-msg','Only 2 people allowed');
    }
    socket.join(roomId);
    if(!rooms[roomId].users.includes(socket.id)) rooms[roomId].users.push(socket.id);
    if(isHost) rooms[roomId].hostId = socket.id;
    const isHostNow = rooms[roomId].hostId === socket.id;
    socket.emit('joined', isHostNow);
  });

  socket.on('send-message', (roomId, message)=>{
    if(!rooms[roomId] || rooms[roomId].closed){
      return socket.emit('auto-reply','No customer service available at the moment');
    }
    socket.to(roomId).emit('receive-msg', message, socket.id);
  });

  socket.on('typing', (roomId)=>{
    socket.to(roomId).emit('show-typing');
  });

  socket.on('close-room', (roomId)=>{
    if(rooms[roomId]) rooms[roomId].closed = true;
    io.to(roomId).emit('room-closed');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('Running on '+PORT));