import React from 'react';
import { Music } from 'lucide-react';
import { PlaybackState } from '../../types/playback.types';
import VinylDisplay from './VinylDisplay';

interface MinimizedViewProps {
  playbackState: PlaybackState;
  wsConnected: boolean;
  vinylRotation: number;
  onToggleView: () => void;
}

const MinimizedView: React.FC<MinimizedViewProps> = ({
  playbackState,
  wsConnected,
  vinylRotation,
  onToggleView
}) => {
  return (
    <div className="flex items-center gap-3">
      {playbackState.track ? (
        <>
          {/* Mini Vinyl Display */}
          <div className="relative flex-shrink-0">
            <VinylDisplay
              albumArt={playbackState.track.albumArt}
              albumName={playbackState.track.album}
              rotation={vinylRotation}
              size="sm"
            />
          </div>
          
          {/* Connection Status Indicator */}
          <div 
            className={`w-2 h-2 rounded-full ${
              wsConnected 
                ? 'bg-green-500 animate-pulse' 
                : playbackState.isPlaying 
                  ? 'bg-yellow-500 animate-pulse' 
                  : 'bg-gray-500'
            }`} 
            title={wsConnected ? 'Live updates connected' : 'Live updates disconnected'}
          />
          
          {/* Track Info */}
          <div className="text-sm">
            <span className="text-white font-medium">{playbackState.track.name}</span>
            <span className="text-gray-400"> • </span>
            <span className="text-gray-400">{playbackState.track.artist}</span>
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500">No track playing</div>
      )}
    </div>
  );
};

export default MinimizedView;