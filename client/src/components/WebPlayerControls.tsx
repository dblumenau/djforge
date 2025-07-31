import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useWebPlayer } from '../hooks/useWebPlayer';
import { useTrackLibrary } from '../hooks/useTrackLibrary';
import HeartIcon from './HeartIcon';
import { api } from '../utils/api';

interface WebPlayerControlsProps {
  className?: string;
}

// Utility function outside component for better performance
const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Memoized waveform component for performance
const WaveformVisualization = React.memo(({ isPlaying }: { isPlaying: boolean }) => {
  const bars = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      baseHeight: Math.random() * 40 + 30, // 30-70% height range
      delay: Math.random() * 800,
      duration: 1.5 + Math.random() * 1
    }));
  }, []);
  
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-4 opacity-20">
      {bars.map(bar => (
        <div 
          key={bar.id}
          className={`bg-green-400/50 rounded-full transition-all ${
            isPlaying ? 'animate-waveform' : ''
          }`}
          style={{ 
            width: '4px',
            height: isPlaying ? `${bar.baseHeight}%` : '15%',
            animationDelay: `${bar.delay}ms`,
            animationDuration: `${bar.duration}s`
          }}
        />
      ))}
    </div>
  );
});

WaveformVisualization.displayName = 'WaveformVisualization';

