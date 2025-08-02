export interface SpotifyAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
    uri?: string;
    external_urls?: {
      spotify: string;
    };
  }>;
  album: {
    id: string;
    name: string;
    uri?: string;
    release_date?: string;
    images: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  };
  duration_ms: number;
  uri: string;
  external_urls?: {
    spotify: string;
  };
  popularity?: number;
  preview_url?: string;
  track_number?: number;
  disc_number?: number;
}

export interface CurrentPlayback {
  isPlaying: boolean;
  track: SpotifyTrack | null;
  progress_ms: number;
  device: {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
  } | null;
}

export interface ClaudeCommand {
  intent: 'play' | 'pause' | 'skip' | 'previous' | 'volume' | 'search' | 'queue' | 'info' | 'shuffle' | 'repeat' | 'unknown';
  query?: string;
  value?: number;
  confidence: number;
  isAIDiscovery?: boolean;  // true when AI made creative choice
  aiReasoning?: string;     // explanation of why AI chose this
}

export interface AIDiscoveredTrack {
  trackUri: string;
  trackName: string;
  artist: string;
  discoveredAt: number;
  reasoning: string;        // AI's explanation of why it chose this
  feedback?: 'loved' | 'disliked' | 'blocked';  // Only stored if user gave feedback
  feedbackAt?: number;
  previewUrl?: string;      // 30-second preview URL from Spotify API
}

// WebSocket types
export * from './websocket.types';

declare module 'express-session' {
  interface SessionData {
    spotifyTokens?: SpotifyAuthTokens;
    spotifyUserId?: string;
    codeVerifier?: string;
    tokenTimestamp?: number;
    preferredModel?: string;
  }
}