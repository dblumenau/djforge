import React from 'react';
import HeartIcon from '../HeartIcon';

interface SecondaryControlsProps {
  shuffleState?: boolean;
  repeatState?: 'off' | 'track' | 'context';
  volume: number;
  showVolume?: boolean;
  savedStatus?: Map<string, boolean>;
  libraryLoading?: Map<string, boolean>;
  trackId?: string;
  variant?: 'mobile' | 'desktop';
  isMobile?: boolean;
  onShuffle?: () => void;
  onRepeat?: () => void;
  onVolumeChange: (volume: number) => void;
  onVolumeToggle?: () => void;
  setShowVolume?: (show: boolean) => void;
  onToggleSave?: (trackId: string) => void;
  onShowQueue?: () => void;
  onClearQueue?: () => void;
  loading?: boolean;
  compact?: boolean;
  volumeClassName?: string;
  queueIconClassName?: string;
  buttonClassName?: string;
  activeColor?: string; // For active state color customization
  activeBgColor?: string; // For active state background color
  indicatorBgColor?: string; // For the "1" indicator on repeat
  hideVolume?: boolean; // Hide volume control entirely
}

const SecondaryControls: React.FC<SecondaryControlsProps> = ({
  shuffleState,
  repeatState,
  volume,
  showVolume = false,
  savedStatus,
  libraryLoading,
  trackId,
  variant = 'desktop',
  isMobile: isMobileProp,
  onShuffle,
  onRepeat,
  onVolumeChange,
  onVolumeToggle,
  setShowVolume,
  onToggleSave,
  onShowQueue,
  onClearQueue,
  loading = false,
  compact = false,
  volumeClassName,
  queueIconClassName,
  buttonClassName,
  activeColor = 'text-green-400',
  activeBgColor = 'bg-green-400/20',
  indicatorBgColor = 'bg-green-500',
  hideVolume = false
}) => {
  const isMobile = isMobileProp ?? variant === 'mobile';
  const actualOnVolumeToggle = onVolumeToggle || (() => setShowVolume?.(!showVolume));

  if (isMobile) {
    return (
      <>
        {/* Main shuffle/repeat controls row for mobile */}
        <div className="flex items-center justify-center gap-2">
          {/* Shuffle */}
          <button
            onClick={onShuffle}
            className={`p-1.5 rounded-full transition-all hover:scale-110 ${
              shuffleState 
                ? `${activeColor} ${activeBgColor}` 
                : 'text-gray-400 hover:text-white'
            }`}
            title="Shuffle"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
            </svg>
          </button>

          {/* Repeat */}
          <button
            onClick={onRepeat}
            className={`p-1.5 rounded-full transition-all hover:scale-110 relative ${
              repeatState !== 'off' 
                ? `${activeColor} ${activeBgColor}` 
                : 'text-gray-400 hover:text-white'
            }`}
            title={`Repeat: ${repeatState}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
            </svg>
            {repeatState === 'track' && (
              <span className={`absolute -top-1 -right-1 text-xs ${indicatorBgColor} text-black rounded-full w-3 h-3 flex items-center justify-center font-bold`}>
                1
              </span>
            )}
          </button>
        </div>

        {/* Secondary controls row for mobile */}
        <div className="flex items-center justify-between gap-2">
          {/* Left side - Heart */}
          {trackId && savedStatus && libraryLoading && onToggleSave && (
            <div className="flex-shrink-0">
              <HeartIcon
                filled={savedStatus.get(trackId) || false}
                loading={libraryLoading.get(trackId) || false}
                size="sm"
                onClick={() => onToggleSave(trackId)}
              />
            </div>
          )}

          {/* Right side - Volume and Queue */}
          <div className="flex items-center gap-1 relative">
            {/* Volume */}
            {!hideVolume && (
              <>
                <button
                  onClick={actualOnVolumeToggle}
                  className="p-2 rounded text-gray-400 hover:text-white transition-colors"
                  title="Volume"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                </button>
                
                {/* Volume modal for mobile */}
                {showVolume && (
                  <div className="absolute bottom-full mb-2 right-0 bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg p-3 z-10">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => onVolumeChange(Number(e.target.value))}
                      className="w-24 accent-green-500"
                      title={`Volume: ${volume}%`}
                    />
                    <div className="text-center text-xs text-gray-300 mt-1">{volume}%</div>
                  </div>
                )}
              </>
            )}

            {/* Queue */}
            {onShowQueue && (
              <button
                onClick={onShowQueue}
                className="p-2 rounded text-gray-400 hover:text-white transition-colors"
                title="View queue"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  // Desktop/Compact layout
  if (compact) {
    // Compact mode for fullscreen - just volume and queue
    if (isMobile) {
      return (
        <div className="flex items-center gap-3">
          {/* Volume */}
          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className={volumeClassName || "w-24 h-1.5 accent-red-500"}
              title={`Volume: ${volume}%`}
              style={{ minHeight: '44px' }} // Ensure touch-friendly height
            />
          </div>

          {/* Queue */}
          {onShowQueue && (
            <button
              onClick={onShowQueue}
              className={buttonClassName || "p-2 text-gray-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/10"}
              title="View queue"
            >
              <svg className={queueIconClassName || "w-5 h-5"} fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
              </svg>
            </button>
          )}
        </div>
      );
    }
    
    // Desktop compact mode
    return (
      <div className="flex items-center gap-2">
        {/* Volume */}
        <div className="relative">
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className={volumeClassName || "w-16 h-1 accent-red-500"}
            title={`Volume: ${volume}%`}
          />
        </div>

        {/* Queue */}
        {onShowQueue && (
          <button
            onClick={onShowQueue}
            className={buttonClassName || "p-1 text-gray-400 hover:text-white transition-colors"}
            title="View queue"
          >
            <svg className={queueIconClassName || "w-4 h-4"} fill="currentColor" viewBox="0 0 24 24">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Main controls row - shuffle and repeat */}
      {(onShuffle || onRepeat) && (
        <div className="flex items-center justify-center gap-4">
          {/* Shuffle */}
          {onShuffle && (
            <button
              onClick={onShuffle}
              className={`p-2 rounded-lg transition-all hover:scale-110 ${
                shuffleState 
                  ? 'text-green-400 bg-green-400/20' 
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Shuffle"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
              </svg>
            </button>
          )}

          {/* Repeat */}
          {onRepeat && (
            <button
              onClick={onRepeat}
              className={`p-2 rounded-lg transition-all hover:scale-110 relative ${
                repeatState !== 'off'
                  ? 'text-green-400 bg-green-400/20' 
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title={`Repeat: ${repeatState}`}
            >
              {repeatState === 'track' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                </svg>
              )}
            </button>
          )}
        </div>
      )}

      {/* Additional controls */}
      <div className="flex items-center justify-between">
        {/* Left side - Heart/Save */}
        <div className="flex items-center gap-2">
          {trackId && onToggleSave && savedStatus && libraryLoading && (
            <HeartIcon
              filled={savedStatus.get(trackId) || false}
              loading={libraryLoading.get(trackId) || false}
              size="sm"
              onClick={() => onToggleSave(trackId)}
            />
          )}
        </div>
        
        {/* Right side - Volume, Clear Queue, Queue */}
        <div className="flex items-center gap-2">
          {/* Volume */}
          <div className="relative">
            <button
              onClick={actualOnVolumeToggle}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Volume"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            </button>
            
            {showVolume && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg p-3 z-10">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="w-24 accent-green-500"
                  title={`Volume: ${volume}%`}
                />
                <div className="text-center text-xs text-gray-300 mt-1">{volume}%</div>
              </div>
            )}
          </div>

          {/* Clear Queue */}
          {onClearQueue && (
            <button
              onClick={onClearQueue}
              disabled={loading}
              className="p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              title="Clear queue"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z"/>
              </svg>
            </button>
          )}

          {/* Queue */}
          {onShowQueue && (
            <button
              onClick={onShowQueue}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="View queue"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default SecondaryControls;