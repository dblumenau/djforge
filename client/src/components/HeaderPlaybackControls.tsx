import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Play, Pause, RefreshCw, Expand } from 'lucide-react';
import { usePlayback } from '../contexts/PlaybackContext';
import { useWebPlayer } from '../hooks/useWebPlayer';
import { api } from '../utils/api';
import PlaybackControls from './PlaybackControls';
import { PlaybackControlsRef } from '../types/playback.types';
import WebPlayerControls from './WebPlayerControls';
import DeviceSelector from './DeviceSelector';

interface HeaderPlaybackControlsProps {
  className?: string;
}

const HeaderPlaybackControls: React.FC<HeaderPlaybackControlsProps> = ({ className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(true); // Default to expanded
  const [isConnected, setIsConnected] = useState(true); // Track connection status
  const [isRefreshing, setIsRefreshing] = useState(false); // Track refresh state
  const { devicePreference, showWebPlayer } = usePlayback();
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const playbackControlsRef = React.useRef<PlaybackControlsRef>(null);

  // Close expanded view when clicking outside or pressing ESC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (dropdownRef.current && 
          !dropdownRef.current.contains(target) && 
          !target.closest('.device-selector-dropdown') &&
          !target.closest('.fullscreen-playback-view')) {
        setIsExpanded(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isExpanded]);

  // Periodic connection check
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await api.get('/api/control/current-track');
        setIsConnected(response.ok);
      } catch (error) {
        setIsConnected(false);
      }
    };

    // Check connection immediately and then every 10 seconds
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Don't render anything if no device preference is set or it's auto
  // This prevents the header from showing controls when the main playback area is handling it
  if (devicePreference === 'auto') {
    return null;
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Handle refresh playback state
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    if (playbackControlsRef.current) {
      playbackControlsRef.current.refresh();
    }
    
    // Keep the spinning animation for at least 500ms for visual feedback
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // Handle fullscreen
  const handleFullscreen = () => {
    if (showWebPlayer) {
      // For web player, we might want to show a message or handle differently
      console.log('Fullscreen not available for web player');
    } else if (playbackControlsRef.current) {
      playbackControlsRef.current.enterFullscreen();
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {isExpanded ? (
        // Expanded view - show full controls in a dropdown-style container
        <div className="relative">
          <div 
            ref={dropdownRef}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-500 w-[600px] max-w-[calc(100vw-1rem)] md:max-w-[calc(100vw-2rem)] bg-black/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200"
          >
            {/* Header with status indicators and controls */}
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="text-sm font-medium text-white">Now Playing</span>
              
              {/* Right side controls */}
              <div className="flex items-center gap-2">
                {/* Live updates status */}
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span>Live updates {isConnected ? 'connected' : 'disconnected'}</span>
                </div>
                
                {/* Device selector */}
                <DeviceSelector 
                  compact={true}
                />
                
                {/* Control buttons */}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh playback state"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''} text-gray-400 hover:text-white`} />
                </button>
                
                <button
                  onClick={handleFullscreen}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Enter fullscreen mode"
                >
                  <Expand className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
                
                <button
                  onClick={toggleExpanded}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Collapse player"
                >
                  <ChevronUp className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              </div>
            </div>
            
            {/* Full controls container */}
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto">
              {showWebPlayer ? (
                <WebPlayerControls className="border-0 rounded-none bg-transparent" />
              ) : (
                <div className="[&_.p-6]:p-4 [&_.p-2]:p-3 [&_.gap-6]:gap-4 [&_.mb-6]:mb-4 [&_.space-y-6]:space-y-4">
                  <PlaybackControls 
                    ref={playbackControlsRef}
                    isMobile={false}
                    devicePreference={devicePreference}
                    hideHeaderControls={true}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Collapsed view - compact header display
        <HeaderCompactView onExpand={toggleExpanded} />
      )}
    </div>
  );
};

// Compact view component for the collapsed state
interface HeaderCompactViewProps {
  onExpand: () => void;
}

const HeaderCompactView: React.FC<HeaderCompactViewProps> = ({ onExpand }) => {
  const { showWebPlayer } = usePlayback();
  const webPlayer = useWebPlayer();
  const [remoteState, setRemoteState] = useState<{
    isPlaying: boolean;
    track: any;
    position: number;
  }>({
    isPlaying: false,
    track: null,
    position: 0
  });

  // Fetch remote playback state for non-web-player mode
  useEffect(() => {
    if (!showWebPlayer) {
      const fetchRemoteState = async () => {
        try {
          const response = await api.get('/api/control/current-track');
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setRemoteState({
                isPlaying: data.isPlaying || false,
                track: data.track,
                position: data.track?.position || 0
              });
            }
          }
        } catch (error) {
          console.error('Failed to fetch remote state:', error);
        }
      };

      fetchRemoteState();
      const interval = setInterval(fetchRemoteState, 5000); // Poll every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [showWebPlayer]);

  // Get current state based on player type
  const currentTrack = showWebPlayer ? webPlayer.playerState.currentTrack : remoteState.track;
  const isPlaying = showWebPlayer ? !webPlayer.playerState.isPaused : remoteState.isPlaying;
  const position = showWebPlayer 
    ? webPlayer.getCurrentPosition() 
    : remoteState.position * 1000; // Convert to ms for consistency
  const duration = currentTrack?.duration || 0;
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  // Handle play/pause
  const handlePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent expanding when clicking play/pause
    try {
      if (showWebPlayer) {
        await webPlayer.togglePlayPause();
      } else {
        const endpoint = isPlaying ? '/api/control/pause' : '/api/control/play';
        await api.post(endpoint, {});
      }
    } catch (error) {
      console.error('Failed to toggle playback:', error);
    }
  };

  return (
    <div className="w-full md:w-auto md:max-w-80">
      <div 
        className="relative flex items-center gap-3 px-3 py-1 bg-zinc-900/50 hover:bg-zinc-800/50 rounded-full w-full cursor-pointer transition-all group overflow-hidden"
        onClick={onExpand}
        title="Click to expand player"
      >
        {/* Mini album art */}
        {currentTrack?.albumArt ? (
          <img 
            src={currentTrack.albumArt} 
            alt={currentTrack.album || 'Album'}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-white/10"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 ring-1 ring-white/10">
            <span className="text-xs">🎵</span>
          </div>
        )}
        
        {/* Track info - show on all devices */}
        <div className="flex flex-col min-w-0 flex-1 md:max-w-[200px]">
          {currentTrack ? (
            <>
              <div className="text-xs font-medium text-white truncate">
                {currentTrack.name}
              </div>
              <div className="text-[10px] md:text-xs text-zinc-400 truncate">
                {currentTrack.artists 
                  ? (Array.isArray(currentTrack.artists) 
                      ? currentTrack.artists.map((a: any) => a.name).join(', ')
                      : currentTrack.artists)
                  : currentTrack.artist}
              </div>
            </>
          ) : (
            <div className="text-xs text-zinc-400">
              No track playing
            </div>
          )}
        </div>
        
        {/* Play/pause button */}
        <button 
          onClick={handlePlayPause}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
        
        {/* Expand indicator - subtle on hover */}
        <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
        
        {/* Progress bar - inside the pill */}
        {currentTrack && (
          <div className="absolute bottom-1 left-3 right-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500/70 transition-all duration-300"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HeaderPlaybackControls;