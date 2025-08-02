import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../types/websocket.types';

// Determine the WebSocket URL based on environment
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
const NAMESPACE = '/demo';

// Function to get the session ID from localStorage
const getSessionId = (): string | null => {
  return localStorage.getItem('spotify_session_id');
};

// Create typed socket instance (singleton pattern)
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `${WEBSOCKET_URL}${NAMESPACE}`,
  {
    // Don't connect automatically - let the hook manage it
    autoConnect: false,
    
    // Transport options (try WebSocket first, fall back to polling)
    transports: ['websocket', 'polling'],
    
    // Reconnection settings
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    
    // Timeout settings
    timeout: 20000,
    
    // Authentication - send session ID with connection
    auth: (cb) => {
      const sessionId = getSessionId();
      cb({ sessionId });
    }
  }
);

// Debug logging in development
if (import.meta.env.DEV) {
  socket.on('connect', () => {
    console.log('[Socket.IO] Connected to server', {
      id: socket.id,
      transport: socket.io.engine.transport.name
    });
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket.IO] Disconnected from server', { reason });
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket.IO] Connection error', {
      message: error.message,
      type: error.name
    });
  });
}

// Export utility functions
export const isSocketConnected = (): boolean => socket.connected;
export const getSocketId = (): string | undefined => socket.id;
export const getTransport = (): string | undefined => {
  return socket.io.engine?.transport?.name;
};

// Update authentication when session changes
export const updateSocketAuth = (): void => {
  const sessionId = getSessionId();
  socket.auth = { sessionId };
  
  // If connected, reconnect with new auth
  if (socket.connected) {
    console.log('[Socket.IO] Reconnecting with updated auth');
    socket.disconnect();
    socket.connect();
  }
};