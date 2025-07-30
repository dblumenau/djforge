import React, { useEffect, useState, useRef } from 'react';
import { useWebPlayer } from '../hooks/useWebPlayer';
import { webPlayerService } from '../services/webPlayer.service';

interface SpotifyPlayerProps {
  onDeviceReady?: (deviceId: string) => void;
  onPlayerStateChanged?: (state: Spotify.PlaybackState | null) => void;
}

const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({ onDeviceReady }) => {
  const {
    playerState,
    error,
    togglePlayPause,
    nextTrack,
    previousTrack
  } = useWebPlayer(onDeviceReady);
  
  // Local state for smooth position updates
  const [currentPosition, setCurrentPosition] = useState(0);
  const animationFrameRef = useRef<number>();
  
  // Update position smoothly using requestAnimationFrame
  useEffect(() => {
    const updatePosition = () => {
      if (playerState.currentTrack && !playerState.isPaused) {
        const position = webPlayerService.getCurrentPosition();
        setCurrentPosition(position);
        animationFrameRef.current = requestAnimationFrame(updatePosition);
      }
    };
    
    if (playerState.currentTrack && !playerState.isPaused) {
      updatePosition();
    } else {
      setCurrentPosition(playerState.currentTrack?.position || 0);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playerState.isPaused, playerState.currentTrack]);

  // Handle play/pause button click
  const handlePlayPause = async () => {
    try {
      await togglePlayPause();
    } catch (error) {
      console.error('Play/pause error:', error);
    }
  };

  // Handle skip to next track
  const handleSkipNext = async () => {
    try {
      await nextTrack();
    } catch (error) {
      console.error('Skip next error:', error);
    }
  };

  // Handle skip to previous track
  const handleSkipPrevious = async () => {
    try {
      await previousTrack();
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

  // Progress percentage using local position for smooth updates
  const progressPercent = playerState.currentTrack 
    ? (currentPosition / playerState.currentTrack.duration) * 100
    : 0;

  if (error) {
    return (
      <div className="bg-gray-800/70 backdrop-blur-md rounded-lg p-6 shadow-xl border border-gray-700/40">
        <div className="text-center text-red-400">
          <p className="text-sm">Web Player Error</p>
          <p className="text-xs mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!playerState.currentTrack) {
    return (
      <div className="bg-gray-800/70 backdrop-blur-md rounded-lg p-6 shadow-xl border border-gray-700/40">
        <div className="text-center text-gray-400">
          <p className="text-sm">Web Player Ready</p>
          <p className="text-xs mt-2">Play something to see it here</p>
          <div className="mt-4 text-xs text-gray-500">
            <p>Device ID: {playerState.deviceId || 'Not available'}</p>
            <p>Is Active: {playerState.isActive ? 'Yes' : 'No'}</p>
            <p className="mt-2 text-yellow-400">To see album art:</p>
            <ol className="text-left mt-1 ml-4">
              <li>1. Start playing music on any device</li>
              <li>2. Make sure "Built In Player" is selected above</li>
              <li>3. The playback will transfer here</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/70 backdrop-blur-md rounded-lg p-6 shadow-xl border border-gray-700/40">
      <div className="flex items-center space-x-4">
        {/* Album Art */}
        {playerState.currentTrack.albumArt ? (
          <img 
            src={playerState.currentTrack.albumArt} 
            alt={playerState.currentTrack.album}
            className="w-20 h-20 rounded-md shadow-lg"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-20 h-20 rounded-md bg-gray-700 flex items-center justify-center">
            <span className="text-gray-500 text-xs">No Art</span>
          </div>
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
              <span>{formatTime(currentPosition)}</span>
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