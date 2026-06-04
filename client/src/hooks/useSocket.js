// src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';

const API = import.meta.env.VITE_API_URL;

let globalSocket = null; // module-level singleton

/**
 * useSocket
 *
 * Returns the singleton Socket.io client, authenticated with the current
 * JWT token via the auth handshake.  The socket is created once and reused
 * across all components; it disconnects when the user logs out.
 */
export function useSocket() {
  const { token, isAuthenticated } = useSelector((s) => s.auth);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      // Disconnect if already connected and user logged out
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
      }
      return;
    }

    // Reuse existing connection if token hasn't changed
    if (globalSocket && globalSocket.connected) {
      socketRef.current = globalSocket;
      return;
    }

    // Create new connection
    globalSocket = io(API, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    globalSocket.on('connect', () => {
      console.log('[Socket] Connected:', globalSocket.id);
    });

    globalSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    globalSocket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    socketRef.current = globalSocket;

    return () => {
      // Don't disconnect on component unmount — socket is a singleton.
      // Only disconnect on logout (handled above when !isAuthenticated).
    };
  }, [isAuthenticated, token]);

  return socketRef.current;
}

/**
 * useSocketEvent
 *
 * Subscribes to a single socket event and calls the handler whenever
 * the event fires.  Cleans up the listener on unmount.
 *
 * Usage:
 *   useSocketEvent('bid:new', (data) => setBids(...));
 */
export function useSocketEvent(event, handler) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, event, handler]);
}