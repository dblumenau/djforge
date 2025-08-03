import { authService } from './auth.service';
import { apiEndpoint } from '../config/api';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

export interface PlayerState {
  isPaused: boolean;
  isActive: boolean;
  currentTrack: {
    name: string;
    artists: string;
    album: string;
    albumArt: string;
    duration: number;
    position: number;
    uri?: string;
    id?: string;
  } | null;
  deviceId: string | null;
  volume: number;
  shuffle: boolean;
  repeatMode: number; // 0=off, 1=context, 2=track
  queue: {
    previousTracks: TrackInfo[];
    nextTracks: TrackInfo[];
  };
}

export interface TrackInfo {
  name: string;
  artists: string;
  album: string;
  uri: string;
  id: string;
  duration: number;
}

interface PositionTracker {
  lastKnownPosition: number;
  lastKnownTimestamp: number;
  isPlaying: boolean;
  timerId: number | null;
}

type PlayerStateListener = (state: PlayerState) => void;
type DeviceReadyListener = (deviceId: string) => void;
type ErrorListener = (error: string) => void;

class WebPlayerService {
  private static instance: WebPlayerService;
  private player: Spotify.Player | null = null;
  private sdkReady = false;
  private sdkLoading = false;
  private deviceId: string | null = null;
  private playerState: PlayerState = {
    isPaused: true,
    isActive: false,
    currentTrack: null,
    deviceId: null,
    volume: 1.0,
    shuffle: false,
    repeatMode: 0,
    queue: {
      previousTracks: [],
      nextTracks: []
    }
  };
  
  private positionTracker: PositionTracker = {
    lastKnownPosition: 0,
    lastKnownTimestamp: 0,
    isPlaying: false,
    timerId: null
  };

  private stateListeners: Set<PlayerStateListener> = new Set();
  private deviceReadyListeners: Set<DeviceReadyListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();

  private constructor() {
  }

  static getInstance(): WebPlayerService {
    if (!WebPlayerService.instance) {
      WebPlayerService.instance = new WebPlayerService();
    }
    return WebPlayerService.instance;
  }

  async initialize(): Promise<void> {
    if (this.player || this.sdkLoading) {
      return;
    }

    this.sdkLoading = true;
    
    // Load SDK if not already loaded
    if (!this.sdkReady && !window.Spotify) {
      await this.loadSDK();
    }

    // Create player instance
    await this.createPlayer();
  }

  private loadSDK(): Promise<void> {
    return new Promise((resolve) => {
      // Check if script already exists
      const existingScript = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
      if (existingScript) {
        if (window.Spotify) {
          this.sdkReady = true;
          resolve();
          return;
        }
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;

      window.onSpotifyWebPlaybackSDKReady = () => {
        this.sdkReady = true;
        resolve();
      };

      document.body.appendChild(script);
    });
  }

  private async createPlayer(): Promise<void> {
    if (!window.Spotify) {
      console.error('[WebPlayerService] Spotify SDK not loaded');
      this.sdkLoading = false;
      return;
    }

    this.player = new window.Spotify.Player({
      name: 'DJForge Web Player',
      getOAuthToken: async (cb: (token: string) => void) => {
        try {
          // This will automatically refresh if needed and has sophisticated retry logic
          const token = await authService.getAccessToken();
          cb(token);
        } catch (error) {
          console.error('[WebPlayerService] Failed to get access token:', error);
          this.notifyError('Authentication failed. Please re-login.');
          // Don't retry here - authService.getAccessToken() already handles all retry logic
          // including thundering herd protection, exponential backoff, and automatic logout
        }
      },
      volume: 1.0,
      enableMediaSession: true // Enable browser media controls
    });

    this.setupEventListeners();
    
    // Connect to the player
    await this.player!.connect();
    
    this.sdkLoading = false;
  }

  private setupEventListeners(): void {
    if (!this.player) return;

    // Error handling
    this.player!.addListener('initialization_error', ({ message }: Spotify.Error) => {
      console.error('Failed to initialize:', message);
      if (message.includes('EME')) {
        this.notifyError('Please enable DRM in your browser settings');
      } else {
        this.notifyError('Browser not supported. Please use Chrome, Firefox, or Safari.');
      }
    });

    this.player.addListener('authentication_error', ({ message }: Spotify.Error) => {
      console.error('Authentication error:', message);
      this.notifyError('Token expired. Refreshing...');
      // Token refresh is handled in getOAuthToken callback
    });

    this.player.addListener('account_error', ({ message }: Spotify.Error) => {
      console.error('Account error:', message);
      this.notifyError('Spotify Premium required. Please upgrade your account.');
    });

    this.player.addListener('playback_error', ({ message }: Spotify.Error) => {
      console.error('Playback error:', message);
      // Ignore analytics errors
      if (!message.includes('cpapi.spotify.com')) {
        this.notifyError(`Playback failed: ${message}`);
      }
    });

    this.player.addListener('autoplay_failed', () => {
      this.notifyError('Click play to start playback (browser requires user interaction)');
    });

    // Ready
    this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
      this.deviceId = device_id;
      this.playerState.deviceId = device_id;
      
      // Register with backend
      this.registerWithBackend(device_id);
      
      this.notifyDeviceReady(device_id);
      this.notifyStateChange();
    });

