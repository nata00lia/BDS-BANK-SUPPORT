const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {}; // { roomId: { messages:[{text,sender,agent,seen,time}], active, created, agent } }

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','host.html')));
app.get('/chat/:roomId', (req,res)=> res.sendFile(path.join(__dirname,'public','chat.html')));
app.get('/history', (req,res)=> res.json(rooms));

io.on('connection', (socket)=>{
  socket.on('create-room', ()=>{
    const roomId = Math.random().toString(36).substring(2,9);
    rooms[roomId] = { messages: [], active: true, created: new Date().toLocaleString(), agent: null };
    const link = `https://bds-bank-support.onrender.com/chat/${roomId}`;
    socket.emit('room-created', { roomId, link });
    io.emit('rooms-update', rooms);
  });

  socket.on('join-room', (roomId, isHost)=>{
    if(!rooms[roomId]){
      rooms[roomId] = { messages: [], active: false, created: 'old', agent: null };
    }
    socket.join(roomId);
    socket.roomId = roomId;
    socket.isHost = isHost;
    socket.emit('joined', isHost);
    socket.emit('load-history', rooms[roomId].messages, rooms[roomId].active, rooms[roomId].agent);

    if(rooms[roomId].active &&!isHost && rooms[roomId].messages.length===0 &&!rooms[roomId].agent){
      const welcome = 'Hello! Welcome to BDS.BANK Support. How can we help you today?';
      const msgObj = { text: welcome, sender: 'support', agent: 'Support', seen: false, time: Date.now() };
      rooms[roomId].messages.push(msgObj);
      setTimeout(()=> io.to(roomId).emit('receive-msg', msgObj), 800);
    }
  });

  socket.on('set-agent', ({roomId, agent})=>{
    if(!rooms[roomId]) return;
    rooms[roomId].agent = agent;
    const intro = `Hello, this is ${agent} from BDS BANK Support. What's your complaint and what can we do for you?`;
    const msgObj = { text: intro, sender: 'support', agent, seen: false, time: Date.now() };
    rooms[roomId].messages.push(msgObj);
    io.to(roomId).emit('receive-msg', msgObj);
    io.emit('rooms-update', rooms);
  });

  socket.on('send-message', (roomId, data)=>{
    if(!rooms[roomId] ||!rooms[roomId].active){
      socket.emit('room-closed-msg');
      return;
    }
    let text, sender, agent;
    if(typeof data === 'string'){
      text = data;
      sender = socket.isHost? 'support' : 'client';
      agent = rooms[roomId].agent;
    } else {
      text = data.text;
      sender = data.sender || (socket.isHost? 'support' : 'client');
      agent = data.agent || rooms[roomId].agent;
    }
    const msgObj = { text, sender, agent, seen: false, time: Date.now() };
    rooms[roomId].messages.push(msgObj);
    io.to(roomId).emit('receive-msg', msgObj);
    io.emit('rooms-update', rooms);
  });

  socket.on('message-seen', ({roomId, viewer})=>{
    if(!rooms[roomId]) return;
    rooms[roomId].messages.forEach(m=>{
      if(m.sender!== viewer) m.seen = true;
    });
    io.to(roomId).emit('messages-seen-update', rooms[roomId].messages);
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