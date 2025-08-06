import React from 'react';

interface ControlButtonsProps {
  isPlaying: boolean;
  loading: boolean;
  onPlayPause: () => void;
  onSkip: () => void;
  onPrevious: () => void;
  variant?: 'mobile' | 'desktop';
  isMobile?: boolean;
  shuffleState?: boolean;
  repeatState?: 'off' | 'track' | 'context';
  onShuffle?: () => void;
  onRepeat?: () => void;
  size?: string;
  playButtonClassName?: string;
  otherButtonClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
  isPlaying,
  loading,
  onPlayPause,
  onSkip,
  onPrevious,
  variant = 'desktop',
  isMobile: isMobileProp,
  shuffleState,
  repeatState,
  onShuffle,
  onRepeat,
  size,
  playButtonClassName,
  otherButtonClassName,
  activeClassName,
  inactiveClassName
}) => {
  const isMobile = isMobileProp ?? variant === 'mobile';

  // Determine sizes based on size prop and mobile state
  const getSizes = () => {
    if (size === 'sm') {
      return {
        playButton: isMobile ? 'p-3' : 'p-2',
        otherButton: isMobile ? 'p-3' : 'p-2', // Ensure minimum 44px touch targets
        playIcon: isMobile ? 'w-6 h-6' : 'w-5 h-5',
        otherIcon: isMobile ? 'w-5 h-5' : 'w-4 h-4',
        gap: isMobile ? 'gap-3' : 'gap-2',
        minTouch: isMobile ? 'min-w-[44px] min-h-[44px]' : ''
      };
    }
    return {
      playButton: isMobile ? 'p-4' : 'p-4',
      otherButton: isMobile ? 'p-3' : 'p-2.5',
      playIcon: isMobile ? 'w-7 h-7' : 'w-7 h-7',
      otherIcon: isMobile ? 'w-6 h-6' : 'w-6 h-6',
      gap: isMobile ? 'gap-4' : 'gap-4',
      minTouch: isMobile ? 'min-w-[44px] min-h-[44px]' : ''
    };
  };

  const sizes = getSizes();

  // Use custom class names if provided, otherwise use defaults
  const getPlayButtonClass = () => {
    if (playButtonClassName) return `${playButtonClassName} ${sizes.minTouch} flex items-center justify-center`;
    const baseClass = `${sizes.playButton} ${sizes.minTouch} rounded-full transition-all disabled:opacity-50 flex items-center justify-center`;
    return isMobile 
      ? `${baseClass} bg-white text-black hover:scale-110 shadow-lg hover:shadow-xl`
      : `${baseClass} bg-green-500 text-black hover:bg-green-400 hover:scale-110 shadow-xl hover:shadow-2xl`;
  };

  const getOtherButtonClass = (isActive = false) => {
    if (otherButtonClassName) {
      const baseClass = otherButtonClassName;
      if (activeClassName && inactiveClassName) {
        return `${baseClass} ${isActive ? activeClassName : inactiveClassName} ${sizes.minTouch}`;
      }
      return `${baseClass} ${sizes.minTouch}`;
    }
    
    // Default styling
    const baseClass = `${sizes.otherButton} ${sizes.minTouch} rounded-lg transition-all hover:scale-110 disabled:opacity-50 flex items-center justify-center`;
    if (isActive) {
      return `${baseClass} text-green-400 bg-green-400/20`;
    }
    return `${baseClass} text-gray-300 hover:text-white`;
  };

  return (
    <div className={`flex items-center justify-center ${sizes.gap}`}>
      {/* Shuffle */}
      {onShuffle && (
        <button
          onClick={onShuffle}
          disabled={loading}
          className={getOtherButtonClass(shuffleState)}
          title="Shuffle"
        >
          <svg className={sizes.otherIcon} fill="currentColor" viewBox="0 0 24 24">
            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
          </svg>
        </button>
      )}

      {/* Previous */}
      <button
        onClick={onPrevious}
        disabled={loading}
        className={getOtherButtonClass()}
        title="Previous track"
      >
        <svg className={sizes.otherIcon} fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        disabled={loading}
        className={getPlayButtonClass()}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg className={sizes.playIcon} fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg className={sizes.playIcon} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      {/* Next */}
      <button
        onClick={onSkip}
        disabled={loading}
        className={getOtherButtonClass()}
        title="Next track"
      >
        <svg className={sizes.otherIcon} fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>

      {/* Repeat */}
      {onRepeat && (
        <button
          onClick={onRepeat}
          disabled={loading}
          className={`${getOtherButtonClass(repeatState !== 'off')} relative`}
          title={`Repeat: ${repeatState}`}
        >
          <svg className={sizes.otherIcon} fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
          </svg>
          {repeatState === 'track' && (
            <span className={`absolute -top-1 -right-1 text-xs ${activeClassName?.includes('red') ? 'bg-red-500' : 'bg-green-500'} text-black rounded-full w-3 h-3 flex items-center justify-center font-bold`}>
              1
            </span>
          )}
        </button>
      )}
    </div>
  );
};

export default ControlButtons;