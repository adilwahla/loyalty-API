
// config/server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
  cors: {
    origin: '*', // TODO: lock down in prod
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  },
});

// expose io to controllers/services via req.app.get('io')
app.set('io', io);

// OPTIONAL: if you ever truly need >10 listeners on one emitter
// require('events').EventEmitter.defaultMaxListeners = 30;
// io.setMaxListeners(30);

io.on('connection', (socket) => {
  console.log('🔌 ✅ [SOCKET] Client connected:', socket.id);

  const { userId, role } = socket.handshake.query || {};
   if (userId) socket.join(`${userId}`);
  if (role) socket.join(`role:${role}`);
  // join per-user room
  if (userId) {
    socket.join(String(userId));
    console.log(`📌 User ${userId} joined room`);
  }

  // keep role support (not required now, but harmless)
  if (role === 'SALES_ADMIN') {
    socket.join('admins');
    console.log('👮 Joined admins room');
  }
 // also support explicit subscribe from the client
  socket.on('admin_subscribe', () => {
    socket.join('admins');
    console.log('👮 joined admins (via event)');
    socket.emit('admin_subscribed', true); // optional ack
  });
  socket.on('disconnect', () => {
    console.log('🔌❌ [SOCKET] Client disconnected:', socket.id);
  });
});

module.exports = { app, server, io };




// // config/server.js
// const express = require('express');
// const http = require('http');
// const socketIO = require('socket.io');

// const app = express();
// const server = http.createServer(app);

// const io = socketIO(server, {
//   cors: {
//     origin: '*',
//     methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   },
// });

// app.set('io', io); // Make io available globally

// io.on('connection', (socket) => {
//   console.log('🔌 ✅ [SOCKET] Client connected:', socket.id);

//   const { userId } = socket.handshake.query || {};
//   if (userId) {
//     socket.join(userId);  // 🔑 join room by userId
//     console.log(`📌 User ${userId} joined room`);
//   }
// io.on('connection', (socket) => {
//   const { userId, role } = socket.handshake.query || {};
//   if (userId) socket.join(String(userId));    // user-scoped room
//   if (role === 'SALES_ADMIN') socket.join('admins'); // optional
// });

//   socket.on('disconnect', () => {
//     console.log('🔌❌ [SOCKET] Client disconnected:', socket.id);
//   });
// });


// module.exports = { app, server ,io };
