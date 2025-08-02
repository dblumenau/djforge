// Define the events that server can send to client
export interface ServerToClientEvents {
  // Random string event with payload structure
  randomString: (data: { 
    value: string;      // The random alphanumeric string
    timestamp: number;  // Unix timestamp when generated
  }) => void;
  
  // Connection status updates
  connectionStatus: (status: 'connected' | 'disconnected') => void;
  
  // Error events
  error: (data: { 
    message: string;    // Human-readable error message
    code?: string;      // Optional error code
  }) => void;
}

// Define the events that client can send to server
export interface ClientToServerEvents {
  // Ping event with acknowledgment callback
  ping: (callback: (response: { 
    status: 'ok'; 
    timestamp: number;
    serverTime: number;
  }) => void) => void;
  
  // Authentication event (sent immediately after connection)
  authenticate: (data: {
    sessionId: string;
  }, callback: (response: {
    success: boolean;
    userId?: string;
    error?: string;
  }) => void) => void;
}

// Socket-specific data stored per connection
export interface SocketData {
  connectionTime: number;  // When socket connected
  pingCount: number;       // Number of pings from this client
  ipAddress?: string;      // Client IP for rate limiting
  userId?: string;         // Authenticated user ID
  sessionId?: string;      // Session ID for auth validation
  authenticated: boolean;  // Whether socket has been authenticated
}

// WebSocket service configuration
export interface WebSocketConfig {
  namespace: string;       // Socket.IO namespace (e.g., '/demo')
  corsOrigins: string[];   // Allowed CORS origins
  maxPingsPerClient: number; // Max pings before disconnect
  maxConnectionsPerIP: number; // Rate limiting per IP
  randomStringInterval: {
    min: number;  // Minimum seconds between emissions
    max: number;  // Maximum seconds between emissions
  };
}