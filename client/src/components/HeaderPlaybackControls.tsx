import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Play, Pause } from 'lucide-react';
import { usePlayback } from '../contexts/PlaybackContext';
import { useWebPlayer } from '../hooks/useWebPlayer';
import { api } from '../utils/api';
import PlaybackControls from './PlaybackControls';
import WebPlayerControls from './WebPlayerControls';

interface HeaderPlaybackControlsProps {
  className?: string;
}

const HeaderPlaybackControls: React.FC<HeaderPlaybackControlsProps> = ({ className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { devicePreference, showWebPlayer } = usePlayback();

  // Don't render anything if no device preference is set or it's auto
  // This prevents the header from showing controls when the main playback area is handling it
  if (devicePreference === 'auto') {
    return null;
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`hidden md:flex ${className}`}>
      {isExpanded ? (
        // Expanded view - show full controls in a dropdown-style container
        <div className="relative">
          <div className="absolute top-0 right-0 z-50 min-w-[400px] max-w-[500px] bg-black/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl">
            {/* Header with collapse button */}
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="text-sm font-medium text-white">Now Playing</span>
              <button
                onClick={toggleExpanded}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Collapse player"
              >
                <ChevronUp className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            
            {/* Full controls container */}
            <div className="max-h-[80vh] overflow-y-auto">
              {showWebPlayer ? (
                <WebPlayerControls className="border-0 rounded-none bg-transparent" />
              ) : (
                <PlaybackControls 
                  isMobile={false}
                  devicePreference={devicePreference}
                />
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
  const handlePlayPause = async () => {
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
    <div className="flex items-center gap-3 px-3 py-2 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg max-w-[320px]">
      {/* Mini album art */}
      {currentTrack?.albumArt ? (
        <img 
          src={currentTrack.albumArt} 
          alt={currentTrack.album || 'Album'}
          className="w-8 h-8 rounded object-cover flex-shrink-0 shadow-sm"
        />
      ) : (
        <div className="w-8 h-8 rounded bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center flex-shrink-0">
          <span className="text-xs">🎵</span>
        </div>
      )}
      
      {/* Track info */}
      <div className="flex-1 min-w-0">
        {currentTrack ? (
          <>
            <div className="text-sm text-white truncate">
              {currentTrack.name}
            </div>
            <div className="text-xs text-gray-400 truncate">
              {currentTrack.artists 
                ? (Array.isArray(currentTrack.artists) 
                    ? currentTrack.artists.map((a: any) => a.name).join(', ')
                    : currentTrack.artists)
                : currentTrack.artist}
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-white truncate">
              {showWebPlayer ? 'Web Player' : 'Remote Player'}
            </div>
            <div className="text-xs text-gray-400 truncate">
              No track playing
            </div>
          </>
        )}
        
        {/* Mini progress bar */}
        <div className="mt-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-300"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>
      
      {/* Mini play/pause button */}
      <button 
        onClick={handlePlayPause}
        className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-3 h-3" />
        ) : (
          <Play className="w-3 h-3" />
        )}
      </button>
      
      {/* Expand button */}
      <button
        onClick={onExpand}
        className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
        title="Expand player"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
};

export default HeaderPlaybackControls;