// These types MUST match the backend exactly
// Copy from server/src/types/websocket.types.ts

// Spotify track type (matches what we use elsewhere)
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
  uri: string;
  external_urls?: {
    spotify: string;
  };
}

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

// Music-specific WebSocket events
export interface MusicServerToClientEvents {
  playbackStateChanged: (data: {
    isPlaying: boolean;
    track: SpotifyTrack | null;
    position: number;
    duration: number;
    device: string;
    shuffleState: boolean;
    repeatState: 'off' | 'track' | 'context';
    volume: number;
    timestamp: number;
  }) => void;
  
  trackChanged: (data: {
    previous: SpotifyTrack | null;
    current: SpotifyTrack;
    source: 'user' | 'ai' | 'auto';
    reasoning?: string;
    isAIDiscovery?: boolean;
    timestamp: number;
  }) => void;
  
  queueUpdated: (data: {
    action: 'added' | 'removed' | 'cleared';
    tracks?: SpotifyTrack[];
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
}

// Events from client to server
export interface MusicClientToServerEvents {
  subscribeToPlayback: (callback: (response: { status: string }) => void) => void;
  unsubscribeFromPlayback: (callback: (response: { status: string }) => void) => void;
  requestPlaybackSync: (callback: (response: { playbackState: any }) => void) => void;
}