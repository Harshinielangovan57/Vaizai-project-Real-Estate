require('dotenv').config();
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const app        = require('./app');

const PORT = process.env.PORT || 5000;

/* ─── MongoDB ────────────────────────────────────────────────────────── */
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected ✅');
    startServer();
  })
  .catch((err) => {
    console.error('MongoDB connection error ❌:', err.message);
    process.exit(1);
  });

/* ─── Start server only after MongoDB is ready ───────────────────────── */
function startServer() {
  const server = http.createServer(app);

  /* ─── Socket.io ──────────────────────────────────────────────────── */
  const io = new Server(server, {
    cors: {
      origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
  });

  // Make io accessible in controllers via req.app.get('io')
  app.set('io', io);

  /* ─── Socket.io connection handler ──────────────────────────────── */
  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Frontend joins personal room after login
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

  /* ─── Blockchain event listeners ────────────────────────────────── */
  try {
    const registerEventListeners = require('./event/eventListeners');
    registerEventListeners(io);
  } catch (err) {
    console.error('[Server] Failed to register blockchain event listeners:', err.message);
  }

  /* ─── Listen ─────────────────────────────────────────────────────── */
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} ✅`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
}