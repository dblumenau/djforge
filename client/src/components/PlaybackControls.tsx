import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { api } from '../utils/api';
import { useTrackLibrary } from '../hooks/useTrackLibrary';
import { useMusicWebSocket } from '../hooks/useMusicWebSocket';
import HeartIcon from './HeartIcon';
import { Calendar, Star, Hash, ExternalLink, Music, Monitor, Maximize, X } from 'lucide-react';
import DeviceSelector from './DeviceSelector';
interface PlaybackState {
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

interface PlaybackControlsProps {
  onShowQueue?: () => void;
  isMobile?: boolean;
  devicePreference?: string;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({ onShowQueue, isMobile = false, devicePreference = 'auto' }) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    track: null,
    shuffleState: false,
    repeatState: 'off',
    volume: 50
  });
  const [loading, setLoading] = useState(false);
  const [volume, setVolume] = useState(50);
  const [showVolume, setShowVolume] = useState(false);
  const [localPosition, setLocalPosition] = useState(0);
  const [pollTimeoutId, setPollTimeoutId] = useState<number | null>(null);
  const [animationFrameId, setAnimationFrameId] = useState<number | null>(null);
  const [apiCallCount, setApiCallCount] = useState<number[]>([]);
  const [isTrackChanging, setIsTrackChanging] = useState(false);
  const [viewMode, setViewMode] = useState<'minimized' | 'normal' | 'fullscreen'>('normal');
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const previousTrackNameRef = useRef<string | null>(null);
  
  // Vinyl rotation state
  const [vinylRotation, setVinylRotation] = useState(0);
  const [isVinylPaused, setIsVinylPaused] = useState(false);
  const vinylAnimationRef = useRef<number>();
  const vinylStartTimeRef = useRef<number>(Date.now());

  // Track library hook
  const currentTrackId = playbackState.track?.id || '';
  const { savedStatus, loading: libraryLoading, toggleSave } = useTrackLibrary({
    trackIds: currentTrackId ? [currentTrackId] : []
  });

  // WebSocket handlers for real-time updates
  const handleWsPlaybackStateChange = useCallback((data: any) => {
    console.log('[PlaybackControls] WS playback state changed:', data);
    if (data.isPlaying !== undefined) {
      setPlaybackState(prev => ({ ...prev, isPlaying: data.isPlaying }));
    }
  }, []);

  const handleWsTrackChange = useCallback((data: any) => {
    console.log('[PlaybackControls] WS track changed:', data);
    if (data.track) {
      // Trigger fade animation for track change
      setIsTrackChanging(true);
      
      // Update playback state with new track info
      setPlaybackState(prev => ({
        ...prev,
        track: {
          name: data.track.name || 'Unknown',
          artist: data.track.artist || 'Unknown Artist',
          album: data.track.album || '',
          albumArt: data.track.albumArt || null,
          duration: (data.track.duration_ms || 0) / 1000,
          position: 0,
          id: data.track.id || data.track.uri?.split(':').pop()
        }
      }));
      
      // Reset position tracking
      setLocalPosition(0);
      
      // Clear animation after fade completes
      setTimeout(() => setIsTrackChanging(false), 500);
    }
  }, []);

  const handleWsQueueUpdate = useCallback((data: any) => {
    console.log('[PlaybackControls] WS queue updated:', data);
    // Could trigger a refresh of queue state if needed
  }, []);

  const handleWsCommandExecuted = useCallback((data: any) => {
    console.log('[PlaybackControls] WS command executed:', data);
    // Commands are already reflected in track/playback state changes
    // No additional action needed here
  }, []);

  // Initialize WebSocket connection
  const { connected: wsConnected } = useMusicWebSocket(
    handleWsPlaybackStateChange,
    handleWsTrackChange,
    handleWsQueueUpdate,
    handleWsCommandExecuted
  );


  // Fetch current playback state
  const fetchPlaybackState = async (immediate = false) => {
    // Check rate limit
    if (!immediate && apiCallCount.length >= 150) {
      console.warn('[PlaybackControls] Rate limit protection: skipping poll');
      scheduleNextPoll(60000); // Wait 1 minute
      return;
    }
    
    try {
      trackApiCall();
      const response = await api.get('/api/control/current-track');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.track) {
          // Detect track change
          const currentTrackName = data.track.name;
          const isNewTrack = previousTrackNameRef.current !== null && 
                           previousTrackNameRef.current !== currentTrackName;
          
          if (isNewTrack) {
            console.log('[PlaybackControls] Track changed:', currentTrackName);
            setIsTrackChanging(true);
            // Reset the flag after a short delay to re-enable transitions
            setTimeout(() => setIsTrackChanging(false), 50);
          }
          
          previousTrackNameRef.current = currentTrackName;
          
          setPlaybackState({
            track: data.track,
            isPlaying: data.isPlaying,
            shuffleState: data.shuffleState,
            repeatState: data.repeatState,
            volume: data.volume
          });
          setVolume(data.volume);
          setLocalPosition(data.track.position);
        } else {
          setPlaybackState(prev => ({
            ...prev,
            track: null,
            isPlaying: false
          }));
          setLocalPosition(0);
          previousTrackNameRef.current = null;
        }
      } else if (response.status === 429) {
        console.error('[PlaybackControls] Rate limited! Status:', response.status);
        // Exponential backoff
        scheduleNextPoll(120000); // 2 minutes
      }
    } catch (error) {
      console.error('[PlaybackControls] Failed to fetch playback state:', error);
    }
  };

  // Smart polling logic
  const calculateNextPollTime = (track: PlaybackState['track'], isPlaying: boolean): number => {
    if (!track || !isPlaying) {
      // If nothing is playing, poll less frequently
      return 60000; // 1 minute
    }
    
    const timeRemaining = track.duration - localPosition;
    
    if (timeRemaining <= 5000) {
      // Track is about to end, poll soon
      return Math.max(timeRemaining - 2000, 1000); // 2s before end, min 1s
    } else if (timeRemaining <= 30000) {
      // Last 30 seconds of track
      return 10000; // 10 seconds
    } else {
      // Normal playback
      return 30000; // 30 seconds
    }
  };

  // Schedule next poll
  const scheduleNextPoll = (delay: number) => {
    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
    }
    
    const timeoutId = window.setTimeout(() => {
      fetchPlaybackState();
    }, delay);
    
    setPollTimeoutId(timeoutId);
  };

  // Update local position with animation frame
  const startProgressAnimation = (startPosition?: number) => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      setAnimationFrameId(null);
    }
    
    // CRITICAL: Use the provided startPosition, NOT localPosition (which may be stale)
    const basePosition = startPosition !== undefined 
      ? startPosition 
      : playbackState.track?.position ?? 0;
    
    // If we have a start position, immediately set it
    if (startPosition !== undefined) {
      setLocalPosition(startPosition);
    }
    
    const animationStartTime = Date.now();
    
    const animate = () => {
      if (playbackState.isPlaying && playbackState.track) {
        const elapsed = Date.now() - animationStartTime;
        const newPosition = Math.min(
          basePosition + elapsed,
          playbackState.track.duration
        );
        setLocalPosition(newPosition);
        
        // Continue animation only if still playing
        if (playbackState.isPlaying) {
          const frameId = requestAnimationFrame(animate);
          setAnimationFrameId(frameId);
        }
      }
    };
    
    animate();
  };

  // Track API calls for rate limiting
  const trackApiCall = () => {
    const now = Date.now();
    // Keep only calls from last 30 seconds
    const recentCalls = apiCallCount.filter(time => now - time < 30000);
    recentCalls.push(now);
    setApiCallCount(recentCalls);
    
    // Log if approaching rate limit
    if (recentCalls.length > 80) {
      console.warn('[PlaybackControls] Approaching rate limit:', recentCalls.length, 'calls in 30s');
    }
  };

  // Initial fetch and setup
  useEffect(() => {
    fetchPlaybackState();
    
    return () => {
      if (pollTimeoutId) clearTimeout(pollTimeoutId);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Start/stop progress animation based on playback state
  useEffect(() => {
    // Only restart animation if play state changes or track ID changes
    if (playbackState.isPlaying && playbackState.track) {
      startProgressAnimation();
    } else if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      setAnimationFrameId(null);
    }
    
    // Schedule next poll based on current state
    const nextPollTime = calculateNextPollTime(playbackState.track, playbackState.isPlaying);
    scheduleNextPoll(nextPollTime);
    
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [playbackState.isPlaying, playbackState.track?.id]);

  // Handle vinyl rotation animation
  useEffect(() => {
    // Cancel existing animation
    if (vinylAnimationRef.current) {
      cancelAnimationFrame(vinylAnimationRef.current);
      vinylAnimationRef.current = undefined;
    }

    if (!playbackState.track) {
      setVinylRotation(0);
      setIsVinylPaused(false);
      return;
    }

    // When pausing, capture current rotation
    if (!playbackState.isPlaying && !isVinylPaused) {
      const elapsed = Date.now() - vinylStartTimeRef.current;
      const calculatedRotation = (elapsed / 5000) * 360;  // 5000ms for a nice slow rotation
      setVinylRotation(calculatedRotation % 360);
      setIsVinylPaused(true);
      return;
    }
    
    // When playing (either resuming or starting fresh)
    if (playbackState.isPlaying) {
      if (isVinylPaused) {
        // Resuming: adjust start time to account for current rotation
        const rotationTime = (vinylRotation / 360) * 5000;  // 5000ms for a nice slow rotation
        vinylStartTimeRef.current = Date.now() - rotationTime;
        setIsVinylPaused(false);
      } else if (!playbackState.track?.name || playbackState.track?.name !== previousTrackNameRef.current) {
        // Starting fresh with new track
        vinylStartTimeRef.current = Date.now();
        setVinylRotation(0);
      }

      // Start animation loop
      const animate = () => {
        if (playbackState.isPlaying && playbackState.track) {
          const elapsed = Date.now() - vinylStartTimeRef.current;
          const rotation = (elapsed / 5000) * 360;  // 5000ms for a nice slow rotation
          setVinylRotation(rotation % 360);
          
          vinylAnimationRef.current = requestAnimationFrame(animate);
        }
      };
      
      vinylAnimationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (vinylAnimationRef.current) {
        cancelAnimationFrame(vinylAnimationRef.current);
        vinylAnimationRef.current = undefined;
      }
    };
  }, [playbackState.isPlaying, playbackState.track?.name, isVinylPaused, vinylRotation]);

  // Handle escape key for fullscreen mode and click outside for device selector
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewMode === 'fullscreen') {
        setViewMode('normal');
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      // Close device selector when clicking outside
      const target = e.target as HTMLElement;
      if (!target.closest('.device-selector-container')) {
        setShowDeviceSelector(false);
      }
    };

    if (viewMode === 'fullscreen') {
      document.addEventListener('keydown', handleEscape);
    }
    
    if (showDeviceSelector) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [viewMode, showDeviceSelector]);

  // Control functions
  const handlePlayPause = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const endpoint = playbackState.isPlaying ? '/api/control/pause' : '/api/control/play';
      const response = await api.post(endpoint, {});
      if (response.ok) {
        setPlaybackState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
        // Fetch new state immediately after action
        setTimeout(() => fetchPlaybackState(true), 500);
      }
    } catch (error) {
      console.error('Play/pause failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await api.post('/api/control/next', {});
      if (response.ok) {
        // Set track changing flag immediately for instant visual feedback
        setIsTrackChanging(true);
        // Fetch new track info immediately
        setTimeout(() => fetchPlaybackState(true), 500);
      }
    } catch (error) {
      console.error('Skip failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await api.post('/api/control/previous', {});
      if (response.ok) {
        // Set track changing flag immediately for instant visual feedback
        setIsTrackChanging(true);
        // Fetch new track info immediately
        setTimeout(() => fetchPlaybackState(true), 500);
      }
    } catch (error) {
      console.error('Previous failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShuffle = async () => {
    if (loading) return;
    try {
      const newState = !playbackState.shuffleState;
      const response = await api.post('/api/control/shuffle', { state: newState });
      if (response.ok) {
        setPlaybackState(prev => ({ ...prev, shuffleState: newState }));
      }
    } catch (error) {
      console.error('Shuffle failed:', error);
    }
  };

  const handleRepeat = async () => {
    if (loading) return;
    try {
      // Cycle through: off -> context -> track -> off
      let newState: 'off' | 'track' | 'context';
      switch (playbackState.repeatState) {
        case 'off':
          newState = 'context';
          break;
        case 'context':
          newState = 'track';
          break;
        case 'track':
          newState = 'off';
          break;
      }
      const response = await api.post('/api/control/repeat', { state: newState });
      if (response.ok) {
        setPlaybackState(prev => ({ ...prev, repeatState: newState }));
      }
    } catch (error) {
      console.error('Repeat failed:', error);
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    try {
      await api.post('/api/control/volume', { volume: newVolume });
    } catch (error) {
      console.error('Volume change failed:', error);
    }
  };

  const handleClearQueue = async () => {
    if (loading) return;
    if (!confirm('Clear the entire queue?')) return;
    
    setLoading(true);
    try {
      const response = await api.post('/api/control/clear-queue', {});
      if (response.ok) {
        console.log('Queue cleared');
      }
    } catch (error) {
      console.error('Clear queue failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeek = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playbackState.track) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newPosition = Math.floor(playbackState.track.duration * percentage);
    
    // Stop any existing animation first
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      setAnimationFrameId(null);
    }
    
    // Disable CSS transition for instant jump
    setIsTrackChanging(true);
    
    // Immediately update the visual position (teleport!)
    setLocalPosition(newPosition);
    
    try {
      // Convert milliseconds to seconds for API
      await api.post('/api/control/seek', { position: Math.floor(newPosition / 1000) });
      
      // Restart animation from the new position if playing
      if (playbackState.isPlaying) {
        startProgressAnimation(newPosition);
      }
      
      // Re-enable CSS transition after a brief moment
      setTimeout(() => {
        setIsTrackChanging(false);
      }, 50);
      
      // Fetch new state after a short delay to confirm
      setTimeout(() => fetchPlaybackState(true), 500);
    } catch (error) {
      console.error('Seek failed:', error);
      // Revert position on error
      setLocalPosition(playbackState.track?.position ?? 0);
      setIsTrackChanging(false);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine container classes based on view mode
  const containerClasses = viewMode === 'fullscreen' 
    ? 'fixed inset-0 z-[100] flex items-center justify-center'
    : 'relative';

  const playerClasses = viewMode === 'fullscreen'
    ? 'w-full h-full flex flex-col items-center justify-center'
    : 'relative z-10 overflow-hidden rounded-xl shadow-2xl';

  // Fullscreen modal rendered via portal
  const fullscreenModal = viewMode === 'fullscreen' && ReactDOM.createPortal(
    <div className="fixed inset-0 z-[90]">
      {/* Main backdrop - exactly like player controls */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      
      {/* Content container */}
      <div className="relative h-full w-full flex items-center justify-center">
        {/* Close button */}
        <button
          onClick={() => setViewMode('normal')}
          className="absolute top-6 right-6 p-2 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-all z-20"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        
        {playbackState.track ? (
          <>
            {/* Frosted backdrop behind everything */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            
            {/* Center: Large Vinyl as the star */}
            <div className="relative">
              {/* Ambient glow effect around vinyl - circular */}
              {playbackState.track.albumArt && (
                <div 
                  className="absolute -inset-32 opacity-50 animate-pulse rounded-full"
                  style={{ 
                    backgroundImage: `url(${playbackState.track.albumArt})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(120px) saturate(2)',
                    transform: `rotate(${vinylRotation}deg)`,
                  }}
                />
              )}
              
              {/* Main Vinyl - Even larger and centered */}
              <div className="relative w-[650px] h-[650px] md:w-[750px] md:h-[750px] lg:w-[850px] lg:h-[850px]">
                {playbackState.track.albumArt ? (
                  <div 
                    className="w-full h-full rounded-full shadow-2xl relative z-10 overflow-hidden"
                    style={{ 
                      backgroundImage: `url(${playbackState.track.albumArt})`,
                      backgroundSize: '100% 100%',
                      backgroundPosition: 'center',
                      transform: `rotate(${vinylRotation}deg)`,
                      boxShadow: '0 0 80px rgba(0, 0, 0, 0.8), 0 0 120px rgba(0, 0, 0, 0.5)'
                    }}
                  />
                ) : (
                  <div 
                    className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center relative z-10"
                    style={{ 
                      transform: `rotate(${vinylRotation}deg)`,
                      boxShadow: '0 0 80px rgba(0, 0, 0, 0.8)'
                    }}
                  >
                    <Music className="w-48 h-48 text-gray-500" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Track info - Top left */}
            <div className="absolute top-6 left-6 max-w-md">
              <h1 className="text-3xl font-bold text-white mb-1 drop-shadow-lg">{playbackState.track.name}</h1>
              <p className="text-xl text-gray-200 drop-shadow-lg">{playbackState.track.artist}</p>
              <p className="text-lg text-gray-300 drop-shadow-lg">{playbackState.track.album}</p>
            </div>
            
            {/* Compact controls - Bottom right corner with glow effect */}
            <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/10 max-w-sm overflow-hidden">
              {/* Glow effect from vinyl casting light onto controls */}
              {playbackState.track.albumArt && (
                <div 
                  className="absolute -inset-10 opacity-30"
                  style={{ 
                    backgroundImage: `url(${playbackState.track.albumArt})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(60px) saturate(1.5)',
                    transform: `rotate(${-vinylRotation}deg) translateY(-20%)`,
                    pointerEvents: 'none'
                  }}
                />
              )}
              
              {/* Content wrapper to ensure everything stays clickable */}
              <div className="relative z-10">
              {/* Progress bar */}
              <div className="mb-3">
                <div 
                  className="h-1.5 bg-gray-700/80 rounded-full cursor-pointer overflow-hidden"
                  onClick={handleSeek}
                >
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300"
                    style={{ width: `${(localPosition / playbackState.track.duration) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>{formatTime(localPosition)}</span>
                  <span>{formatTime(playbackState.track.duration)}</span>
                </div>
              </div>
              
              {/* Main controls */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <button onClick={handleShuffle} className={`p-1.5 rounded-lg transition-all ${
                  playbackState.shuffleState ? 'text-red-400 bg-red-400/20' : 'text-gray-400 hover:bg-white/10'
                }`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                  </svg>
                </button>
                
                <button onClick={handlePrevious} className="p-2 text-gray-300 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>
                
                <button onClick={handlePlayPause} className="p-3 bg-red-500 rounded-full text-white hover:bg-red-400 transition-all shadow-lg">
                  {playbackState.isPlaying ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>
                
                <button onClick={handleSkip} className="p-2 text-gray-300 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>
                
                <button onClick={handleRepeat} className={`p-1.5 rounded-lg transition-all ${
                  playbackState.repeatState !== 'off' ? 'text-red-400 bg-red-400/20' : 'text-gray-400 hover:bg-white/10'
                }`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                  </svg>
                </button>
              </div>
              
              {/* Secondary controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {playbackState.track?.id && (
                    <HeartIcon
                      filled={savedStatus.get(playbackState.track.id) || false}
                      loading={libraryLoading.get(playbackState.track.id) || false}
                      size="sm"
                      onClick={() => playbackState.track?.id && toggleSave(playbackState.track.id)}
                    />
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-16 h-1 accent-red-500"
                    />
                  </div>
                  
                  {onShowQueue && (
                    <button onClick={onShowQueue} className="p-1 text-gray-400 hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center">
            <Music className="w-32 h-32 text-gray-600 mb-4" />
            <p className="text-2xl text-gray-400">No track playing</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {fullscreenModal}
      
      {/* Normal and minimized modes */}
      {viewMode !== 'fullscreen' && (
        <div className={containerClasses}>
        <div className={playerClasses}>
          {/* Static ambient backlight for normal mode - no rotation, just atmosphere */}
          {viewMode !== 'minimized' && playbackState.track?.albumArt && (
            <div 
              className="absolute -inset-[200px] bg-cover bg-center opacity-25 pointer-events-none"
              style={{ 
                backgroundImage: `url(${playbackState.track.albumArt})`,
                filter: 'blur(150px)',
                transform: 'translateZ(0)',
              }}
            />
          )}
          
          {/* Main content with frosted glass effect */}
          <div className="relative bg-black/60 backdrop-blur-sm border border-white/10">
          {/* Header Bar */}
          <div 
            className="flex items-center justify-between p-2"
          >
          <div className="flex items-center gap-3">
            {viewMode === 'minimized' ? (
              // Show track info only when minimized
              playbackState.track ? (
                <>
                  {/* Mini Album Art */}
                  <div className="relative flex-shrink-0">
                    {playbackState.track.albumArt ? (
                      <img 
                        src={playbackState.track.albumArt} 
                        alt={playbackState.track.album}
                        className="w-8 h-8 rounded-full shadow"
                        style={{ transform: `rotate(${vinylRotation}deg)` }}
                      />
                    ) : (
                      <div 
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow"
                        style={{ transform: `rotate(${vinylRotation}deg)` }}
                      >
                        <Music className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    wsConnected 
                      ? 'bg-green-500 animate-pulse' 
                      : playbackState.isPlaying 
                        ? 'bg-yellow-500 animate-pulse' 
                        : 'bg-gray-500'
                  }`} 
                  title={wsConnected ? 'Live updates connected' : 'Live updates disconnected'}
                  />
                  <div className="text-sm">
                    <span className="text-white font-medium">{playbackState.track.name}</span>
                    <span className="text-gray-400"> • </span>
                    <span className="text-gray-400">{playbackState.track.artist}</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  {devicePreference === 'web-player' 
                    ? 'Web player ready - play something to control it here'
                    : devicePreference === 'auto'
                    ? 'No track playing'
                    : 'No track playing on selected device'
                  }
                </div>
              )
            ) : (
              // When expanded, just show connection status
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  wsConnected 
                    ? 'bg-green-500 animate-pulse' 
                    : 'bg-gray-500'
                }`} 
                title={wsConnected ? 'Live updates connected' : 'Live updates disconnected'}
                />
                <span className="text-xs text-gray-400">
                  {wsConnected ? 'Live updates connected' : 'Live updates disconnected'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Device Selector Button */}
            {viewMode !== 'minimized' && (
              <div className="relative device-selector-container">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeviceSelector(!showDeviceSelector);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  title="Change playback device"
                >
                  <Monitor className="w-4 h-4 text-gray-400" />
                </button>
                {showDeviceSelector && (
                  <div className="absolute top-full right-0 mt-1 z-50">
                    <DeviceSelector 
                      compact={true}
                      onDeviceChange={() => {
                        setShowDeviceSelector(false);
                        // Device change is handled by DeviceSelector
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* Fullscreen Button */}
            {viewMode !== 'minimized' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('fullscreen');
                }}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                title="Enter fullscreen"
              >
                <Maximize className="w-4 h-4 text-gray-400" />
              </button>
            )}
            
            {/* Minimize/Expand Button */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setViewMode(viewMode === 'minimized' ? 'normal' : 'minimized');
              }}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              title={viewMode === 'minimized' ? 'Expand' : 'Minimize'}
            >
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  viewMode === 'minimized' ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

      {/* Expanded Content */}
      {viewMode !== 'minimized' && (
        <div className="p-6 pt-0">
          {/* Album Art and Track Info (when track is playing) */}
          {playbackState.track && (
            <div className="flex flex-row items-center gap-6 mb-6">
              {/* Album Art with Spinning Vinyl - Larger and more prominent */}
              <div className="relative flex-shrink-0">
                {/* Localized glow just behind the vinyl */}
                {playbackState.track.albumArt && (
                  <div 
                    className="absolute -inset-4 bg-cover bg-center filter blur-[30px] opacity-40 rounded-full"
                    style={{ 
                      backgroundImage: `url(${playbackState.track.albumArt})`,
                      transform: `rotate(${vinylRotation}deg) translateZ(0)`,
                      backfaceVisibility: 'hidden'
                    }}
                  />
                )}
                {playbackState.track.albumArt ? (
                  <img 
                    src={playbackState.track.albumArt} 
                    alt={playbackState.track.album}
                    className="relative w-48 h-48 md:w-56 md:h-56 rounded-full shadow-2xl object-cover z-10"
                    style={{ transform: `rotate(${vinylRotation}deg)` }}
                  />
                ) : (
                  <div 
                    className="relative w-48 h-48 md:w-56 md:h-56 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-2xl z-10"
                    style={{ transform: `rotate(${vinylRotation}deg)` }}
                  >
                    <Music className="w-16 h-16 md:w-20 md:h-20 text-gray-400" />
                  </div>
                )}
              </div>
              
              {/* Track Details - Better typography and spacing */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight line-clamp-2">
                    {playbackState.track.name}
                  </h2>
                  <p className="text-lg md:text-xl text-gray-300 mt-1">
                  {/* Show artist links if we have the full artist data, otherwise fallback to simple string */}
                  {playbackState.track.artists && Array.isArray(playbackState.track.artists) ? (
                    playbackState.track.artists.map((artist: any, index: number) => (
                      <span key={artist.id || index}>
                        {artist.external_urls?.spotify ? (
                          <a 
                            href={artist.external_urls.spotify}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-white transition-colors"
                            title={`Open ${artist.name} in Spotify`}
                          >
                            {artist.name}
                          </a>
                        ) : (
                          artist.name
                        )}
                        {index < (playbackState.track?.artists?.length || 0) - 1 && ', '}
                      </span>
                    ))
                  ) : (
                    playbackState.track.artist
                  )}
                </p>
                  <p className="text-base md:text-lg text-gray-400 mt-2">
                    {playbackState.track.albumUri ? (
                      <a 
                        href={`https://open.spotify.com/album/${playbackState.track.albumId || playbackState.track.albumUri.split(':').pop()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gray-300 transition-colors"
                        title="Open album in Spotify"
                      >
                        {playbackState.track.album}
                      </a>
                    ) : (
                      playbackState.track.album
                    )}
                  </p>
                </div>
                
                {/* Additional metadata - cleaner layout */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  {playbackState.track.releaseDate && (
                    <span className="flex items-center gap-1.5" title="Release Date">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>{new Date(playbackState.track.releaseDate).getFullYear()}</span>
                    </span>
                  )}
                  {playbackState.track.popularity !== undefined && (
                    <span className="flex items-center gap-1.5" title="Popularity">
                      <Star className="w-4 h-4 flex-shrink-0" />
                      <span>{playbackState.track.popularity}/100</span>
                    </span>
                  )}
                  {playbackState.track.track_number && (
                    <span className="flex items-center gap-1.5" title="Track Number">
                      <Hash className="w-4 h-4 flex-shrink-0" />
                      <span>Track {playbackState.track.track_number}</span>
                    </span>
                  )}
                  {playbackState.track.external_urls?.spotify && (
                    <a 
                      href={playbackState.track.external_urls.spotify}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-green-500 hover:text-green-400 transition-colors"
                      title="Open in Spotify"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                      <span>Open in Spotify</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Device Mode & WebSocket Status */}
          <div className="mb-2 text-xs text-gray-400 space-y-1">
            <div>
              {devicePreference === 'auto' && 'Remote Control Mode - Controls active Spotify device'}
              {devicePreference === 'web-player' && 'Note: Switch to Built In Player to use web playback'}
              {devicePreference !== 'auto' && devicePreference !== 'web-player' && 'Controls specific device'}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${
                wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`} />
              <span className={wsConnected ? 'text-green-400' : 'text-red-400'}>
                {wsConnected ? 'Live updates active' : 'Live updates offline'}
              </span>
            </div>
          </div>
          
          {/* Dev mode indicators */}
          {import.meta.env.DEV && (
            <div className="mb-2 space-y-1 text-xs">
              {/* Rate limit indicator */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500">
                  API: {apiCallCount.length}/180
                </span>
                <div className="w-20 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      apiCallCount.length > 150 ? 'bg-red-500' : 
                      apiCallCount.length > 100 ? 'bg-yellow-500' : 
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((apiCallCount.length / 180) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
      
          {/* Mobile Layout */}
          {isMobile ? (
            <div className="space-y-3">
              {/* Main controls row */}
              <div className="flex items-center justify-center gap-2">
                {/* Shuffle */}
                <button
                  onClick={handleShuffle}
                  className={`p-1.5 rounded-full transition-all hover:scale-110 ${
                    playbackState.shuffleState 
                      ? 'text-green-400 bg-green-400/20' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Shuffle"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                  </svg>
                </button>

                {/* Previous */}
                <button
                  onClick={handlePrevious}
                  disabled={loading}
                  className="p-2 rounded-full text-white hover:text-green-400 transition-all hover:scale-110 disabled:opacity-50"
                  title="Previous track"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>

                {/* Play/Pause */}
                <button
                  onClick={handlePlayPause}
                  disabled={loading}
                  className="p-3 bg-white rounded-full text-black hover:scale-110 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                  title={playbackState.isPlaying ? 'Pause' : 'Play'}
                >
                  {playbackState.isPlaying ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                {/* Next */}
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="p-2 rounded-full text-white hover:text-green-400 transition-all hover:scale-110 disabled:opacity-50"
                  title="Next track"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>

                {/* Repeat */}
                <button
                  onClick={handleRepeat}
                  className={`p-1.5 rounded-full transition-all hover:scale-110 relative ${
                    playbackState.repeatState !== 'off' 
                      ? 'text-green-400 bg-green-400/20' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title={`Repeat: ${playbackState.repeatState}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                  </svg>
                  {playbackState.repeatState === 'track' && (
                    <span className="absolute -top-1 -right-1 text-xs bg-green-500 text-black rounded-full w-3 h-3 flex items-center justify-center font-bold">
                      1
                    </span>
                  )}
                </button>
              </div>

              {/* Progress bar */}
              {playbackState.track && (
                <div className="space-y-2">
                  <div 
                    className="w-full h-6 bg-white/20 rounded-full cursor-pointer relative overflow-hidden group"
                    onClick={handleSeek}
                  >
                    <div 
                      className={`h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full relative ${
                        isTrackChanging ? '' : 'transition-all duration-300'
                      }`}
                      style={{ width: `${(localPosition / playbackState.track.duration) * 100}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{formatTime(Math.floor(localPosition))}</span>
                    <span>{formatTime(Math.floor(playbackState.track.duration))}</span>
                  </div>
                </div>
              )}

              {/* Secondary controls row */}
              <div className="flex items-center justify-between gap-2">
                {/* Left side - Heart */}
                {playbackState.track?.id && (
                  <div className="flex-shrink-0">
                    <HeartIcon
                      filled={savedStatus.get(playbackState.track.id) || false}
                      loading={libraryLoading.get(playbackState.track.id) || false}
                      size="sm"
                      onClick={() => playbackState.track?.id && toggleSave(playbackState.track.id)}
                    />
                  </div>
                )}

                {/* Right side - Volume and Queue */}
                <div className="flex items-center gap-1 relative">
                  {/* Volume */}
                  <button
                    onClick={() => setShowVolume(!showVolume)}
                    className="p-2 rounded text-gray-400 hover:text-white transition-colors"
                    title="Volume"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  </button>
                  
                  {/* Volume modal for mobile */}
                  {showVolume && (
                    <div className="absolute bottom-full mb-2 right-0 bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg p-3 z-10">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="w-24 accent-green-500"
                        title={`Volume: ${volume}%`}
                      />
                      <div className="text-center text-xs text-gray-300 mt-1">{volume}%</div>
                    </div>
                  )}

                  {/* Queue */}
                  {onShowQueue && (
                    <button
                      onClick={onShowQueue}
                      className="p-2 rounded text-gray-400 hover:text-white transition-colors"
                      title="View queue"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
          /* Horizontal Layout (Desktop) */
          <div className="space-y-6">
            {/* Main controls row - Better spacing and styling */}
            <div className="flex items-center justify-center gap-4">
              {/* Shuffle */}
              <button
                onClick={handleShuffle}
                className={`p-2 rounded-lg transition-all hover:scale-110 ${
                  playbackState.shuffleState 
                    ? 'text-green-400 bg-green-400/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
                title="Shuffle"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                </svg>
              </button>

              {/* Previous */}
              <button
                onClick={handlePrevious}
                disabled={loading}
                className="p-2.5 text-gray-300 hover:text-white transition-all hover:scale-110 disabled:opacity-50"
                title="Previous track"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>

              {/* Play/Pause - Larger and more prominent */}
              <button
                onClick={handlePlayPause}
                disabled={loading}
                className="p-4 bg-green-500 rounded-full text-black hover:bg-green-400 hover:scale-110 transition-all shadow-xl hover:shadow-2xl disabled:opacity-50"
                title={playbackState.isPlaying ? "Pause" : "Play"}
              >
                {playbackState.isPlaying ? (
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              {/* Next */}
              <button
                onClick={handleSkip}
                disabled={loading}
                className="p-2.5 text-gray-300 hover:text-white transition-all hover:scale-110 disabled:opacity-50"
                title="Next track"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </button>

              {/* Repeat */}
              <button
                onClick={handleRepeat}
                className={`p-2 rounded-lg transition-all hover:scale-110 relative ${
                  playbackState.repeatState !== 'off'
                    ? 'text-green-400 bg-green-400/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
                title={`Repeat: ${playbackState.repeatState}`}
              >
                {playbackState.repeatState === 'track' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Progress Bar with Time Labels - Enhanced styling */}
            {playbackState.track && (
              <div className="space-y-3">
                <div 
                  className="w-full h-2 bg-gray-700 rounded-full cursor-pointer relative overflow-hidden group"
                  onClick={handleSeek}
                >
                  <div 
                    className={`h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full relative ${
                      isTrackChanging ? '' : 'transition-all duration-300'
                    }`}
                    style={{ width: `${(localPosition / playbackState.track.duration) * 100}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
                  </div>
                </div>
                <div className="flex justify-between text-sm text-gray-400 font-medium">
                  <span>{formatTime(Math.floor(localPosition))}</span>
                  <span>{formatTime(playbackState.track.duration)}</span>
                </div>
              </div>
            )}

            {/* Additional controls */}
            <div className="flex items-center justify-between">
              {/* Left side - Heart/Save */}
              <div className="flex items-center gap-2">
                {playbackState.track?.id && (
                  <HeartIcon
                    filled={savedStatus.get(playbackState.track.id) || false}
                    loading={libraryLoading.get(playbackState.track.id) || false}
                    size="sm"
                    onClick={() => playbackState.track?.id && toggleSave(playbackState.track.id)}
                  />
                )}
              </div>
              
              {/* Right side - Volume, Clear Queue, Queue */}
              <div className="flex items-center gap-2">
                {/* Volume */}
                <div className="relative">
                  <button
                    onClick={() => setShowVolume(!showVolume)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Volume"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  </button>
                  
                  {showVolume && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg p-3 z-10">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="w-24 accent-green-500"
                        title={`Volume: ${volume}%`}
                      />
                      <div className="text-center text-xs text-gray-300 mt-1">{volume}%</div>
                    </div>
                  )}
                </div>

                {/* Clear Queue */}
                <button
                  onClick={handleClearQueue}
                  disabled={loading}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  title="Clear queue"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z"/>
                  </svg>
                </button>

                {/* Queue */}
                <button
                  onClick={onShowQueue}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors"
                  title="View queue"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
      </div>
      </div>
      </div>
      )}
    </>
  );
};

export default PlaybackControls;