import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from './redis';

let io: SocketIOServer | null = null;

export function getSocketServer(): SocketIOServer | null {
  return io;
}

export async function initSocketServer(
  httpServer: ReturnType<typeof import('http').createServer>,
): Promise<SocketIOServer> {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL ?? '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  // Redis adapter for cross-instance messaging (required for multi-instance Railway)
  const pubClient = redis;
  const subClient = redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId as string | undefined;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Technician: join their own room for dispatch notifications
    socket.on('tech:online', (data: { userId: string; lat: number; lng: number }) => {
      socket.join(`tech:${data.userId}`);
    });

    // Technician: update location
    socket.on('tech:location', (data: { userId: string; lat: number; lng: number }) => {
      // Broadcast to admins/dispatchers watching this technician
      io?.to('dispatchers').emit('tech:location:update', data);
    });

    // Customer: subscribe to their request updates
    socket.on('request:watch', (data: { requestId: string }) => {
      socket.join(`request:${data.requestId}`);
    });

    socket.on('disconnect', () => {
      if (userId) socket.leave(`user:${userId}`);
    });
  });

  console.log('[Socket.IO] Server initialized with Redis adapter');
  return io;
}

/**
 * Notify a specific user (cross-instance via Redis).
 */
export function notifyUser(
  userId: string,
  event: string,
  data: Record<string, unknown>,
): void {
  io?.to(`user:${userId}`).emit(event, data);
}

/**
 * Notify all subscribers of a service request (cross-instance via Redis).
 */
export function notifyRequest(
  requestId: string,
  event: string,
  data: Record<string, unknown>,
): void {
  io?.to(`request:${requestId}`).emit(event, data);
}
