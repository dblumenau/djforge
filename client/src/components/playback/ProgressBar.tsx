import React, { useMemo } from 'react';
import { formatTime } from '../../utils/playback';

interface ProgressBarProps {
  currentPosition: number; // In seconds
  duration: number; // In seconds
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
  
  // Memoize formatted time strings
  const formattedCurrentTime = useMemo(
    () => formatTime(currentPosition * 1000),
    [currentPosition]
  );
  
  const formattedDuration = useMemo(
    () => formatTime(duration * 1000),
    [duration]
  );
  
  // Memoize progress bar width style
  const progressStyle = useMemo(
    () => ({ width: `${(currentPosition / duration) * 100}%` }),
    [currentPosition, duration]
  );
  
  // Memoize className strings to avoid recreating them on every render
  const containerClassName = useMemo(
    () => {
      if (isMobile) {
        return `w-full h-6 bg-white/20 rounded-full cursor-pointer relative overflow-hidden group ${className || ''}`;
      }
      return `w-full h-2 bg-gray-700 rounded-full cursor-pointer relative overflow-hidden group ${className || ''}`;
    },
    [isMobile, className]
  );
  
  const progressBarClassName = useMemo(
    () => {
      const baseClass = 'h-full rounded-full relative';
      const gradientClass = progressClassName || (isMobile 
        ? 'bg-gradient-to-r from-green-400 to-green-500' 
        : 'bg-gradient-to-r from-green-500 to-green-400');
      const transitionClass = isTrackChanging ? '' : 'transition-all duration-300';
      return `${baseClass} ${gradientClass} ${transitionClass}`;
    },
    [progressClassName, isMobile, isTrackChanging]
  );
  
  const timeContainerClassName = useMemo(
    () => {
      const baseClass = 'flex justify-between';
      const sizeClass = isMobile ? 'text-xs' : 'text-sm font-medium';
      const colorClass = timeClassName || 'text-gray-400';
      return `${baseClass} ${sizeClass} ${colorClass}`;
    },
    [isMobile, timeClassName]
  );

  if (isMobile) {
    return (
      <div className="space-y-2">
        <div 
          className={containerClassName}
          onClick={onSeek}
        >
          <div 
            className={progressBarClassName}
            style={progressStyle}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className={timeContainerClassName}>
          <span>{formattedCurrentTime}</span>
          <span>{formattedDuration}</span>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="space-y-3">
      <div 
        className={containerClassName}
        onClick={onSeek}
      >
        <div 
          className={progressBarClassName}
          style={progressStyle}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
        </div>
      </div>
      <div className={timeContainerClassName}>
        <span>{formattedCurrentTime}</span>
        <span>{formattedDuration}</span>
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(ProgressBar, (prevProps, nextProps) => {
  // Custom comparison function - re-render only when these props change
  return (
    prevProps.currentPosition === nextProps.currentPosition &&
    prevProps.duration === nextProps.duration &&
    prevProps.isTrackChanging === nextProps.isTrackChanging &&
    prevProps.variant === nextProps.variant &&
    prevProps.isMobile === nextProps.isMobile &&
    prevProps.className === nextProps.className &&
    prevProps.progressClassName === nextProps.progressClassName &&
    prevProps.timeClassName === nextProps.timeClassName
    // Note: onSeek is a callback and likely changes on every parent render,
    // but we don't need to re-render for that
  );
});