    // Not Ready
    this.player.addListener('not_ready', () => {
      this.deviceId = null;
      this.playerState.deviceId = null;
      this.playerState.isActive = false;
      this.stopPositionTimer();
      this.notifyStateChange();
    });

    // Player state changed
    this.player.addListener('player_state_changed', (state: Spotify.PlaybackState | null) => {
      if (!state) {
        this.stopPositionTimer();
        return;
      }

      const currentTrack = state.track_window.current_track;
      
      // Sync position tracker
      this.syncPosition(state.position, state.timestamp || Date.now(), state.paused);
      
      // Map previous and next tracks
      const previousTracks = state.track_window.previous_tracks.map((track: any) => ({
        name: track.name,
        artists: track.artists.map((a: any) => a.name).join(', '),
        album: track.album.name,
        uri: track.uri,
        id: track.id,
        duration: track.duration_ms
      }));

      const nextTracks = state.track_window.next_tracks.map((track: any) => ({
        name: track.name,
        artists: track.artists.map((a: any) => a.name).join(', '),
        album: track.album.name,
        uri: track.uri,
        id: track.id,
        duration: track.duration_ms
      }));
      
      this.playerState = {
        isPaused: state.paused,
        isActive: !state.paused,
        currentTrack: currentTrack ? {
          name: currentTrack.name,
          artists: currentTrack.artists.map((a: Spotify.Artist) => a.name).join(', '),
          album: currentTrack.album.name,
          albumArt: currentTrack.album.images[0]?.url || '',
          duration: currentTrack.duration_ms,
          position: state.position,
          uri: currentTrack.uri,
          id: currentTrack.id
        } : null,
        deviceId: this.deviceId,
        volume: this.playerState.volume, // Volume is not in state object
        shuffle: state.shuffle,
        repeatMode: state.repeat_mode,
        queue: {
          previousTracks,
          nextTracks
        }
      };

      this.notifyStateChange();
    });
  }


  private syncPosition(position: number, timestamp: number, paused: boolean): void {
    // Don't add elapsed time correction here - just store the raw position
    // The correction will be applied when getCurrentPosition is called
    this.positionTracker.lastKnownPosition = position;
    this.positionTracker.lastKnownTimestamp = timestamp;
    this.positionTracker.isPlaying = !paused;

    this.stopPositionTimer();
    if (this.positionTracker.isPlaying) {
      this.startPositionTimer();
    }
  }

  private startPositionTimer(): void {
    if (this.positionTracker.timerId) return;

    // Don't update position through state changes - let components handle animation
    // This prevents excessive re-renders
  }

  private stopPositionTimer(): void {
    if (this.positionTracker.timerId) {
      clearInterval(this.positionTracker.timerId);
      this.positionTracker.timerId = null;
    }
  }

  // Public methods
  async play(): Promise<void> {
    if (!this.player) throw new Error('Player not initialized');
    await this.player.resume();
  }

  async pause(): Promise<void> {
    if (!this.player) throw new Error('Player not initialized');
    await this.player.pause();
  }

  async nextTrack(): Promise<void> {
    if (!this.player) throw new Error('Player not initialized');
    await this.player.nextTrack();
  }

  async previousTrack(): Promise<void> {
    if (!this.player) throw new Error('Player not initialized');
    await this.player.previousTrack();
  }

  async togglePlayPause(): Promise<void> {
    if (!this.player) throw new Error('Player not initialized');
    await this.player.togglePlay();
  }

  async seek(positionMs: number): Promise<void> {
    if (!this.player) throw new Error('Player not initialized');
    
    // Update position tracker BEFORE the seek
    this.positionTracker.lastKnownPosition = positionMs;
    this.positionTracker.lastKnownTimestamp = Date.now();
    
    // Update player state to reflect new position
    if (this.playerState.currentTrack) {
      this.playerState.currentTrack.position = positionMs;
      this.notifyStateChange();
    }
    
    // Now perform the actual seek
    await this.player.seek(positionMs);
  }

  async setVolume(volume: number): Promise<void> {
    if (!this.player) throw new Error('Player not initialized');
    if (volume < 0 || volume > 1) throw new Error('Volume must be between 0 and 1');
    
    await this.player.setVolume(volume);
    this.playerState.volume = volume;
    this.notifyStateChange();
  }

  async getVolume(): Promise<number> {
    if (!this.player) throw new Error('Player not initialized');
    const volume = await this.player.getVolume();
    this.playerState.volume = volume;
    return volume;
  }

  async getCurrentState(): Promise<Spotify.PlaybackState | null> {
    if (!this.player) throw new Error('Player not initialized');
    return await this.player.getCurrentState();
  }

  async setName(name: string): Promise<void> {
    if (!this.player) throw new Error('Player not initialized');
    await this.player.setName(name);
  }

  // Mobile support - must be called in response to user interaction
  async activateElement(): Promise<void> {
    if (!this.player) throw new Error('Player not initialized');
    await this.player.activateElement();
  }

  getState(): PlayerState {
    return { ...this.playerState };
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }

  // Get current position without triggering state change
  getCurrentPosition(): number {
    if (!this.playerState.currentTrack) {
      return 0;
    }
    
    if (!this.positionTracker.isPlaying) {
      return this.positionTracker.lastKnownPosition;
    }
    
    const elapsed = Date.now() - this.positionTracker.lastKnownTimestamp;
    const currentPosition = this.positionTracker.lastKnownPosition + elapsed;
    
    return Math.min(currentPosition, this.playerState.currentTrack.duration);
  }

  isReady(): boolean {
    return this.player !== null && this.deviceId !== null;
  }

  async transferPlayback(): Promise<void> {
    if (!this.deviceId) {
      throw new Error('Web Player not ready - no device ID');
    }

    try {
      // Note: This still uses Bearer token for direct Spotify API calls
      // The session-based auth is only for our backend
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authService.getAccessToken()}`
        },
        body: JSON.stringify({
          device_ids: [this.deviceId],
          play: false
        })
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to transfer playback: ${response.status}`);
      }

    } catch (error) {
      console.error('[WebPlayerService] Transfer playback error:', error);
      throw error;
    }
  }

  // Cleanup
  async disconnect(): Promise<void> {
    
    this.stopPositionTimer();
    
    if (this.player) {
      this.player.disconnect();
      this.player = null;
    }
    
    this.deviceId = null;
    this.playerState = {
      isPaused: true,
      isActive: false,
      currentTrack: null,
      deviceId: null,
      volume: 1.0,
      shuffle: false,
      repeatMode: 0,
      queue: {
        previousTracks: [],
        nextTracks: []
      }
    };
    
    this.notifyStateChange();
  }

  // Event subscription methods
  onStateChange(listener: PlayerStateListener): () => void {
    this.stateListeners.add(listener);
    // Immediately notify with current state
    listener(this.getState());
    
    // Return unsubscribe function
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onDeviceReady(listener: DeviceReadyListener): () => void {
    this.deviceReadyListeners.add(listener);
    
    // If already ready, notify immediately
    if (this.deviceId) {
      listener(this.deviceId);
    }
    
    return () => {
      this.deviceReadyListeners.delete(listener);
    };
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  // Private notification methods
  private notifyStateChange(): void {
    const state = this.getState();
    this.stateListeners.forEach(listener => listener(state));
  }

  private notifyDeviceReady(deviceId: string): void {
    this.deviceReadyListeners.forEach(listener => listener(deviceId));
  }

  private notifyError(error: string): void {
    this.errorListeners.forEach(listener => listener(error));
  }

  // Register Web SDK device with backend
  private async registerWithBackend(deviceId: string): Promise<void> {
    try {
      const sessionId = authService.getSessionId();
      if (!sessionId) {
        console.error('[WebPlayerService] No session ID available');
        return;
      }

      const response = await fetch(apiEndpoint('/api/web-player/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({
          deviceId,
          name: 'DJForge Web Player'
        })
      });

      if (!response.ok) {
        console.error('[WebPlayerService] Failed to register with backend:', response.status);
      } else {
      }
    } catch (error) {
      console.error('[WebPlayerService] Error registering with backend:', error);
    }
  }
}

export const webPlayerService = WebPlayerService.getInstance();