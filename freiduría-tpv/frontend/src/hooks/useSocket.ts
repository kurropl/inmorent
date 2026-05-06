import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export type DeviceRoom = 'waiter' | 'kitchen' | 'bar' | 'scale' | 'tpv';

export function useSocket(room: DeviceRoom, handlers: Record<string, (data: any) => void>) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = io({ query: { room } });
    socketRef.current = socket;

    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => { socket.disconnect(); };
  }, [room]);

  return socketRef;
}
