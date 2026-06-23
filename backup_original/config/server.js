// config/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // <- v4 import preferred

const app = express();
const server = http.createServer(app);

// trust X-Forwarded-* so ws/wss + real IP work (behind nginx/proxy)
app.set('trust proxy', true);

// --- Socket.IO server ---
const io = new Server(server, {
  // IMPORTANT: keep this consistent with client & proxy
  path: '/socket.io/',

  // Allow upgrade to websocket; polling stays as fallback
  transports: ['websocket', 'polling'],

  // CORS (tighten in prod)
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false,
  },

  // Stability tweaks (tune if needed)
  pingInterval: 25000, // default 25000
  pingTimeout: 20000,  // default 20000
  connectTimeout: 10000,

  // If any legacy EIO3 clients (older socket.io-client) still connect:
  // allowEIO3: true,
});

// expose io to controllers/services via req.app.get('io')
app.set('io', io);

// Simple probe to verify polling works from a browser
app.get('/socket.io/health', (req, res) =>
  res.json({ ok: true, ts: Date.now() })
);

io.on('connection', (socket) => {
  console.log('🔌 ✅ [SOCKET] Client connected:', socket.id, socket.handshake.query);

  const { userId, role ,salesRepKey ,branchManagerId   } = socket.handshake.query || {};

  if (userId) {
    socket.join(String(userId));
    console.log(`📌 User ${userId} joined room`);
  }
  if (role) socket.join(`role:${role}`);
  if (salesRepKey) socket.join(`rep:${salesRepKey}`);  // 👈 add this
  // ✅ branch manager–scoped room (for BO requests)
  if (branchManagerId) socket.join(`bm:${branchManagerId}`);

  // ✅ treat ADMIN and SUPER_ADMIN as "admins" room (not just SALES_ADMIN)
  if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SALES_ADMIN') {
    socket.join('admins');
    console.log('👮 Joined admins room');
  }

  socket.on('admin_subscribe', () => {
    socket.join('admins');
    console.log('👮 joined admins (via event)');
    socket.emit('admin_subscribed', true);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌❌ [SOCKET] Disconnected:', socket.id, 'reason:', reason);
  });
});

module.exports = { app, server, io };

// // config/server.js
// const express = require('express');
// const http = require('http');
// const socketIO = require('socket.io');

// const app = express();
// const server = http.createServer(app);

// // trust X-Forwarded-* so ws/wss + real IP work
// app.set('trust proxy', true);

// const io = socketIO(server, {
//     // path: '/socket.io', // keep default unless you changed it
//   cors: {
//     origin: '*', // TODO: lock down in prod
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   },
// });

// // expose io to controllers/services via req.app.get('io')
// app.set('io', io);

// // OPTIONAL: if you ever truly need >10 listeners on one emitter
// // require('events').EventEmitter.defaultMaxListeners = 30;
// // io.setMaxListeners(30);

// io.on('connection', (socket) => {
//   console.log('🔌 ✅ [SOCKET] Client connected:', socket.id);

//   const { userId, role } = socket.handshake.query || {};
//    if (userId) socket.join(`${userId}`);
//   if (role) socket.join(`role:${role}`);
//   // join per-user room
//   if (userId) {
//     socket.join(String(userId));
//     console.log(`📌 User ${userId} joined room`);
//   }

//   // keep role support (not required now, but harmless)
//   if (role === 'SALES_ADMIN') {
//     socket.join('admins');
//     console.log('👮 Joined admins room');
//   }
//  // also support explicit subscribe from the client
//   socket.on('admin_subscribe', () => {
//     socket.join('admins');
//     console.log('👮 joined admins (via event)');
//     socket.emit('admin_subscribed', true); // optional ack
//   });
//   socket.on('disconnect', () => {
//     console.log('🔌❌ [SOCKET] Client disconnected:', socket.id);
//   });
// });

// module.exports = { app, server, io };




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