const WebPlayerControls: React.FC<WebPlayerControlsProps> = ({ className }) => {
  const {
    playerState,
    isReady,
    error,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    activateElement,
    getCurrentPosition
  } = useWebPlayer();

  const [showQueue, setShowQueue] = useState(false);
  const [volume, setVolumeState] = useState(playerState.volume * 100);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isMobile] = useState(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  const [needsActivation, setNeedsActivation] = useState(isMobile);
  const [isStartingPlayback, setIsStartingPlayback] = useState(false);
  const [seekCounter, setSeekCounter] = useState(0); // Force animation restart
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Refs for position tracking
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number>();
  const seekTimeRef = useRef<number>(0);
  
  // State for vinyl rotation tracking
  const [vinylRotation, setVinylRotation] = useState(0);
  const [isVinylPaused, setIsVinylPaused] = useState(false);
  const vinylImgRef = useRef<HTMLImageElement | null>(null);
  const vinylDivRef = useRef<HTMLDivElement | null>(null);
  const vinylAnimationRef = useRef<number>();
  const vinylStartTimeRef = useRef<number>(Date.now());
  
  // Function to get current rotation from CSS transform
  const getCurrentRotation = (): number => {
    const element = vinylImgRef.current || vinylDivRef.current;
    if (!element) {
      console.log('No vinyl element ref');
      return 0;
    }
    
    const style = window.getComputedStyle(element);
    const transform = style.transform;
    
    console.log('CSS transform:', transform);
    
    if (transform === 'none') {
      console.log('Transform is none');
      return 0;
    }
    
    // Parse matrix(a, b, c, d, tx, ty) to get rotation
    const values = transform.split('(')[1].split(')')[0].split(',');
    const a = parseFloat(values[0]);
    const b = parseFloat(values[1]);
    
    console.log('Matrix values:', { a, b, values });
    
    // Calculate rotation angle from matrix values
    const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
    const finalAngle = angle < 0 ? angle + 360 : angle;
    
    console.log('Calculated angle:', finalAngle);
    return finalAngle;
  };
  
  // Check if web player is the selected device
  const [isWebPlayerSelected, setIsWebPlayerSelected] = useState(() => {
    const devicePref = localStorage.getItem('spotifyDevicePreference');
    return devicePref === 'web-player';
  });
  
  // Listen for device preference changes
  useEffect(() => {
    const checkDevicePreference = () => {
      const devicePref = localStorage.getItem('spotifyDevicePreference');
      setIsWebPlayerSelected(devicePref === 'web-player');
    };
    
    // Listen for storage changes (when changed in another tab/component)
    window.addEventListener('storage', checkDevicePreference);
    
    // Also check periodically in case localStorage is updated in the same tab
    const interval = setInterval(checkDevicePreference, 1000);
    
    return () => {
      window.removeEventListener('storage', checkDevicePreference);
      clearInterval(interval);
    };
  }, []);

  // Track library hook for heart/save functionality
  // Extract actual track ID from the track URI (format: spotify:track:ID)
  const currentTrackId = playerState.currentTrack?.uri?.split(':')[2] || '';
  const { savedStatus, loading: libraryLoading, toggleSave } = useTrackLibrary({
    trackIds: currentTrackId ? [currentTrackId] : []
  });

  // Sync position when track changes or position updates
  useEffect(() => {
    if (playerState.currentTrack) {
      setCurrentPosition(playerState.currentTrack.position);
      lastUpdateTimeRef.current = Date.now();
    }
  }, [playerState.currentTrack?.uri, playerState.currentTrack?.position]);

  // Real-time position tracking using the service's position tracker
  useEffect(() => {
    // Always cancel existing animation first
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    if (!playerState.currentTrack || playerState.isPaused) {
      return;
    }

    const updatePosition = () => {
      // Skip updates for 2 seconds after seeking to let Spotify sync
      const timeSinceSeek = Date.now() - seekTimeRef.current;
      if (timeSinceSeek < 2000) {
        animationFrameRef.current = requestAnimationFrame(updatePosition);
        return;
      }
      
      // Get the current position from the service which handles timestamp correction
      const newPosition = getCurrentPosition();
      setCurrentPosition(newPosition);
      
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };
    
    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(updatePosition);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    };
  }, [playerState.currentTrack?.uri, playerState.isPaused, getCurrentPosition, seekCounter]);
  
  // Handle vinyl rotation with pure JavaScript animation
  useEffect(() => {
    // Cancel existing animation
    if (vinylAnimationRef.current) {
      cancelAnimationFrame(vinylAnimationRef.current);
      vinylAnimationRef.current = undefined;
    }

    if (!playerState.currentTrack) {
      console.log('No track - resetting vinyl');
      setVinylRotation(0);
      setIsVinylPaused(false);
      return;
    }

    // When pausing, capture current rotation and stop animation
    if (playerState.isPaused && !isVinylPaused) {
      // If CSS animation was running, get its current rotation
      const actualRotation = getCurrentRotation();
      if (actualRotation > 0) {
        setVinylRotation(actualRotation);
        console.log('PAUSING - captured CSS rotation:', actualRotation);
      } else {
        // Fallback: calculate from JS timing
        const elapsed = Date.now() - vinylStartTimeRef.current;
        const calculatedRotation = (elapsed / 3000) * 360;
        setVinylRotation(calculatedRotation % 360);
        console.log('PAUSING - calculated rotation:', calculatedRotation % 360);
      }
      setIsVinylPaused(true);
      return;
    }
    
    // When playing (either resuming or starting fresh)
    if (!playerState.isPaused) {
      if (isVinylPaused) {
        // Resuming: adjust start time to account for current rotation
        const rotationTime = (vinylRotation / 360) * 3000;
        vinylStartTimeRef.current = Date.now() - rotationTime;
        setIsVinylPaused(false);
        console.log('RESUMING from rotation:', vinylRotation);
      } else {
        // Starting fresh
        vinylStartTimeRef.current = Date.now();
        setVinylRotation(0);
        console.log('STARTING FRESH');
      }

      // Start JS animation loop
      const animate = () => {
        if (!playerState.isPaused && playerState.currentTrack) {
          const elapsed = Date.now() - vinylStartTimeRef.current;
          const rotation = (elapsed / 3000) * 360;
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
  }, [playerState.isPaused, playerState.currentTrack?.uri]);
  
  // Sync volume state with playerState changes
  useEffect(() => {
    setVolumeState(playerState.volume * 100);
  }, [playerState.volume]);

  // Handle mobile activation
  const handleMobileActivation = async () => {
    try {
      await activateElement();
      setNeedsActivation(false);
    } catch (err) {
      console.error('Failed to activate player:', err);
    }
  };

  // Handle volume change
  const handleVolumeChange = async (newVolume: number) => {
    setVolumeState(newVolume);
    try {
      await setVolume(newVolume / 100);
    } catch (err) {
      console.error('Volume change failed:', err);
    }
  };

  // Handle seek with mouse and keyboard support
  const handleSeek = useCallback(async (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
    if (!playerState.currentTrack) return;
    
    let percentage: number;
    
    if ('key' in e) {
      // Keyboard navigation
      const currentPercent = currentPosition / playerState.currentTrack.duration;
      const step = 0.01; // 1% steps
      
      switch (e.key) {
        case 'ArrowLeft':
          percentage = Math.max(0, currentPercent - step);
          break;
        case 'ArrowRight':
          percentage = Math.min(1, currentPercent + step);
          break;
        default:
          return;
      }
    } else {
      // Mouse click
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      percentage = x / rect.width;
    }
    
    const newPosition = Math.floor(playerState.currentTrack.duration * percentage);
    
    // Update position immediately for responsive UI
    setCurrentPosition(newPosition);
    lastUpdateTimeRef.current = Date.now();
    seekTimeRef.current = Date.now(); // Track when we seeked
    
    try {
      await seek(newPosition);
      // Force animation restart by updating counter
      setSeekCounter(prev => prev + 1);
    } catch (err) {
      console.error('Seek failed:', err);
      // Revert position on error
      setCurrentPosition(playerState.currentTrack.position);
    }
  }, [playerState.currentTrack, currentPosition, seek]);

  // Handle volume change with keyboard support
  const handleVolumeKeyboard = useCallback((e: React.KeyboardEvent) => {
    const step = 5; // 5% steps
    let newVolume = volume;
    
    switch (e.key) {
      case 'ArrowUp':
        newVolume = Math.min(100, volume + step);
        break;
      case 'ArrowDown':
        newVolume = Math.max(0, volume - step);
        break;
      default:
        return;
    }
    
    handleVolumeChange(newVolume);
  }, [volume, handleVolumeChange]);

  // Error state
  if (error) {
    return (
      <div className={`bg-red-900/20 border border-red-700/50 rounded-xl p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️ Web Player Error</div>
          <div className="text-sm text-red-300">{error}</div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Mobile activation needed
  if (needsActivation) {
    return (
      <div className={`bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-700/30 rounded-xl p-8 ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-4">🎵</div>
          <h3 className="text-xl font-semibold text-white mb-2">Activate Web Player</h3>
          <p className="text-gray-300 mb-6">Tap to enable music playback in your browser</p>
          <button
            onClick={handleMobileActivation}
            className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-full text-white font-semibold transition-all hover:scale-105 shadow-lg"
            aria-label="Activate web player for music playback"
          >
            Activate Player
          </button>
        </div>
      </div>
    );
  }

  // Not ready state
  if (!isReady) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 ${className}`}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-white font-medium">Initializing Web Player...</div>
          <div className="text-sm text-gray-400 mt-2">Connecting to Spotify</div>
        </div>
      </div>
    );
  }

  // No track playing - show different UI based on whether web player is selected
  if (!playerState.currentTrack) {
    // If web player is selected, show a player-like interface
    if (isWebPlayerSelected) {
      return (
        <div className={`relative overflow-hidden rounded-xl shadow-2xl ${className}`}>
          <div className="relative bg-black/60 backdrop-blur-sm border border-white/10">
            <div className="p-4 md:p-6">
              {/* Desktop layout with smaller sizing */}
              <div className="md:flex md:gap-6 md:items-start">
                {/* Empty state album art - smaller size */}
                <div className="flex justify-center md:justify-start mb-4 md:mb-0 md:flex-shrink-0">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-xl">
                    <span className="text-4xl md:text-5xl">🎵</span>
                  </div>
                </div>
                
                {/* Track Info and Controls - Right side on desktop */}
                <div className="flex-1 min-w-0">
                  {/* Empty state track info - much smaller text */}
                  <div className="text-center md:text-left mb-4">
                    <h2 className="text-base md:text-lg font-semibold text-gray-400 mb-1">No track playing</h2>
                    <p className="text-sm md:text-base text-gray-500 mb-0.5">Click play to resume or use the chat</p>
                    <p className="text-xs md:text-sm text-gray-600">
                      You can also play from Spotify
                    </p>
                  </div>
                  
                  {/* Main Controls - smaller sizing */}
                  <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                    <button 
                      disabled
                      className="p-1.5 rounded-full text-gray-600 cursor-not-allowed"
                      title="Shuffle"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                      </svg>
                    </button>
                    
                    <button 
                      disabled
                      className="p-2 rounded-full text-gray-600 cursor-not-allowed"
                      title="Previous track"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                      </svg>
                    </button>
                    
                    <button 
                      onClick={async () => {
                        if (isStartingPlayback) return; // Prevent multiple clicks
                        
                        // When there's no current track, we need to start fresh playback
                        // Don't try to toggle/resume as there's nothing to resume
                        console.log('Starting fresh playback with recent tracks...');
                        setIsStartingPlayback(true);
                        
                        try {
                          const response = await api.post('/api/direct/start-playback', {
                            playType: 'recent'
                          });
                          
                          if (response.ok) {
                            const data = await response.json();
                            console.log('Started playback:', data.message);
                          } else {
                            const errorData = await response.json();
                            console.error('Failed to start playback:', errorData.error);
                            // Could show a toast here with the error
                          }
                        } catch (startError) {
                          console.error('Error starting playback:', startError);
                        } finally {
                          setIsStartingPlayback(false);
                        }
                      }}
                      className="p-3 bg-white rounded-full text-black hover:scale-110 transition-all shadow-lg hover:shadow-xl relative"
                      title="Play music"
                      aria-label="Play music"
                      disabled={isStartingPlayback}
                    >
                      {isStartingPlayback ? (
                        <div className="w-6 h-6 border-2 border-gray-400 border-t-black rounded-full animate-spin" />
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                    
                    <button 
                      disabled
                      className="p-2 rounded-full text-gray-600 cursor-not-allowed"
                      title="Next track"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                      </svg>
                    </button>
                    
                    <button 
                      disabled
                      className="p-1.5 rounded-full text-gray-600 cursor-not-allowed"
                      title="Repeat"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                      </svg>
                    </button>
                  </div>
                  
                  {/* Device info - smaller text */}
                  <div className="text-center md:text-left text-xs text-gray-500">
                    <p>Connected as: <span className="text-green-400">Web Player</span></p>
                    <p className="text-xs mt-1">Device ID: {playerState.deviceId?.slice(0, 8)}...</p>
                  </div>
                </div>
              </div>
              
              {/* Empty progress bar - full width below */}
              <div className="mt-4 space-y-2">
                <div className="w-full h-6 bg-white/20 rounded-full relative overflow-hidden">
                  <div className="h-full bg-gray-600 rounded-full" style={{ width: '0%' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0:00</span>
                  <span>0:00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Original ready state when web player is not selected
    return (
      <div className={`bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/30 rounded-xl p-8 ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-4">🎶</div>
          <h3 className="text-xl font-semibold text-white mb-2">Web Player Ready</h3>
          <p className="text-gray-300 mb-4">Start playing music to see it here</p>
          <div className="text-sm text-gray-400 space-y-1">
            <p>✓ Connected as: <span className="text-green-400">Built In Player</span></p>
            <p>✓ Device ID: {playerState.deviceId?.slice(0, 8)}...</p>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = playerState.currentTrack 
    ? (currentPosition / playerState.currentTrack.duration) * 100 
    : 0;

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className={`relative overflow-hidden rounded-xl shadow-2xl ${className}`}>
        <div className="relative bg-black/60 backdrop-blur-sm border border-white/10">
          <div className="p-3 flex items-center gap-4">
            {/* Mini album art */}
            {playerState.currentTrack.albumArt ? (
              <img 
                src={playerState.currentTrack.albumArt} 
                alt={playerState.currentTrack.album}
                className="w-12 h-12 rounded-lg shadow-lg"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-lg">
                <span className="text-lg">🎵</span>
              </div>
            )}
            
            {/* Track info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white truncate">
                  {playerState.currentTrack.name}
                </p>
                <span className="text-gray-400">•</span>
                <p className="text-sm text-gray-400 truncate">
                  {playerState.currentTrack.artists}
                </p>
              </div>
              {/* Mini progress bar */}
              <div className="mt-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            
            {/* Mini controls */}
            <button 
              onClick={togglePlayPause}
              className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all"
            >
              {playerState.isPaused ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              )}
            </button>
            
            {/* Expand button */}
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Expand player"
              aria-label="Expand player"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14l5-5 5 5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl shadow-2xl ${className}`}>
      {/* Background with album art blur */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-3xl scale-110 opacity-30"
        style={{ 
          backgroundImage: playerState.currentTrack.albumArt 
            ? `url(${playerState.currentTrack.albumArt})` 
            : 'linear-gradient(135deg, #1f2937, #374151)'
        }}
      />
      
      {/* Main content */}
      <div className="relative bg-black/60 backdrop-blur-sm border border-white/10">
        {/* Collapse button in top right */}
        <button
          onClick={() => setIsCollapsed(true)}
          className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-white transition-colors z-10"
          title="Collapse player"
          aria-label="Collapse player"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
        
        <div className="p-4 md:p-6">
          {/* Desktop layout: Album art left, controls right */}
          <div className="md:flex md:gap-6 md:items-start">
            {/* Album Art - Left side on desktop, centered on mobile */}
            <div className="flex justify-center md:justify-start mb-4 md:mb-0 md:flex-shrink-0">
              <div className="relative group">
                {playerState.currentTrack.albumArt ? (
                  <img 
                    ref={vinylImgRef}
                    src={playerState.currentTrack.albumArt} 
                    alt={playerState.currentTrack.album}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-full shadow-xl"
                    style={{ transform: `rotate(${vinylRotation}deg)` }}
                  />
                ) : (
                  <div 
                    ref={vinylDivRef}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-xl"
                    style={{ transform: `rotate(${vinylRotation}deg)` }}
                  >
                    <span className="text-4xl md:text-5xl">🎵</span>
                  </div>
                )}
                
                {/* Vinyl record groove overlay when playing */}
                {!playerState.isPaused && (
                  <div className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none">
                    {/* Record grooves - these don't spin, just overlay */}
                    <div className="w-[90%] h-[90%] rounded-full border border-white/10"></div>
                    <div className="absolute w-[75%] h-[75%] rounded-full border border-white/10"></div>
                    <div className="absolute w-[60%] h-[60%] rounded-full border border-white/10"></div>
                    <div className="absolute w-[45%] h-[45%] rounded-full border border-white/10"></div>
                    {/* Center spindle hole */}
                    <div className="absolute w-2 h-2 md:w-3 md:h-3 bg-black/60 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Track Info and Controls - Right side on desktop */}
            <div className="flex-1 min-w-0">
              {/* Track Info */}
              <div className="text-center md:text-left mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-1 truncate">
                  {playerState.currentTrack.name}
                </h2>
                <p className="text-base md:text-lg text-gray-300 mb-1 truncate">
                  {playerState.currentTrack.artists}
                </p>
                <p className="text-sm md:text-base text-gray-400 truncate">
                  {playerState.currentTrack.album}
                </p>
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                {/* Shuffle */}
                <button 
                  className={`p-1.5 rounded-full transition-all hover:scale-110 ${
                    playerState.shuffle 
                      ? 'text-green-400 bg-green-400/20' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Shuffle"
                  aria-label="Toggle shuffle"
                  aria-pressed={playerState.shuffle}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                  </svg>
                </button>

                {/* Previous */}
                <button 
                  onClick={previousTrack}
                  className="p-2 rounded-full text-white hover:text-green-400 transition-all hover:scale-110"
                  title="Previous track"
                  aria-label="Previous track"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>

                {/* Play/Pause */}
                <button 
                  onClick={togglePlayPause}
                  className="p-3 bg-white rounded-full text-black hover:scale-110 transition-all shadow-lg hover:shadow-xl"
                  title={playerState.isPaused ? 'Play' : 'Pause'}
                  aria-label={playerState.isPaused ? 'Play' : 'Pause'}
                >
                  {playerState.isPaused ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  )}
                </button>

                {/* Next */}
                <button 
                  onClick={nextTrack}
                  className="p-2 rounded-full text-white hover:text-green-400 transition-all hover:scale-110"
                  title="Next track"
                  aria-label="Next track"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>

                {/* Repeat */}
                <button 
                  className={`p-1.5 rounded-full transition-all hover:scale-110 relative ${
                    playerState.repeatMode !== 0 
                      ? 'text-green-400 bg-green-400/20' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title={`Repeat: ${playerState.repeatMode === 0 ? 'off' : playerState.repeatMode === 1 ? 'context' : 'track'}`}
                  aria-label={`Repeat mode: ${playerState.repeatMode === 0 ? 'off' : playerState.repeatMode === 1 ? 'context' : 'track'}`}
                  aria-pressed={playerState.repeatMode !== 0}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                  </svg>
                  {playerState.repeatMode === 2 && (
                    <span className="absolute -top-1 -right-1 text-xs bg-green-500 text-black rounded-full w-3 h-3 flex items-center justify-center font-bold">
                      1
                    </span>
                  )}
                </button>
              </div>

              {/* Secondary Controls */}
              <div className="flex items-center justify-between gap-2">
                {/* Heart/Save */}
                <HeartIcon
                  filled={savedStatus.get(currentTrackId) || false}
                  loading={libraryLoading.get(currentTrackId) || false}
                  size="sm"
                  onClick={() => toggleSave(currentTrackId)}
                />

                {/* Volume */}
                <div className="relative">
                  <button
                    onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Volume"
                    aria-label="Toggle volume control"
                    aria-expanded={showVolumeSlider}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  </button>
                  
                  {showVolumeSlider && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg p-3 z-10">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        onKeyDown={handleVolumeKeyboard}
                        className="w-20 accent-green-500"
                        aria-label="Volume control"
                        aria-valuenow={volume}
                        aria-valuetext={`${volume}%`}
                      />
                      <div className="text-center text-xs text-gray-300 mt-1">{volume}%</div>
                    </div>
                  )}
                </div>

                {/* Queue Toggle */}
                <button
                  onClick={() => setShowQueue(!showQueue)}
                  className={`p-1.5 rounded-full transition-all ${
                    showQueue 
                      ? 'text-green-400 bg-green-400/20' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Toggle queue"
                  aria-label="Toggle queue view"
                  aria-expanded={showQueue}
                  aria-controls="queue-section"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Progress Bar - Full width below */}
          <div className="mt-4 space-y-2">
            <div 
              className="w-full h-6 bg-white/20 rounded-full cursor-pointer group relative overflow-hidden"
              onClick={handleSeek}
              onKeyDown={handleSeek}
              tabIndex={0}
              role="slider"
              aria-label="Seek position"
              aria-valuemin={0}
              aria-valuemax={playerState.currentTrack.duration}
              aria-valuenow={currentPosition}
              aria-valuetext={`${formatTime(currentPosition)} of ${formatTime(playerState.currentTrack.duration)}`}
            >
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-300 relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Waveform effect */}
              <WaveformVisualization isPlaying={!playerState.isPaused} />
            </div>
            
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatTime(currentPosition)}</span>
              <span>{formatTime(playerState.currentTrack.duration)}</span>
            </div>
          </div>

          {/* Queue Section */}
          {showQueue && (
            <div id="queue-section" className="border-t border-white/10 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                </svg>
                Up Next ({playerState.queue.nextTracks.length})
              </h3>
              
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {playerState.queue.nextTracks.length > 0 ? (
                  playerState.queue.nextTracks.slice(0, 10).map((track, index) => (
                      <div key={`${track.uri}-${index}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                        <div className="w-8 text-center text-sm text-gray-500">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm truncate">{track.name}</div>
                          <div className="text-gray-400 text-xs truncate">{track.artists}</div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTime(track.duration)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-400 py-8">
                      <div className="text-4xl mb-2">🎵</div>
                      <p>No upcoming tracks</p>
                      <p className="text-xs mt-1">Queue more music to see it here</p>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default WebPlayerControls;