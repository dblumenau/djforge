import React from 'react';
import { PlaybackState } from '../../types/playback.types';
import VinylDisplay from './VinylDisplay';

interface MinimizedViewProps {
  track: PlaybackState['track'];
  wsConnected: boolean;
  vinylRotation: number;
  vinylRef?: React.RefObject<HTMLElement>;
}

const MinimizedView: React.FC<MinimizedViewProps> = ({
  track,
  wsConnected,
  vinylRotation,
  vinylRef
}) => {
  return (
    <div className="flex items-center gap-3">
      {track ? (
        <>
          {/* Mini Vinyl Display */}
          <div className="relative flex-shrink-0">
            <VinylDisplay
              albumArt={track.albumArt}
              albumName={track.album}
              rotation={vinylRotation}
              vinylRef={vinylRef}
              size="sm"
            />
          </div>
          
          {/* Connection Status Indicator */}
          <div 
            className={`w-2 h-2 rounded-full ${
              wsConnected 
                ? 'bg-green-500 animate-pulse' 
                : 'bg-gray-500'
            }`} 
            title={wsConnected ? 'Live updates connected' : 'Live updates disconnected'}
          />
          
          {/* Track Info */}
          <div className="text-sm">
            <span className="text-white font-medium">{track.name}</span>
            <span className="text-gray-400"> • </span>
            <span className="text-gray-400">{track.artist}</span>
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500">No track playing</div>
      )}
    </div>
  );
};

export default MinimizedView;