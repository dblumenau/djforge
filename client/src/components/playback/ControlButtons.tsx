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
  isMobile: isMobileProp
}) => {
  const isMobile = isMobileProp ?? variant === 'mobile';

  if (isMobile) {
    return (
      <div className="flex items-center justify-center gap-2">
        {/* Previous */}
        <button
          onClick={onPrevious}
          disabled={loading}
          className="p-2 rounded-full text-white hover:text-green-400 transition-all hover:scale-110 disabled:opacity-50"
          title="Previous track"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          disabled={loading}
          className="p-3 bg-white rounded-full text-black hover:scale-110 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Next */}
        <button
          onClick={onSkip}
          disabled={loading}
          className="p-2 rounded-full text-white hover:text-green-400 transition-all hover:scale-110 disabled:opacity-50"
          title="Next track"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Previous */}
      <button
        onClick={onPrevious}
        disabled={loading}
        className="p-2.5 text-gray-300 hover:text-white transition-all hover:scale-110 disabled:opacity-50"
        title="Previous track"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
        </svg>
      </button>

      {/* Play/Pause - Larger and more prominent */}
      <button
        onClick={onPlayPause}
        disabled={loading}
        className="p-4 bg-green-500 rounded-full text-black hover:bg-green-400 hover:scale-110 transition-all shadow-xl hover:shadow-2xl disabled:opacity-50"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      {/* Next */}
      <button
        onClick={onSkip}
        disabled={loading}
        className="p-2.5 text-gray-300 hover:text-white transition-all hover:scale-110 disabled:opacity-50"
        title="Next track"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>
    </div>
  );
};

export default ControlButtons;