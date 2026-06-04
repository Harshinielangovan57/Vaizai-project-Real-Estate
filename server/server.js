require('dotenv').config();
const http      = require('http');
const { Server } = require('socket.io');
const app       = require('./app');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible inside controllers via req.app.get('io')
app.set('io', io);

// ✅ Register ALL event listeners here — pass io in
const registerEventListeners = require('./event/eventListeners');
try {
  registerEventListeners(io);
} catch (err) {
  console.error('[Server] Failed to register blockchain event listeners:', err.message);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

io.on('connection', (socket) => {
  // Frontend sends { userId } after auth to join their personal room
  socket.on('join:user', ({ userId }) => {
    if (userId) {
      socket.join(userId);
      console.log(`[Socket.io] User ${userId} joined their room`);
    }
    
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});