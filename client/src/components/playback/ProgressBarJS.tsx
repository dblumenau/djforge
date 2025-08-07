import React, { useEffect, useRef } from 'react';
import ProgressBarJS from 'progressbar.js';
import { formatTime } from '../../utils/playback';

interface ProgressBarJSProps {
  currentPosition: number; // In seconds
  duration: number; // In seconds
  onSeek: (position: number) => void; // Position in seconds
  isTrackChanging?: boolean; // Kept for compatibility but not used
  variant?: 'compact' | 'normal' | 'fullscreen';
  showTime?: boolean;
  className?: string;
  containerId: string; // Unique ID for the container
}

const ProgressBarJSComponent: React.FC<ProgressBarJSProps> = ({
  currentPosition,
  duration,
  onSeek,
  isTrackChanging: _isTrackChanging = false, // Prefixed with _ to indicate intentionally unused
  variant = 'normal',
  showTime = true,
  className = '',
  containerId
}) => {
  const progressBarRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPositionRef = useRef(currentPosition);
  const durationRef = useRef(duration);
  
  // Keep refs updated
  useEffect(() => {
    currentPositionRef.current = currentPosition;
    durationRef.current = duration;
  }, [currentPosition, duration]);

  // Initialize progressbar.js
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    const frameId = requestAnimationFrame(() => {
      if (!progressBarRef.current && containerRef.current) {
        const strokeWidth = variant === 'compact' ? 4 : 8;
        const color = variant === 'fullscreen' ? '#ef4444' : '#1db954'; // Red for fullscreen, Spotify green otherwise
        
        progressBarRef.current = new ProgressBarJS.Line(containerRef.current, {
          strokeWidth,
          color,
          trailColor: variant === 'compact' ? 'rgba(64, 64, 64, 0.3)' : 'rgba(64, 64, 64, 0.5)',
          duration: 0, // No animation for instant updates
          svgStyle: {
            width: '100%',
            height: '100%'
          },
          trailWidth: strokeWidth
        });
        
        // Set initial progress immediately after creation using current values from refs
        if (durationRef.current > 0) {
          const initialProgress = Math.min(currentPositionRef.current / durationRef.current, 1);
          progressBarRef.current.set(initialProgress);
        }
      }
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (progressBarRef.current) {
        progressBarRef.current.destroy();
        progressBarRef.current = null;
      }
    };
  }, [variant]); // Only re-init on variant change

  // Update progress
  useEffect(() => {
    if (progressBarRef.current && duration > 0) {
      const progress = Math.min(Math.max(0, currentPosition / duration), 1); // Ensure 0-1 range
      progressBarRef.current.set(progress);
    } else if (progressBarRef.current && duration === 0) {
      // If duration is 0, set progress to 0
      progressBarRef.current.set(0);
    }
  }, [currentPosition, duration]);

  // Handle seeking
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration === 0) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newPosition = Math.floor(duration * percentage);
    
    onSeek(newPosition);
  };

  // Style configurations for different variants
  const getContainerStyle = () => {
    const baseStyle: React.CSSProperties = {
      position: 'relative',
      cursor: 'pointer',
      overflow: 'hidden'
    };

    switch (variant) {
      case 'compact':
        return {
          ...baseStyle,
          height: '4px',
          borderRadius: '2px',
          background: 'rgba(64, 64, 64, 0.3)', // More visible default background
          transition: 'background 0.3s ease'
        };
      case 'fullscreen':
        return {
          ...baseStyle,
          height: '12px',
          borderRadius: '6px',
          background: 'linear-gradient(to bottom, rgba(64,64,64,0.5) 0%, rgba(64,64,64,0.3) 50%, rgba(64,64,64,0.5) 100%)',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.15), inset 0 1px 2px rgba(0,0,0,0.5)'
        };
      default:
        return {
          ...baseStyle,
          height: '12px',
          borderRadius: '6px',
          background: 'linear-gradient(to bottom, rgba(64,64,64,0.5) 0%, rgba(64,64,64,0.3) 50%, rgba(64,64,64,0.5) 100%)',
          boxShadow: '0 0 20px rgba(29, 185, 84, 0.15), inset 0 1px 2px rgba(0,0,0,0.5)'
        };
    }
  };

  return (
    <div className={className}>
      <div 
        ref={containerRef}
        id={containerId}
        onClick={handleClick}
        style={getContainerStyle()}
      />
      
      {showTime && variant !== 'compact' && (
        <div className={`flex justify-between mt-2 ${variant === 'fullscreen' ? 'text-xs text-gray-400' : 'text-sm text-gray-400'}`}>
          <span>{formatTime(currentPosition * 1000)}</span>
          <span>{formatTime(duration * 1000)}</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(ProgressBarJSComponent);