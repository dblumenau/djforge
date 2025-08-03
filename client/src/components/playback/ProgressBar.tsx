import React from 'react';
import { formatTime } from '../../utils/playback';

interface ProgressBarProps {
  currentPosition: number;
  duration: number;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  isTrackChanging: boolean;
  variant?: 'mobile' | 'desktop';
  isMobile?: boolean;
  className?: string;
  progressClassName?: string;
  timeClassName?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  currentPosition,
  duration,
  onSeek,
  isTrackChanging,
  variant = 'desktop',
  isMobile: isMobileProp,
  className,
  progressClassName,
  timeClassName
}) => {
  const isMobile = isMobileProp ?? variant === 'mobile';

  if (isMobile) {
    return (
      <div className="space-y-2">
        <div 
          className={`w-full h-6 bg-white/20 rounded-full cursor-pointer relative overflow-hidden group ${className || ''}`}
          onClick={onSeek}
        >
          <div 
            className={`h-full ${progressClassName || 'bg-gradient-to-r from-green-400 to-green-500'} rounded-full relative ${
              isTrackChanging ? '' : 'transition-all duration-300'
            }`}
            style={{ width: `${(currentPosition / duration) * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className={`flex justify-between text-xs ${timeClassName || 'text-gray-400'}`}>
          <span>{formatTime(Math.floor(currentPosition))}</span>
          <span>{formatTime(Math.floor(duration))}</span>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="space-y-3">
      <div 
        className={`w-full h-2 bg-gray-700 rounded-full cursor-pointer relative overflow-hidden group ${className || ''}`}
        onClick={onSeek}
      >
        <div 
          className={`h-full ${progressClassName || 'bg-gradient-to-r from-green-500 to-green-400'} rounded-full relative ${
            isTrackChanging ? '' : 'transition-all duration-300'
          }`}
          style={{ width: `${(currentPosition / duration) * 100}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
        </div>
      </div>
      <div className={`flex justify-between text-sm font-medium ${timeClassName || 'text-gray-400'}`}>
        <span>{formatTime(Math.floor(currentPosition))}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

export default ProgressBar;