import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { useTrackLibrary } from '../hooks/useTrackLibrary';
import HeartIcon from './HeartIcon';
interface PlaybackState {
  isPlaying: boolean;
  track: {
    name: string;
    artist: string;
    album: string;
    duration: number;
    position: number;
    id?: string;
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
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());
  const [pollTimeoutId, setPollTimeoutId] = useState<number | null>(null);
  const [animationFrameId, setAnimationFrameId] = useState<number | null>(null);
  const [apiCallCount, setApiCallCount] = useState<number[]>([]);
  const [isTrackChanging, setIsTrackChanging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const previousTrackNameRef = useRef<string | null>(null);

  // Track library hook
  const currentTrackId = playbackState.track?.id || '';
  const { savedStatus, loading: libraryLoading, toggleSave } = useTrackLibrary({
    trackIds: currentTrackId ? [currentTrackId] : []
  });


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
          setLastFetchTime(Date.now());
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
  const startProgressAnimation = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    
    const animate = () => {
      if (playbackState.isPlaying && playbackState.track) {
        const elapsed = Date.now() - lastFetchTime;
        const newPosition = Math.min(
          playbackState.track.position + elapsed,
          playbackState.track.duration
        );
        setLocalPosition(newPosition);
        
        const frameId = requestAnimationFrame(animate);
        setAnimationFrameId(frameId);
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
  }, [playbackState.isPlaying, playbackState.track]);

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
    
    try {
      await api.post('/api/control/seek', { position: newPosition });
      setLocalPosition(newPosition);
      setLastFetchTime(Date.now());
      // Fetch new state after seek
      setTimeout(() => fetchPlaybackState(true), 500);
    } catch (error) {
      console.error('Seek failed:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-zinc-800/70 backdrop-blur-md rounded-lg border border-zinc-700/40 overflow-hidden shadow-xl">
        {/* Minimize/Maximize Toggle */}
        <div 
          className="flex items-center justify-between p-2 cursor-pointer hover:bg-zinc-700/50 transition-colors"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center gap-3">
            {playbackState.track ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
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
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-zinc-600 rounded transition-colors">
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  isMinimized ? 'rotate-180' : ''
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
      {!isMinimized && (
        <div className="p-4 pt-0">
          {/* Device Mode Indicator */}
          <div className="mb-2 text-xs text-gray-400">
            {devicePreference === 'auto' && 'Remote Control Mode - Controls active Spotify device'}
            {devicePreference === 'web-player' && 'Note: Switch to Built In Player to use web playback'}
            {devicePreference !== 'auto' && devicePreference !== 'web-player' && 'Controls specific device'}
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
                  className={`p-1.5 rounded transition-colors ${
                    playbackState.shuffleState 
                      ? 'text-green-500 hover:text-green-400' 
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
                  className="p-1.5 rounded text-gray-400 hover:text-white transition-colors disabled:opacity-50"
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
                  className="p-2.5 bg-white rounded-full text-black hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
                  title={playbackState.isPlaying ? 'Pause' : 'Play'}
                >
                  {playbackState.isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                {/* Next */}
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="p-1.5 rounded text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  title="Next track"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>

                {/* Repeat */}
                <button
                  onClick={handleRepeat}
                  className={`p-1.5 rounded transition-colors relative ${
                    playbackState.repeatState !== 'off' 
                      ? 'text-green-500 hover:text-green-400' 
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-10 text-right">
                    {formatTime(Math.floor(localPosition))}
                  </span>
                  <div 
                    className="flex-1 h-1 bg-zinc-700 rounded-full cursor-pointer relative group"
                    onClick={handleSeek}
                  >
                    <div 
                      className={`h-full bg-green-500 rounded-full relative ${
                        isTrackChanging ? '' : 'transition-all duration-1000 ease-linear'
                      }`}
                      style={{ width: `${(localPosition / playbackState.track.duration) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-10">
                    {formatTime(Math.floor(playbackState.track.duration))}
                  </span>
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
                    <div className="absolute bottom-full mb-2 right-0 bg-zinc-800 border border-zinc-700 rounded-lg p-3 z-10">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="w-24 accent-green-500"
                        title={`Volume: ${volume}%`}
                      />
                      <div className="text-center text-xs text-gray-400 mt-1">{volume}%</div>
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
          <div className="flex items-center gap-2 md:gap-4">
            {/* Progress bar - Left side */}
            {playbackState.track && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-10 text-right">
                    {formatTime(Math.floor(localPosition))}
                  </span>
                  <div 
                    className="flex-1 h-1 bg-zinc-700 rounded-full cursor-pointer relative group"
                    onClick={handleSeek}
                  >
                    <div 
                      className={`h-full bg-green-500 rounded-full relative ${
                        isTrackChanging ? '' : 'transition-all duration-1000 ease-linear'
                      }`}
                      style={{ width: `${(localPosition / playbackState.track.duration) * 100}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-10">
                    {formatTime(playbackState.track.duration)}
                  </span>
                </div>
              </div>
            )}

            {/* Main controls - Center */}
            <div className="flex items-center gap-1 md:gap-2">
              {/* Shuffle */}
              <button
                onClick={handleShuffle}
                className={`p-1.5 rounded transition-colors ${
                  playbackState.shuffleState 
                    ? 'text-green-500 hover:text-green-400' 
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
                className="p-1.5 rounded text-gray-400 hover:text-white transition-colors disabled:opacity-50"
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
                className="p-2 bg-white rounded-full text-black hover:scale-105 transition-transform disabled:opacity-50"
                title={playbackState.isPlaying ? "Pause" : "Play"}
              >
                {playbackState.isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              {/* Next */}
              <button
                onClick={handleSkip}
                disabled={loading}
                className="p-1.5 rounded text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                title="Next track"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </button>

              {/* Repeat */}
              <button
                onClick={handleRepeat}
                className={`p-1.5 rounded transition-colors ${
                  playbackState.repeatState !== 'off'
                    ? 'text-green-500 hover:text-green-400' 
                    : 'text-gray-400 hover:text-white'
                }`}
                title={`Repeat: ${playbackState.repeatState}`}
              >
                {playbackState.repeatState === 'track' ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Additional controls - Right side */}
            <div className="flex items-center gap-1 md:gap-2 border-l border-zinc-700 pl-1 md:pl-2">
              {/* Heart/Save */}
              {playbackState.track?.id && (
                <HeartIcon
                  filled={savedStatus.get(playbackState.track.id) || false}
                  loading={libraryLoading.get(playbackState.track.id) || false}
                  size="sm"
                  onClick={() => playbackState.track?.id && toggleSave(playbackState.track.id)}
                />
              )}
              
              {/* Volume */}
              <div className="relative">
                <button
                  onClick={() => setShowVolume(!showVolume)}
                  className="p-1.5 rounded text-gray-400 hover:text-white transition-colors"
                  title="Volume"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                </button>
                
                {showVolume && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg p-3 z-10">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-24 accent-green-500"
                      title={`Volume: ${volume}%`}
                    />
                    <div className="text-center text-xs text-gray-400 mt-1">{volume}%</div>
                  </div>
                )}
              </div>

              {/* Clear Queue */}
              <button
                onClick={handleClearQueue}
                disabled={loading}
                className="p-1.5 rounded text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                title="Clear queue"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z"/>
                </svg>
              </button>

              {/* Queue */}
              <button
                onClick={onShowQueue}
                className="p-1.5 rounded text-gray-400 hover:text-white transition-colors"
                title="View queue"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                </svg>
              </button>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlaybackControls;