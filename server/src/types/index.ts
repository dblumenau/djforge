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
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  };
  duration_ms: number;
  uri: string;
  popularity?: number;
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
}

declare module 'express-session' {
  interface SessionData {
    spotifyTokens?: SpotifyAuthTokens;
    codeVerifier?: string;
    tokenTimestamp?: number;
  }
}