import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export type DeviceRoom = 'waiter' | 'kitchen' | 'bar' | 'scale' | 'tpv';

export function useSocket(room: DeviceRoom, handlers: Record<string, (data: any) => void>) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    // En dev: path = '/socket.io' (proxy Vite)
    // En prod: path = '/fryshop/socket.io' (Caddy strip → /socket.io en backend)
    const basePath = import.meta.env.VITE_BASE_PATH ?? '';
    const socket = io({
      path: `${basePath}/socket.io`,
      query: { room },
    });
    socketRef.current = socket;

    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => { socket.disconnect(); };
  }, [room]);

  return socketRef;
}
