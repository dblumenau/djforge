import axios, { AxiosInstance } from 'axios';
import { SpotifyAuthTokens, SpotifyTrack } from '../types';
// Token refresh is now handled by the session-auth middleware

// Spotify API response interfaces
export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  type: 'artist';
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
  genres?: string[];
  popularity?: number;
  followers?: {
    total: number;
  };
  images?: SpotifyImage[];
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  type: 'album';
  uri: string;
  href: string;
  album_type: 'album' | 'single' | 'compilation';
  total_tracks: number;
  available_markets: string[];
  external_urls: {
    spotify: string;
  };
  images: SpotifyImage[];
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  artists: SpotifyArtist[];
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  type: 'playlist';
  uri: string;
  href: string;
  description: string | null;
  public: boolean;
  collaborative: boolean;
  external_urls: {
    spotify: string;
  };
  images: SpotifyImage[];
  owner: {
    id: string;
    display_name: string;
    type: 'user';
  };
  tracks: {
    href: string;
    total: number;
  };
}

export interface SpotifySearchResponse {
  tracks?: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
    next: string | null;
    previous: string | null;
  };
  artists?: {
    items: SpotifyArtist[];
    total: number;
    limit: number;
    offset: number;
    next: string | null;
    previous: string | null;
  };
  albums?: {
    items: SpotifyAlbum[];
    total: number;
    limit: number;
    offset: number;
    next: string | null;
    previous: string | null;
  };
  playlists?: {
    items: SpotifyPlaylist[];
    total: number;
    limit: number;
    offset: number;
    next: string | null;
    previous: string | null;
  };
}

export interface SpotifyPlaybackContext {
  type: 'artist' | 'playlist' | 'album' | 'show' | 'episode';
  href: string;
  external_urls: {
    spotify: string;
  };
  uri: string;
}

export interface SpotifyUser {
  id: string;
  display_name?: string;
  email?: string;
  type: 'user';
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
  followers?: {
    total: number;
  };
  images?: SpotifyImage[];
  country?: string;
  product?: string;
}

export interface SpotifyQueueResponse {
  currently_playing: SpotifyTrack | null;
  queue: SpotifyTrack[];
}

export interface SpotifyPlaylistTrackItem {
  track: SpotifyTrack;
  added_at: string;
  added_by: {
    id: string;
    type: 'user';
  };
  is_local: boolean;
}

export interface SpotifyRecentlyPlayedItem {
  track: SpotifyTrack;
  played_at: string;
  context: SpotifyPlaybackContext | null;
}

export interface SpotifyDevicesResponse {
  devices: SpotifyDevice[];
}

export interface SpotifyTopItemsResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
}

export interface SpotifySavedTracksResponse {
  items: Array<{
    added_at: string;
    track: SpotifyTrack;
  }>;
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
}

