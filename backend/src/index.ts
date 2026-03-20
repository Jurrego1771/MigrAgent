import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO para actualizaciones en tiempo real
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (config.isDev) {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe:migration', (migrationId: string) => {
    socket.join(`migration:${migrationId}`);
    console.log(`Client ${socket.id} subscribed to migration ${migrationId}`);
  });

  socket.on('unsubscribe:migration', (migrationId: string) => {
    socket.leave(`migration:${migrationId}`);
    console.log(`Client ${socket.id} unsubscribed from migration ${migrationId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Export io for use in services
export { io };

// Start server
httpServer.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Helpper Migrator API Server                             ║
║                                                           ║
║   Running on: http://localhost:${config.port}                   ║
║   Environment: ${config.nodeEnv}                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
