// These types MUST match the backend exactly
// Copy from server/src/types/websocket.types.ts

export interface ServerToClientEvents {
  randomString: (data: { 
    value: string; 
    timestamp: number 
  }) => void;
  connectionStatus: (status: 'connected' | 'disconnected') => void;
  error: (data: { 
    message: string;
    code?: string;
  }) => void;
}

export interface ClientToServerEvents {
  ping: (callback: (response: { 
    status: 'ok'; 
    timestamp: number;
    serverTime: number;
  }) => void) => void;
  
  authenticate: (data: {
    sessionId: string;
  }, callback: (response: {
    success: boolean;
    userId?: string;
    error?: string;
  }) => void) => void;
}