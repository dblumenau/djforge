import React, { useEffect, useState, useRef } from 'react';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

interface SpotifyPlayerProps {
  token: string;
  onDeviceReady?: (deviceId: string) => void;
  onPlayerStateChanged?: (state: Spotify.PlaybackState | null) => void;
}

interface PlayerState {
  isPaused: boolean;
  isActive: boolean;
  currentTrack: {
    name: string;
    artists: string;
    album: string;
    albumArt: string;
    duration: number;
    position: number;
  } | null;
  deviceId: string | null;
}

interface PositionTracker {
  lastKnownPosition: number;
  lastKnownTimestamp: number;
  isPlaying: boolean;
  timerId: number | null;
}

const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({ token, onDeviceReady, onPlayerStateChanged }) => {
  console.log('[SpotifyPlayer] Component rendering with token:', token ? 'present' : 'missing');
  
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPaused: true,
    isActive: false,
    currentTrack: null,
    deviceId: null
  });
  const [sdkReady, setSdkReady] = useState(false);
  const playerRef = useRef<Spotify.Player | null>(null);
  const positionTrackerRef = useRef<PositionTracker>({
    lastKnownPosition: 0,
    lastKnownTimestamp: 0,
    isPlaying: false,
    timerId: null
  });

  // Position tracking functions - Rate-limit safe!
  const startPositionTimer = () => {
    const tracker = positionTrackerRef.current;
    if (tracker.timerId) return;

    tracker.timerId = window.setInterval(() => {
      if (!tracker.isPlaying) return;

      // Calculate current position using drift correction
      const elapsed = Date.now() - tracker.lastKnownTimestamp;
      const currentPosition = tracker.lastKnownPosition + elapsed;

      // Update UI position without API calls
      setPlayerState(prev => ({
        ...prev,
        currentTrack: prev.currentTrack ? {
          ...prev.currentTrack,
          position: Math.min(currentPosition, prev.currentTrack.duration)
        } : null
      }));
    }, 250); // 4 FPS - smooth but efficient
  };

  const stopPositionTimer = () => {
    const tracker = positionTrackerRef.current;
    if (tracker.timerId) {
      clearInterval(tracker.timerId);
      tracker.timerId = null;
    }
  };

  const syncPosition = (position: number, timestamp: number, paused: boolean) => {
    const tracker = positionTrackerRef.current;
    
    // Drift correction: account for event delivery latency
    const localTime = Date.now();
    const correctedPosition = paused ? position : position + (localTime - timestamp);

    tracker.lastKnownPosition = correctedPosition;
    tracker.lastKnownTimestamp = localTime;
    tracker.isPlaying = !paused;

    // Always restart timer on sync
    stopPositionTimer();
    if (tracker.isPlaying) {
      startPositionTimer();
    }
  };

  // Handle tab visibility changes to prevent drift
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && positionTrackerRef.current.isPlaying && playerRef.current) {
        try {
          const state = await playerRef.current.getCurrentState();
          if (state && !state.paused) {
            syncPosition(state.position, state.timestamp || Date.now(), state.paused);
          }
        } catch (error) {
          console.log('Tab visibility re-sync failed (non-critical):', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopPositionTimer();
  }, []);

  // Load Spotify Web Playback SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      setSdkReady(true);
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Initialize player when SDK is ready
  useEffect(() => {
    if (!sdkReady || !token) return;

    const spotifyPlayer = new window.Spotify.Player({
      name: 'DJForge Web Player',
      getOAuthToken: (cb: (token: string) => void) => {
        cb(token);
      },
      volume: 0.5
    });

    // Error handling
    spotifyPlayer.addListener('initialization_error', ({ message }: Spotify.Error) => {
      console.error('Failed to initialize:', message);
    });

    spotifyPlayer.addListener('authentication_error', ({ message }: Spotify.Error) => {
      console.error('Authentication error:', message);
    });

    spotifyPlayer.addListener('account_error', ({ message }: Spotify.Error) => {
      console.error('Account error:', message);
    });

    spotifyPlayer.addListener('playback_error', ({ message }: Spotify.Error) => {
      console.error('Playback error:', message);
    });

    // Handle autoplay failure
    spotifyPlayer.addListener('autoplay_failed', () => {
      console.log('Autoplay failed - user interaction required');
    });

    // Ready
    spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
      console.log('Ready with Device ID', device_id);
      setPlayerState(prev => ({ ...prev, deviceId: device_id }));
      if (onDeviceReady) {
        onDeviceReady(device_id);
      }
    });

    // Not Ready
    spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('Device ID has gone offline', device_id);
      setPlayerState(prev => ({ ...prev, deviceId: null, isActive: false }));
    });

    // Player state changed - our sync point for rate-limit-safe position tracking
    spotifyPlayer.addListener('player_state_changed', (state: Spotify.PlaybackState | null) => {
      if (!state) {
        stopPositionTimer();
        return;
      }

      const currentTrack = state.track_window.current_track;
      
      // Sync position tracker with SDK event (rate-limit free!)
      syncPosition(state.position, state.timestamp || Date.now(), state.paused);
      
      setPlayerState({
        isPaused: state.paused,
        isActive: !state.paused,
        currentTrack: currentTrack ? {
          name: currentTrack.name,
          artists: currentTrack.artists.map((a: Spotify.Artist) => a.name).join(', '),
          album: currentTrack.album.name,
          albumArt: currentTrack.album.images[0]?.url || '',
          duration: currentTrack.duration_ms,
          position: state.position // Initial position, timer will update this
        } : null,
        deviceId: playerState.deviceId
      });

      if (onPlayerStateChanged) {
        onPlayerStateChanged(state);
      }
    });

    // Connect to the player
    spotifyPlayer.connect();

    playerRef.current = spotifyPlayer;

    return () => {
      stopPositionTimer();
      spotifyPlayer.disconnect();
    };
  }, [sdkReady, token]);

  // Handle play/pause button click
  const handlePlayPause = async () => {
    if (!playerRef.current) return;

    try {
      if (playerState.isPaused) {
        await playerRef.current.resume();
        // Position tracking will be managed by the player_state_changed event
      } else {
        await playerRef.current.pause();
        // Position tracking will be managed by the player_state_changed event
      }
    } catch (error) {
      console.error('Play/pause error:', error);
    }
  };

  // Handle skip to next track
  const handleSkipNext = async () => {
    if (!playerRef.current) return;

    try {
      await playerRef.current.nextTrack();
    } catch (error) {
      console.error('Skip next error:', error);
    }
  };

  // Handle skip to previous track
  const handleSkipPrevious = async () => {
    if (!playerRef.current) return;

    try {
      await playerRef.current.previousTrack();
    } catch (error) {
      console.error('Skip previous error:', error);
    }
  };

  // Format time from milliseconds to MM:SS
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Progress percentage
  const progressPercent = playerState.currentTrack 
    ? (playerState.currentTrack.position / playerState.currentTrack.duration) * 100
    : 0;

  if (!playerState.currentTrack) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
        <div className="text-center text-gray-400">
          <p className="text-sm">Web Player Ready</p>
          <p className="text-xs mt-2">Play something to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
      <div className="flex items-center space-x-4">
        {/* Album Art */}
        {playerState.currentTrack.albumArt && (
          <img 
            src={playerState.currentTrack.albumArt} 
            alt={playerState.currentTrack.album}
            className="w-20 h-20 rounded-md shadow-lg"
          />
        )}
        
        {/* Track Info */}
        <div className="flex-1">
          <h3 className="text-white font-semibold text-lg truncate">
            {playerState.currentTrack.name}
          </h3>
          <p className="text-gray-400 text-sm truncate">
            {playerState.currentTrack.artists}
          </p>
          <p className="text-gray-500 text-xs truncate">
            {playerState.currentTrack.album}
          </p>
          
          {/* Progress Bar */}
          <div className="mt-3">
            <div className="flex items-center text-xs text-gray-400 mb-1">
              <span>{formatTime(playerState.currentTrack.position)}</span>
              <span className="mx-2">·</span>
              <span>{formatTime(playerState.currentTrack.duration)}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-green-500 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* Playback Controls */}
        <div className="flex items-center space-x-2">
          {/* Previous Track */}
          <button 
            onClick={handleSkipPrevious}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button 
            onClick={handlePlayPause}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors hover:scale-105 ${
              playerState.isPaused ? 'bg-gray-700 hover:bg-gray-600' : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {playerState.isPaused ? (
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" />
              </svg>
            )}
          </button>

          {/* Next Track */}
          <button 
            onClick={handleSkipNext}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
            </svg>
          </button>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            {playerState.isPaused ? 'Paused' : 'Playing'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SpotifyPlayer;