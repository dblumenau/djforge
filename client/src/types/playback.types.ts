/**
 * TypeScript types for playback controls
 */

export interface PlaybackState {
  isPlaying: boolean;
  track: {
    name: string;
    artist: string;
    artists?: Array<{
      name: string;
      id: string;
      uri?: string;
      external_urls?: {
        spotify: string;
      };
    }>;
    album: string;
    albumId?: string;
    albumUri?: string;
    albumArt?: string | null;
    releaseDate?: string;
    duration: number;
    position: number;
    id?: string;
    uri?: string;
    external_urls?: {
      spotify: string;
    };
    popularity?: number;
    preview_url?: string;
    track_number?: number;
    disc_number?: number;
  } | null;
  shuffleState: boolean;
  repeatState: 'off' | 'track' | 'context';
  volume: number;
}

export interface PlaybackControlsProps {
  onShowQueue?: () => void;
  isMobile?: boolean;
  devicePreference?: string;
  hideHeaderControls?: boolean;
}

export interface PlaybackControlsRef {
  enterFullscreen: () => void;
  refresh: () => void;
}

export type ViewMode = 'minimized' | 'normal' | 'fullscreen';