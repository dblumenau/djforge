import { io, Socket } from 'socket.io-client';
import type { MusicServerToClientEvents, MusicClientToServerEvents } from '../types/websocket.types';

// Determine the WebSocket URL based on environment (matches demo socket pattern)
const getWebSocketURL = (): string => {
  // Check for environment variable first
  if (import.meta.env.VITE_WEBSOCKET_URL) {
    return import.meta.env.VITE_WEBSOCKET_URL;
  }
  
  // Check for API URL and use that (since WebSocket runs on the same server as API)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In production, use the djforge-server URL
  if (import.meta.env.PROD) {
    return 'https://djforge-server.fly.dev';
  }
  
  // In development, default to localhost
  return 'http://localhost:4001';
};

const WEBSOCKET_URL = getWebSocketURL();
const NAMESPACE = '/music';

// Get session ID for auth
const getSessionId = (): string | null => {
  return localStorage.getItem('spotify_session_id');
};

// Create music socket instance (singleton)
export const musicSocket: Socket<MusicServerToClientEvents, MusicClientToServerEvents> = io(
  `${WEBSOCKET_URL}${NAMESPACE}`,
  {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    auth: (cb) => {
      const sessionId = getSessionId();
      cb({ sessionId });
    }
  }
);

// Debug logging in development
if (import.meta.env.DEV) {
  musicSocket.on('connect', () => {
    console.log('[Music Socket] Connected to server', {
      id: musicSocket.id,
      transport: musicSocket.io.engine.transport.name
    });
  });

  musicSocket.on('disconnect', (reason) => {
    console.log('[Music Socket] Disconnected from server', { reason });
  });

  musicSocket.on('connect_error', (error) => {
    console.error('[Music Socket] Connection error', {
      message: error.message,
      type: error.name
    });
  });
}

// Utility functions
export const isMusicSocketConnected = (): boolean => musicSocket.connected;
export const getMusicSocketId = (): string | undefined => musicSocket.id;
export const getMusicTransport = (): string | undefined => {
  return musicSocket.io.engine?.transport?.name;
};

// Update auth when session changes
export const updateMusicSocketAuth = (): void => {
  const sessionId = getSessionId();
  musicSocket.auth = { sessionId };
  
  // If connected, reconnect with new auth
  if (musicSocket.connected) {
    console.log('[Music Socket] Reconnecting with updated auth');
    musicSocket.disconnect();
    musicSocket.connect();
  }
};