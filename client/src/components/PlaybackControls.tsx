import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import ReactDOM from 'react-dom';
import ProgressBarJS from 'progressbar.js';
import { api } from '../utils/api';
import { useTrackLibrary } from '../hooks/useTrackLibrary';
import { useMusicWebSocket } from '../hooks/useMusicWebSocket';
import { useVinylAnimation } from '../hooks/useVinylAnimation';
import { useProgressTracking } from '../hooks/useProgressTracking';
import { usePlaybackPolling } from '../hooks/usePlaybackPolling';
import DeviceSelector from './DeviceSelector';
import ControlButtons from './playback/ControlButtons';
import SecondaryControls from './playback/SecondaryControls';
import TrackInfo from './playback/TrackInfo';
import HeartIcon from './HeartIcon';
import VinylDisplay from './playback/VinylDisplay';
import MinimizedView from './playback/MinimizedView';
import FullscreenView from './playback/FullscreenView';
import { PlaybackState, PlaybackControlsProps, PlaybackControlsRef } from '../types/playback.types';
import { Monitor, Maximize, RefreshCw } from 'lucide-react';

const PlaybackControls = forwardRef<PlaybackControlsRef, PlaybackControlsProps>(({ onShowQueue, isMobile = false, devicePreference = 'auto', hideHeaderControls = false }, ref) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    track: null,
    shuffleState: false,
    repeatState: 'off',
    volume: 50,
    context: null
  });
  const [loading, setLoading] = useState(false);
  const [volume, setVolume] = useState(50);
  const [showVolume, setShowVolume] = useState(false);
  const [isTrackChanging, setIsTrackChanging] = useState(false);
  const [viewMode, setViewMode] = useState<'minimized' | 'normal' | 'fullscreen'>('normal');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const previousTrackNameRef = useRef<string | null>(null);
  const previousPositionRef = useRef<number>(0);
  const currentTrackIdRef = useRef<string | null>(null);
  const localPositionRef = useRef<number>(0);
  const progressBarJSRef = useRef<any>(null);

  // Custom hooks
  const currentTrackId = playbackState.track?.id || '';
  const { savedStatus, loading: libraryLoading, toggleSave } = useTrackLibrary({
    trackIds: currentTrackId ? [currentTrackId] : []
  });
  
  // Get polling functions
  const { 
    apiCallCount, 
    trackApiCall, 
    scheduleNextPoll, 
    getSmartPollInterval,
    cleanup: cleanupPolling 
  } = usePlaybackPolling();

  // Declare fetchPlaybackState function after apiCallCount is available
  const fetchPlaybackState = React.useCallback(async (immediate = false) => {
    // Check rate limit
    if (!immediate && apiCallCount.length >= 150) {
      console.warn('[PlaybackControls] Rate limit protection: skipping poll');
      return;
    }
    
    // Track this API call for rate limiting
    trackApiCall();
    
    try {
      const response = await api.get('/api/control/current-track');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.track) {
          // Detect track change or repeat
          const currentTrackName = data.track.name;
          const currentPosition = data.track.position || 0;
          
          // Check for track name change OR significant position jump backwards (track repeat)
          // Note: currentPosition is in SECONDS from the server
          const isNewTrack = previousTrackNameRef.current !== null && 
                           previousTrackNameRef.current !== currentTrackName;
          const isTrackRepeat = previousTrackNameRef.current === currentTrackName &&
                              previousPositionRef.current > 10 && // Was past 10 seconds (position is in seconds!)
                              currentPosition < 5; // Now near the beginning (position is in seconds!)
          
          if (isNewTrack || isTrackRepeat) {
            console.log('[PlaybackControls] Track changed/repeated:', currentTrackName, 
                       'Position jump:', previousPositionRef.current, '->', currentPosition);
            setIsTrackChanging(true);
            // Reset the flag after a short delay to re-enable transitions
            setTimeout(() => setIsTrackChanging(false), 50);
            
            // Position and animation will be handled by useProgressTracking hook
            // through the useEffect watching playback state changes
          }
          
          previousTrackNameRef.current = currentTrackName;
          previousPositionRef.current = currentPosition;
          
          setPlaybackState({
            track: data.track,
            isPlaying: data.isPlaying,
            shuffleState: data.shuffleState,
            repeatState: data.repeatState,
            volume: data.volume,
            context: data.context || null
          });
          setVolume(data.volume);
          // Position will be handled by useProgressTracking hook
          
          // Schedule next poll based on track state
          if (!immediate && data.isPlaying && data.track) {
            // Use the local position for smart polling
            const currentPosMs = localPositionRef.current * 1000; // Convert to ms for polling function
            
            const pollInterval = getSmartPollInterval({
              track: data.track,
              isPlaying: data.isPlaying,
              shuffleState: data.shuffleState,
              repeatState: data.repeatState,
              volume: data.volume
            }, currentPosMs);
            console.log(`[PlaybackControls] Scheduling next poll in ${pollInterval}ms, calculated position: ${currentPosMs}ms`);
            scheduleNextPoll(pollInterval, () => fetchPlaybackState());
          }
        } else {
          setPlaybackState(prev => ({
            ...prev,
            track: null,
            isPlaying: false
          }));
          // Position will be handled by useProgressTracking hook
          previousTrackNameRef.current = null;
        }
      } else if (response.status === 429) {
        console.error('[PlaybackControls] Rate limited! Status:', response.status);
      }
    } catch (error) {
      console.error('[PlaybackControls] Failed to fetch playback state:', error);
    }
  }, [apiCallCount, trackApiCall, getSmartPollInterval, scheduleNextPoll]);

  // Manual refresh function - defined after fetchPlaybackState
  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await fetchPlaybackState(true);
    } finally {
      // Keep the spinning animation for at least 500ms for visual feedback
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  }, [isRefreshing, fetchPlaybackState]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    enterFullscreen: () => setViewMode('fullscreen'),
    refresh: () => handleManualRefresh()
  }), [handleManualRefresh]);

  const { 
    localPosition, 
    setLocalPosition,
    isTrackChanging: progressTrackChanging, 
    startProgressAnimation,
    stopProgressAnimation,
    animationFrameRef,
    handleSeek: handleSeekFromHook
  } = useProgressTracking(playbackState, fetchPlaybackState);
  
  // Keep ref in sync with localPosition
  useEffect(() => {
    localPositionRef.current = localPosition;
  }, [localPosition]);
  
  const { vinylElementRef, vinylRotation } = useVinylAnimation(playbackState, previousTrackNameRef);

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
      
      // Position tracking is handled by useProgressTracking hook
      
      // Clear animation after fade completes
      setTimeout(() => setIsTrackChanging(false), 50);
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

  // Manage progress animation based on playback state
  useEffect(() => {
    const trackId = playbackState.track?.id;
    const isNewTrack = trackId !== currentTrackIdRef.current;
    
    if (playbackState.isPlaying && playbackState.track) {
      if (isNewTrack) {
        // New track - restart animation
        const startPosition = playbackState.track.position || 0;
        startProgressAnimation(startPosition);
        currentTrackIdRef.current = trackId ?? null;
      } else if (!animationFrameRef.current) {
        // Same track but animation not running (e.g., resuming from pause)
        const startPosition = playbackState.track.position || 0;
        startProgressAnimation(startPosition);
      }
      // Don't restart animation if it's already running for the same track
    } else if (!playbackState.isPlaying) {
      // Stop the animation when playback pauses
      stopProgressAnimation();
    }
  }, [playbackState.isPlaying, playbackState.track?.id, startProgressAnimation, stopProgressAnimation]); // Depend on functions too

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      stopProgressAnimation();
    };
  }, [stopProgressAnimation]); // Only run on unmount

  // Initialize and manage ProgressBar.js
  useEffect(() => {
    // Initialize the progress bar if it doesn't exist and we have a track
    if (!progressBarJSRef.current && playbackState.track) {
      const containerEl = document.getElementById(isMobile ? 'progressbar-container-mobile' : 'progressbar-container');
      if (containerEl) {
        progressBarJSRef.current = new ProgressBarJS.Line(containerEl, {
          strokeWidth: 8,
          color: '#1db954', // Spotify green
          trailColor: 'rgba(64, 64, 64, 0.5)',
          duration: 0, // No animation for instant updates
          svgStyle: {
            width: '100%',
            height: '100%'
          },
          trailWidth: 8
        });
      }
    }
    
    // Cleanup on unmount or when track is removed
    return () => {
      if (progressBarJSRef.current) {
        progressBarJSRef.current.destroy();
        progressBarJSRef.current = null;
      }
    };
  }, [playbackState.track, isMobile]);

  // Update ProgressBar.js when localPosition changes
  useEffect(() => {
    if (progressBarJSRef.current && playbackState.track && playbackState.track.duration > 0) {
      const progress = Math.min(localPosition / playbackState.track.duration, 1);
      progressBarJSRef.current.set(progress); // Use set() for instant update
    }
  }, [localPosition, playbackState.track]);

  // Initial fetch and setup
  useEffect(() => {
    fetchPlaybackState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Start polling when playback starts (initial trigger)
  useEffect(() => {
    if (playbackState.isPlaying && playbackState.track) {
      // Trigger an immediate fetch which will set up its own polling chain
      console.log('[PlaybackControls] Playback started, initiating polling chain');
      fetchPlaybackState();
    } else if (!playbackState.isPlaying) {
      // Stop polling when not playing
      cleanupPolling();
    }
    return () => {
      cleanupPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackState.isPlaying, playbackState.track?.id]);


  // Handle escape key for fullscreen mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewMode === 'fullscreen') {
        setViewMode('normal');
      }
    };

    if (viewMode === 'fullscreen') {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [viewMode]);

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
      } else if (response.status === 404) {
        // No active device error
        console.error('No active Spotify device found');
        // Optionally show a toast or alert to the user
        alert('No active Spotify device found. Please open Spotify on a device first.');
      } else {
        // Other errors
        const errorData = await response.json().catch(() => ({}));
        console.error('Play/pause failed:', errorData.error || 'Unknown error');
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

  // Use handleSeek from the hook which properly manages animation
  const handleSeek = handleSeekFromHook;

  // Handle click on progress bar to seek
  const handleProgressBarClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playbackState.track) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newPosition = playbackState.track.duration * percentage; // In seconds
    
    // Stop any existing animation first
    stopProgressAnimation();
    
    // Immediately update the visual position
    setLocalPosition(newPosition);
    
    try {
      // Position is in seconds for API
      await api.post('/api/control/seek', { position: Math.floor(newPosition) });
      
      // Restart animation from the new position if playing
      if (playbackState.isPlaying) {
        startProgressAnimation(newPosition);
      }
      
      // Fetch new state after a short delay to confirm
      setTimeout(() => fetchPlaybackState(true), 500);
    } catch (error) {
      console.error('Seek failed:', error);
      // Revert position on error
      setLocalPosition(playbackState.track?.position ?? 0);
    }
  }, [playbackState.track, playbackState.isPlaying, startProgressAnimation, stopProgressAnimation, fetchPlaybackState]);


  // Props are now passed individually to components

  const trackInfoProps = {
    track: playbackState.track,
    context: playbackState.context
  };

  const vinylProps = {
    albumArt: playbackState.track?.albumArt,
    albumName: playbackState.track?.album || '',
    rotation: vinylRotation,
    vinylRef: vinylElementRef,
    size: 'md' as const,
    showGlow: true
  };

  const fullscreenModal = viewMode === 'fullscreen' && ReactDOM.createPortal(
    <FullscreenView
      playbackState={playbackState}
      savedStatus={savedStatus}
      libraryLoading={libraryLoading}
      localPosition={localPosition}
      isTrackChanging={isTrackChanging || progressTrackChanging}
      context={playbackState.context}
      onClose={() => setViewMode('normal')}
      onPlayPause={handlePlayPause}
      onSkip={handleSkip}
      onPrevious={handlePrevious}
      onShuffle={handleShuffle}
      onRepeat={handleRepeat}
      onSeek={handleSeek}
      onShowQueue={onShowQueue}
      onToggleSave={toggleSave}
      onRefresh={handleManualRefresh}
    />,
    document.body
  );

  return (
    <>
      {fullscreenModal}
      
      {/* Normal and minimized modes */}
      {viewMode !== 'fullscreen' && (
        <div className="relative">
        <div className="relative z-10 overflow-hidden rounded-xl shadow-2xl">
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
          {/* Header Bar - conditionally hidden when used in HeaderPlaybackControls */}
          {!hideHeaderControls && (
            <div 
              className="flex items-center justify-between p-2"
            >
            <div className="flex items-center gap-3">
              {viewMode === 'minimized' ? (
                <MinimizedView
                  track={playbackState.track}
                  vinylRotation={vinylRotation}
                  vinylRef={vinylElementRef}
                  wsConnected={wsConnected}
                />
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
              {/* Refresh Button */}
              {viewMode !== 'minimized' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualRefresh();
                  }}
                  disabled={isRefreshing}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                  title="Refresh playback state"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''} text-gray-400 hover:text-white transition-colors`} />
                </button>
              )}
              
              {/* Device Selector Button - Integrated dropdown */}
              {viewMode !== 'minimized' && (
                <DeviceSelector 
                  compact={true}
                  onDeviceChange={() => {
                    // Device change is handled by DeviceSelector
                  }}
                  customTrigger={(onClick: () => void, isOpen: boolean) => (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                      }}
                      className="p-1.5 hover:bg-white/10 rounded transition-colors"
                      title="Change playback device"
                    >
                      <Monitor className={`w-4 h-4 ${isOpen ? 'text-green-400' : 'text-gray-400'} transition-colors`} />
                    </button>
                  )}
                />
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
          )}

      {/* Expanded Content */}
      {viewMode !== 'minimized' && (
        <div className="px-4 py-3 pt-0 sm:px-6 sm:py-3">
          {/* Album Art and Track Info (when track is playing) */}
          {playbackState.track && (
            <div className="flex flex-row items-center gap-6 mb-6">
              <VinylDisplay {...vinylProps} />
              <TrackInfo {...trackInfoProps} />
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
              <ControlButtons 
                isPlaying={playbackState.isPlaying}
                loading={loading}
                onPlayPause={handlePlayPause}
                onSkip={handleSkip}
                onPrevious={handlePrevious}
                isMobile={true}
              />
              
              {/* Simple percentage display - bypassing the progress bar issues */}
              {playbackState.track && (
                <div className="text-center text-sm text-gray-400" style={{ display: 'none' }}>
                  <span>
                    {Math.round((localPosition / playbackState.track.duration) * 100)}%
                  </span>
                </div>
              )}
              
              {/* ProgressBar.js container */}
              {playbackState.track && (
                <div 
                  id="progressbar-container-mobile" 
                  onClick={handleProgressBarClick}
                  style={{ 
                    height: '12px', 
                    marginBottom: '10px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)',
                    boxShadow: '0 0 20px rgba(29, 185, 84, 0.15), inset 0 1px 2px rgba(0,0,0,0.5)',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                ></div>
              )}
              
              {/* HTML progress element - no styling */}
              {playbackState.track && (
                <div style={{ display: 'none' }}>
                  <progress 
                    id="file-mobile" 
                    max="100" 
                    value={Math.round((localPosition / playbackState.track.duration) * 100)}
                    style={{ width: '100%' }}
                  >
                    {Math.round((localPosition / playbackState.track.duration) * 100)}%
                  </progress>
                </div>
              )}
              
              <SecondaryControls 
                shuffleState={playbackState.shuffleState}
                repeatState={playbackState.repeatState}
                volume={volume}
                showVolume={showVolume}
                savedStatus={savedStatus}
                libraryLoading={libraryLoading}
                trackId={playbackState.track?.id}
                isMobile={true}
                onShuffle={handleShuffle}
                onRepeat={handleRepeat}
                onVolumeChange={handleVolumeChange}
                setShowVolume={setShowVolume}
                onToggleSave={toggleSave}
                onShowQueue={onShowQueue}
                onClearQueue={handleClearQueue}
                loading={loading}
              />
            </div>
          ) : (
          /* Single Row Layout (Desktop) */
          <div className="space-y-4">
            {/* Unified Controls Row */}
            <div className="flex items-center justify-between gap-2 sm:gap-3 min-h-[52px]">
              {/* Left Group: Heart, Shuffle, Repeat */}
              <div className="flex items-center gap-2">
                {/* Heart */}
                {playbackState.track?.id && savedStatus && libraryLoading && (
                  <div className="flex-shrink-0">
                    <HeartIcon
                      filled={savedStatus.get(playbackState.track.id) || false}
                      loading={libraryLoading.get(playbackState.track.id) || false}
                      size="sm"
                      onClick={() => playbackState.track?.id && toggleSave(playbackState.track.id)}
                    />
                  </div>
                )}
                
                {/* Shuffle */}
                <button
                  onClick={handleShuffle}
                  disabled={loading}
                  className={`p-2 rounded-lg transition-all hover:scale-110 ${playbackState.shuffleState 
                    ? 'text-green-400 bg-green-400/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Shuffle"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                  </svg>
                </button>

                {/* Repeat */}
                <button
                  onClick={handleRepeat}
                  disabled={loading}
                  className={`p-2 rounded-lg transition-all hover:scale-110 relative ${playbackState.repeatState !== 'off'
                    ? 'text-green-400 bg-green-400/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
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

              {/* Center Group: Previous, Play/Pause, Next */}
              <div className="flex items-center gap-3">
                {/* Previous */}
                <button
                  onClick={handlePrevious}
                  disabled={loading}
                  className="p-2.5 rounded-lg transition-all hover:scale-110 text-gray-300 hover:text-white disabled:opacity-50"
                  title="Previous track"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>

                {/* Play/Pause - Prominent */}
                <button
                  onClick={handlePlayPause}
                  disabled={loading}
                  className="p-4 rounded-full bg-green-500 text-black hover:bg-green-400 hover:scale-110 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
                  title={playbackState.isPlaying ? 'Pause' : 'Play'}
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
                  className="p-2.5 rounded-lg transition-all hover:scale-110 text-gray-300 hover:text-white disabled:opacity-50"
                  title="Next track"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>
              </div>

              {/* Right Group: Queue */}
              <div className="flex items-center gap-2">
                {/* Queue */}
                <button
                  onClick={onShowQueue}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all hover:scale-110"
                  title="View queue"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Progress Bar Row */}
            {playbackState.track && (
              <div 
                id="progressbar-container" 
                onClick={handleProgressBarClick}
                style={{ 
                  height: '10px', 
                  borderRadius: '5px',
                  overflow: 'hidden',
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)',
                  boxShadow: '0 0 20px rgba(29, 185, 84, 0.15), inset 0 1px 2px rgba(0,0,0,0.5)',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              ></div>
            )}
            
            {/* Volume Control Row */}
            <div className="flex items-center justify-center">
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
            </div>
            
            {/* Hidden elements for debugging */}
            {playbackState.track && (
              <div style={{ display: 'none' }}>
                <progress 
                  id="file" 
                  max="100" 
                  value={Math.round((localPosition / playbackState.track.duration) * 100)}
                  style={{ width: '100%' }}
                >
                  {Math.round((localPosition / playbackState.track.duration) * 100)}%
                </progress>
              </div>
            )}
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
});

PlaybackControls.displayName = 'PlaybackControls';

export default PlaybackControls;