export interface SpotifySavedAlbumsResponse {
  items: Array<{
    added_at: string;
    album: SpotifyAlbum;
  }>;
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
}

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
  context: SpotifyPlaybackContext | null;
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
  private devicePreference: 'auto' | string = 'auto';
  private lastActiveDeviceId?: string;
  private isRetrying = false;

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

    // Add response interceptor for 401 retry logic
    this.api.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;
        
        // Check if this is a 401 and we haven't already retried
        if (error.response?.status === 401 && !originalRequest._retry) {
          console.log('🔄 Got 401 response, retrying once with current token...');
          originalRequest._retry = true;
          
          // Update the authorization header with current token
          // (in case the axios instance header is stale)
          originalRequest.headers['Authorization'] = `Bearer ${this.tokens.access_token}`;
          
          try {
            // Retry the original request once
            const retryResponse = await this.api(originalRequest);
            console.log('✅ Retry successful after 401');
            return retryResponse;
          } catch (retryError) {
            console.error('❌ Retry failed, token may be genuinely expired');
            // Throw the original 401 error
            throw error;
          }
        }
        
        throw error;
      }
    );
  }

  async search(query: string, types: string[] = ['track']): Promise<SpotifyTrack[] | SpotifyArtist[] | SpotifyAlbum[] | SpotifyPlaylist[]> {
    const response = await this.api.get<SpotifySearchResponse>('/search', {
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

  async getCurrentUser(): Promise<SpotifyUser> {
    try {
      const response = await this.api.get<SpotifyUser>('/me');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get current user:', error.response?.data || error.message);
      throw new Error('Failed to fetch user profile from Spotify');
    }
  }

  async getDevices(): Promise<SpotifyDevice[]> {
    const response = await this.api.get<SpotifyDevicesResponse>('/me/player/devices');
    const devices = response.data.devices || [];
    return devices;
  }

  async addToQueue(uri: string): Promise<void> {
    await this.api.post('/me/player/queue', null, {
      params: { uri }
    });
  }

  async getQueue(): Promise<SpotifyQueueResponse> {
    try {
      const response = await this.api.get<SpotifyQueueResponse>('/me/player/queue');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get queue:', error);
      throw error;
    }
  }

  async getPlaylists(): Promise<SpotifyPlaylist[]> {
    const response = await this.api.get<{ items: SpotifyPlaylist[] }>('/me/playlists', {
      params: { limit: 50 }
    });
    return response.data.items || [];
  }

  async getPlaylistTracks(playlistId: string): Promise<SpotifyPlaylistTrackItem[]> {
    const response = await this.api.get<{ items: SpotifyPlaylistTrackItem[] }>(`/playlists/${playlistId}/tracks`, {
      params: { limit: 100 }
    });
    return response.data.items || [];
  }

  async getRecentlyPlayed(): Promise<SpotifyRecentlyPlayedItem[]> {
    const response = await this.api.get<{ items: SpotifyRecentlyPlayedItem[] }>('/me/player/recently-played', {
      params: { limit: 50 }
    });
    return response.data.items || [];
  }

  // Playback control methods to replace AppleScript
  async ensureDeviceId(): Promise<string> {
    console.log('[DEVICE] Ensuring device ID for playback...');
    console.log(`[DEVICE] Device preference: ${this.devicePreference}`);
    
    if (this.deviceId && this.devicePreference !== 'auto') {
      console.log(`[DEVICE] Using cached device ID: ${this.deviceId}`);
      return this.deviceId;
    }
    
    const devices = await this.getDevices();
    if (devices.length === 0) {
      console.log('[DEVICE] ERROR: No devices found!');
      throw new Error('No active Spotify devices found. Please open Spotify on a device or use the web player.');
    }
    
    // Find active device
    const activeDevice = devices.find((d: SpotifyDevice) => d.is_active);
    
    // Update last active device if we found one
    if (activeDevice) {
      this.lastActiveDeviceId = activeDevice.id;
      console.log(`[DEVICE] Tracking active device: "${activeDevice.name}"`);
    }
    
    // Find web player device
    const webPlayerDevice = devices.find((d: SpotifyDevice) => 
      d.name === 'DJForge Web Player' || d.name.toLowerCase().includes('web player')
    );
    
    let selectedDevice: SpotifyDevice | undefined;
    let selectionReason: string = '';
    
    // Handle device preference
    if (this.devicePreference !== 'auto') {
      // Manual device selection
      selectedDevice = devices.find((d: SpotifyDevice) => d.id === this.devicePreference);
      if (selectedDevice) {
        selectionReason = 'Manual device preference';
      } else {
        console.log(`[DEVICE] Preferred device ${this.devicePreference} not found, falling back to auto`);
        this.devicePreference = 'auto';
      }
    }
    
    // Auto mode or fallback
    if (!selectedDevice) {
      if (activeDevice) {
        selectedDevice = activeDevice;
        selectionReason = 'Active device found (auto mode)';
      } else if (this.lastActiveDeviceId) {
        // Try to use last active device
        const lastDevice = devices.find((d: SpotifyDevice) => d.id === this.lastActiveDeviceId);
        if (lastDevice) {
          selectedDevice = lastDevice;
          selectionReason = 'Using last active device (auto mode)';
        }
      }
      
      // Still no device? Try web player
      if (!selectedDevice && webPlayerDevice) {
        selectedDevice = webPlayerDevice;
        selectionReason = 'Web player available (auto mode)';
      }
      
      // Final fallback
      if (!selectedDevice) {
        selectedDevice = devices[0];
        selectionReason = 'Using first available device (auto mode)';
      }
    }
    
    if (!selectedDevice) {
      throw new Error('No suitable device found');
    }
    
    console.log(`[DEVICE] Selected: "${selectedDevice.name}" (${selectedDevice.type})`);
    console.log(`[DEVICE] Reason: ${selectionReason}`);
    console.log(`[DEVICE] Device ID: ${selectedDevice.id}`);
    
    this.deviceId = selectedDevice.id;
    return selectedDevice.id;
  }
  
  setDevicePreference(preference: 'auto' | string): void {
    console.log(`[DEVICE] Setting device preference to: ${preference}`);
    this.devicePreference = preference;
    // Clear cached device ID if switching to auto mode
    if (preference === 'auto') {
      this.deviceId = undefined;
    }
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
  
  async playTracksWithUris(uris: string[], deviceId?: string): Promise<void> {
    const device = deviceId || await this.ensureDeviceId();
    try {
      await this.api.put('/me/player/play', {
        uris: uris
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
    console.log(`[DEVICE] Transferring playback to device: ${deviceId} (play: ${play})`);
    await this.api.put('/me/player', {
      device_ids: [deviceId],
      play
    });
    this.deviceId = deviceId;
    console.log('[DEVICE] Playback transferred successfully');
  }
  
  async getCurrentDevice(): Promise<SpotifyDevice | null> {
    const playback = await this.getCurrentPlayback();
    return playback?.device || null;
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

  async getUserProfile(): Promise<SpotifyUser> {
    const response = await this.api.get<SpotifyUser>('/me');
    return response.data;
  }

  // New methods for user data dashboard
  async getTopArtists(timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit: number = 20): Promise<SpotifyArtist[]> {
    const response = await this.api.get<SpotifyTopItemsResponse<SpotifyArtist>>('/me/top/artists', {
      params: { 
        time_range: timeRange, 
        limit 
      }
    });
    return response.data.items || [];
  }

  async getTopTracks(timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit: number = 20): Promise<SpotifyTrack[]> {
    const response = await this.api.get<SpotifyTopItemsResponse<SpotifyTrack>>('/me/top/tracks', {
      params: { 
        time_range: timeRange, 
        limit 
      }
    });
    return response.data.items || [];
  }

  async getSavedTracks(limit: number = 50, offset: number = 0): Promise<SpotifySavedTracksResponse> {
    const response = await this.api.get<SpotifySavedTracksResponse>('/me/tracks', {
      params: { 
        limit, 
        offset 
      }
    });
    return {
      items: response.data.items || [],
      total: response.data.total || 0,
      limit: response.data.limit,
      offset: response.data.offset,
      next: response.data.next,
      previous: response.data.previous
    };
  }

  async getSavedAlbums(limit: number = 50, offset: number = 0): Promise<SpotifySavedAlbumsResponse> {
    const response = await this.api.get<SpotifySavedAlbumsResponse>('/me/albums', {
      params: { 
        limit, 
        offset 
      }
    });
    return {
      items: response.data.items || [],
      total: response.data.total || 0,
      limit: response.data.limit,
      offset: response.data.offset,
      next: response.data.next,
      previous: response.data.previous
    };
  }

  // Playlist management methods
  async createPlaylist(name: string, description?: string, isPublic: boolean = false): Promise<SpotifyPlaylist> {
    const user = await this.getCurrentUser();
    const response = await this.api.post<SpotifyPlaylist>(`/users/${user.id}/playlists`, {
      name,
      description: description || '',
      public: isPublic
    });
    return response.data;
  }

  async addTracksToPlaylist(playlistId: string, trackUris: string[]): Promise<{ snapshot_id: string }> {
    const response = await this.api.post<{ snapshot_id: string }>(`/playlists/${playlistId}/tracks`, {
      uris: trackUris
    });
    return response.data;
  }

  async findPlaylistByName(name: string): Promise<SpotifyPlaylist | null> {
    const playlists = await this.getPlaylists();
    return playlists.find((playlist: SpotifyPlaylist) => playlist.name === name) || null;
  }

  async ensurePlaylistExists(name: string, description?: string): Promise<SpotifyPlaylist> {
    // Try to find existing playlist
    let playlist = await this.findPlaylistByName(name);
    
    if (!playlist) {
      // Create the playlist if it doesn't exist
      playlist = await this.createPlaylist(name, description, false);
      console.log(`Created new playlist: ${name} (ID: ${playlist.id})`);
    } else {
      console.log(`Found existing playlist: ${name} (ID: ${playlist.id})`);
    }
    
    return playlist;
  }

  // Library management methods
  async saveTracksToLibrary(trackIds: string[]): Promise<void> {
    if (trackIds.length === 0) return;
    
    try {
      // Spotify API allows max 50 tracks per request
      const chunks = [];
      for (let i = 0; i < trackIds.length; i += 50) {
        chunks.push(trackIds.slice(i, i + 50));
      }
      
      for (const chunk of chunks) {
        await this.api.put('/me/tracks', {
          ids: chunk
        });
      }
    } catch (error: any) {
      console.error('Failed to save tracks to library:', error.response?.data || error.message);
      throw new Error('Failed to save tracks to library');
    }
  }

  async removeTracksFromLibrary(trackIds: string[]): Promise<void> {
    if (trackIds.length === 0) return;
    
    try {
      // Spotify API allows max 50 tracks per request
      const chunks = [];
      for (let i = 0; i < trackIds.length; i += 50) {
        chunks.push(trackIds.slice(i, i + 50));
      }
      
      for (const chunk of chunks) {
        await this.api.delete('/me/tracks', {
          data: {
            ids: chunk
          }
        });
      }
    } catch (error: any) {
      console.error('Failed to remove tracks from library:', error.response?.data || error.message);
      throw new Error('Failed to remove tracks from library');
    }
  }

  async checkIfTracksSaved(trackIds: string[]): Promise<boolean[]> {
    if (trackIds.length === 0) return [];
    
    try {
      // Spotify API allows max 50 tracks per request
      const results: boolean[] = [];
      
      for (let i = 0; i < trackIds.length; i += 50) {
        const chunk = trackIds.slice(i, i + 50);
        const response = await this.api.get('/me/tracks/contains', {
          params: {
            ids: chunk.join(',')
          }
        });
        results.push(...response.data);
      }
      
      return results;
    } catch (error: any) {
      console.error('Failed to check if tracks are saved:', error.response?.data || error.message);
      throw new Error('Failed to check saved status');
    }
  }
}