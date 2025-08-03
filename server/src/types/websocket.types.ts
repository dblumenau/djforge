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
  
  // Music namespace events
  playbackStateChanged: (data: {
    isPlaying: boolean;
    track: any | null; // Using 'any' to match existing SpotifyTrack usage
    position: number;
    duration: number;
    device: string;
    shuffleState: boolean;
    repeatState: 'off' | 'track' | 'context';
    volume: number;
    timestamp: number;
  }) => void;
  
  trackChanged: (data: {
    previous: any | null; // Using 'any' to match existing SpotifyTrack usage
    current: any;
    source: 'user' | 'ai' | 'auto';
    reasoning?: string;
    isAIDiscovery?: boolean;
    timestamp: number;
  }) => void;
  
  queueUpdated: (data: {
    action: 'added' | 'removed' | 'cleared';
    tracks?: any[]; // Using 'any' to match existing SpotifyTrack usage
    trackUris?: string[];
    totalItems: number;
    source: 'user' | 'ai';
    timestamp: number;
  }) => void;
  
  volumeChanged: (data: {
    volume: number;
    device: string;
    timestamp: number;
  }) => void;
  
  commandExecuted: (data: {
    command: string;
    intent: string;
    success: boolean;
    confidence: number;
    result?: any;
    error?: string;
    timestamp: number;
  }) => void;
  
  deviceChanged: (data: {
    previousDevice: string | null;
    currentDevice: string;
    timestamp: number;
  }) => void;
  
  // Playlist discovery progress updates
  playlistDiscoveryProgress: (data: {
    sessionId: string;                    // Ensures user only sees their own progress
    step: string;                         // Current step description
    phase: 'searching' | 'analyzing' | 'fetching' | 'summarizing' | 'complete'; // Current phase
    currentItem?: string;                 // Optional current playlist being processed
    itemNumber?: number;                  // Optional X of Y counter
    totalItems?: number;                  // Optional total items count
    metadata?: {                          // Optional metadata object
      model?: string;                     // Which AI model is being used
      cacheHit?: boolean;                 // Was this data cached
      processingTime?: number;            // How long this step took in ms
      tokensUsed?: number;                // Tokens for this specific call
    };
    timestamp: number;                    // Unix timestamp
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
  
  // Music namespace events
  subscribeToPlayback: (callback: (response: { status: string }) => void) => void;
  unsubscribeFromPlayback: (callback: (response: { status: string }) => void) => void;
  requestPlaybackSync: (callback: (response: { playbackState: any }) => void) => void;
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