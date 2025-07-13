import axios, { AxiosInstance } from 'axios';
import { SpotifyAuthTokens, SpotifyTrack } from '../types';
import { refreshAccessToken } from './auth';

export interface SpotifyDevice {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number;
}

export interface PlaybackState {
  device: SpotifyDevice;
  shuffle_state: boolean;
  repeat_state: 'off' | 'track' | 'context';
  timestamp: number;
  context: any;
  progress_ms: number;
  item: SpotifyTrack | null;
  currently_playing_type: string;
  is_playing: boolean;
}

export class SpotifyWebAPI {
  private api: AxiosInstance;
  private tokens: SpotifyAuthTokens;
  private onTokenRefresh: (tokens: SpotifyAuthTokens) => void;
  private deviceId?: string;

  constructor(
    tokens: SpotifyAuthTokens,
    onTokenRefresh: (tokens: SpotifyAuthTokens) => void
  ) {
    this.tokens = tokens;
    this.onTokenRefresh = onTokenRefresh;
    
    this.api = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    // Add response interceptor for token refresh
    this.api.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401 && this.tokens.refresh_token) {
          try {
            const newTokens = await refreshAccessToken(this.tokens.refresh_token);
            this.tokens = { ...this.tokens, ...newTokens };
            this.onTokenRefresh(this.tokens);
            
            // Retry original request with new token
            error.config.headers['Authorization'] = `Bearer ${newTokens.access_token}`;
            return this.api.request(error.config);
          } catch (refreshError) {
            throw refreshError;
          }
        }
        throw error;
      }
    );
  }

  async search(query: string, types: string[] = ['track']): Promise<any[]> {
    const response = await this.api.get('/search', {
      params: {
        q: query,
        type: types.join(','),
        limit: 10
      }
    });

    // Return the appropriate items based on search type
    if (types.includes('playlist')) {
      const playlists = response.data.playlists?.items || [];
      console.log(`[DEBUG] Spotify API returned ${playlists.length} playlists`);
      if (playlists.length > 0) {
        console.log(`[DEBUG] First playlist structure:`, JSON.stringify(playlists[0], null, 2));
      }
      return playlists;
    } else if (types.includes('album')) {
      return response.data.albums?.items || [];
    } else if (types.includes('artist')) {
      return response.data.artists?.items || [];
    } else {
      return response.data.tracks?.items || [];
    }
  }

  async getRecommendations(trackId: string): Promise<SpotifyTrack[]> {
    const response = await this.api.get('/recommendations', {
      params: {
        seed_tracks: trackId,
        limit: 20
      }
    });

    return response.data.tracks || [];
  }


  async getDevices() {
    const response = await this.api.get('/me/player/devices');
    return response.data.devices || [];
  }

  async addToQueue(uri: string) {
    await this.api.post('/me/player/queue', null, {
      params: { uri }
    });
  }

  async getPlaylists() {
    const response = await this.api.get('/me/playlists', {
      params: { limit: 50 }
    });
    return response.data.items || [];
  }

  async getPlaylistTracks(playlistId: string) {
    const response = await this.api.get(`/playlists/${playlistId}/tracks`, {
      params: { limit: 100 }
    });
    return response.data.items || [];
  }

  async getRecentlyPlayed() {
    const response = await this.api.get('/me/player/recently-played', {
      params: { limit: 50 }
    });
    return response.data.items || [];
  }

  // Playback control methods to replace AppleScript
  async ensureDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;
    
    const devices = await this.getDevices();
    if (devices.length === 0) {
      throw new Error('No active Spotify devices found. Please open Spotify on a device.');
    }
    
    // Prefer active device, otherwise use first available
    const activeDevice = devices.find((d: SpotifyDevice) => d.is_active);
    const selectedDeviceId = activeDevice ? activeDevice.id : devices[0].id;
    this.deviceId = selectedDeviceId;
    
    return selectedDeviceId;
  }

  async play(deviceId?: string): Promise<void> {
    const device = deviceId || await this.ensureDeviceId();
    try {
      await this.api.put('/me/player/play', {}, {
        params: { device_id: device }
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No active device found. Please open Spotify on a device.');
      }
      throw error;
    }
  }

  async pause(): Promise<void> {
    try {
      await this.api.put('/me/player/pause');
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No active device found.');
      }
      throw error;
    }
  }

  async nextTrack(): Promise<void> {
    try {
      await this.api.post('/me/player/next');
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No active device found.');
      }
      throw error;
    }
  }

  async previousTrack(): Promise<void> {
    try {
      await this.api.post('/me/player/previous');
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No active device found.');
      }
      throw error;
    }
  }

  async setVolume(volumePercent: number, deviceId?: string): Promise<void> {
    const volume = Math.max(0, Math.min(100, Math.round(volumePercent)));
    try {
      await this.api.put('/me/player/volume', null, {
        params: { 
          volume_percent: volume,
          device_id: deviceId
        }
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No active device found.');
      }
      throw error;
    }
  }

  async getCurrentPlayback(): Promise<PlaybackState | null> {
    try {
      const response = await this.api.get('/me/player');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 204) {
        return null; // No playback
      }
      throw error;
    }
  }

  async getVolume(): Promise<number> {
    const playback = await this.getCurrentPlayback();
    return playback?.device?.volume_percent || 0;
  }

  async setShuffle(state: boolean): Promise<void> {
    try {
      await this.api.put('/me/player/shuffle', null, {
        params: { state }
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No active device found.');
      }
      throw error;
    }
  }

  async setRepeat(state: 'off' | 'track' | 'context'): Promise<void> {
    try {
      await this.api.put('/me/player/repeat', null, {
        params: { state }
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No active device found.');
      }
      throw error;
    }
  }

  async playTrack(uri: string, deviceId?: string): Promise<void> {
    const device = deviceId || await this.ensureDeviceId();
    try {
      await this.api.put('/me/player/play', {
        uris: [uri]
      }, {
        params: { device_id: device }
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No active device found. Please open Spotify on a device.');
      }
      throw error;
    }
  }

  async playPlaylist(uri: string, deviceId?: string): Promise<void> {
    const device = deviceId || await this.ensureDeviceId();
    try {
      await this.api.put('/me/player/play', {
        context_uri: uri
      }, {
        params: { device_id: device }
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No active device found. Please open Spotify on a device.');
      }
      throw error;
    }
  }

  async transferPlayback(deviceId: string, play: boolean = true): Promise<void> {
    await this.api.put('/me/player', {
      device_ids: [deviceId],
      play
    });
    this.deviceId = deviceId;
  }

  async seekToPosition(positionMs: number): Promise<void> {
    try {
      await this.api.put('/me/player/seek', null, {
        params: { position_ms: positionMs }
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No active device found.');
      }
      throw error;
    }
  }

  async clearQueue(): Promise<void> {
    // Workaround: Get current playing track and re-play just that track
    // This effectively clears the queue since playing with 'uris' replaces the queue
    const playback = await this.getCurrentPlayback();
    
    if (!playback || !playback.item) {
      // Nothing playing, nothing to clear
      return;
    }

    // Get current position to resume from the same spot
    const currentPosition = playback.progress_ms || 0;
    const currentTrackUri = playback.item.uri;
    
    // Play just the current track (this replaces the entire queue)
    await this.playTrack(currentTrackUri);
    
    // Seek back to the position we were at
    if (currentPosition > 0) {
      // Small delay to ensure play command has processed
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.seekToPosition(currentPosition);
    }
  }
}