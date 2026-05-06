import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

let io: SocketServer;

export const ROOMS = ['waiter', 'bar', 'kitchen', 'scale', 'tpv'] as const;
export type DeviceRoom = (typeof ROOMS)[number];

export function initSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN ?? '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    const room = socket.handshake.query.room as DeviceRoom;
    if (room && ROOMS.includes(room)) {
      socket.join(room);
      console.log(`[WS] ${socket.id} joined room: ${room}`);
    }
    socket.on('disconnect', () => console.log(`[WS] ${socket.id} disconnected`));
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
