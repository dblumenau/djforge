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

// Create typed socket instance for /demo namespace (singleton pattern)
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

// Create a separate socket connection for the /music namespace
export const musicSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `${WEBSOCKET_URL}/music`,
  {
    // Don't connect automatically - let components manage it
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
  // Debug logging for /demo namespace
  socket.on('connect', () => {
    console.log('[Socket.IO Demo] Connected to /demo namespace', {
      id: socket.id,
      transport: socket.io.engine.transport.name
    });
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket.IO Demo] Disconnected from /demo namespace', { reason });
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket.IO Demo] Connection error', {
      message: error.message,
      type: error.name
    });
  });

  // Debug logging for /music namespace
  musicSocket.on('connect', () => {
    console.log('[Socket.IO Music] Connected to /music namespace', {
      id: musicSocket.id,
      transport: musicSocket.io.engine.transport.name
    });
  });

  musicSocket.on('disconnect', (reason) => {
    console.log('[Socket.IO Music] Disconnected from /music namespace', { reason });
  });

  musicSocket.on('connect_error', (error) => {
    console.error('[Socket.IO Music] Connection error', {
      message: error.message,
      type: error.name
    });
  });
}

// Export utility functions for /demo namespace
export const isSocketConnected = (): boolean => socket.connected;
export const getSocketId = (): string | undefined => socket.id;
export const getTransport = (): string | undefined => {
  return socket.io.engine?.transport?.name;
};

// Export utility functions for /music namespace
export const isMusicSocketConnected = (): boolean => musicSocket.connected;
export const getMusicSocketId = (): string | undefined => musicSocket.id;
export const getMusicTransport = (): string | undefined => {
  return musicSocket.io.engine?.transport?.name;
};

// Update authentication when session changes
export const updateSocketAuth = (): void => {
  const sessionId = getSessionId();
  
  // Update auth for both sockets
  socket.auth = { sessionId };
  musicSocket.auth = { sessionId };
  
  // If connected, reconnect with new auth
  if (socket.connected) {
    console.log('[Socket.IO Demo] Reconnecting with updated auth');
    socket.disconnect();
    socket.connect();
  }
  
  if (musicSocket.connected) {
    console.log('[Socket.IO Music] Reconnecting with updated auth');
    musicSocket.disconnect();
    musicSocket.connect();
  }
};