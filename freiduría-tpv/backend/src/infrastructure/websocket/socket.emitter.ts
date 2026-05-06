import { getIO } from './socket.server';
import type { DeviceRoom } from './socket.server';

export function emitToRoom(room: DeviceRoom, event: string, payload: unknown): void {
  try {
    getIO().to(room).emit(event, payload);
  } catch {
    // Not initialized in test environments — fail silently
  }
}
