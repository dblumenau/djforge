import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Music, RefreshCw } from 'lucide-react';
import { PlaybackState } from '../../types/playback.types';
import ControlButtons from './ControlButtons';
import SecondaryControls from './SecondaryControls';
import ProgressBarJS from './ProgressBarJS';
import HeartIcon from '../HeartIcon';

interface FullscreenViewProps {
  playbackState: PlaybackState;
  volume: number;
  savedStatus: Map<string, boolean>;
  libraryLoading: Map<string, boolean>;
  localPosition: number;
  isTrackChanging: boolean;
  onClose: () => void;
  onPlayPause: () => void;
  onSkip: () => void;
  onPrevious: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onVolumeChange: (volume: number) => void;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  onShowQueue?: () => void;
  onToggleSave: (trackId: string) => void;
  onRefresh?: () => void;
}

const FullscreenView: React.FC<FullscreenViewProps> = ({
  playbackState,
  volume,
  savedStatus,
  libraryLoading,
  localPosition,
  isTrackChanging,
  onClose,
  onPlayPause,
  onSkip,
  onPrevious,
  onShuffle,
  onRepeat,
  onVolumeChange,
  onSeek,
  onShowQueue,
  onToggleSave,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    
    setIsRefreshing(true);
    await onRefresh();
    
    // Keep spinning for at least 500ms for visual feedback
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const modal = (
    <div className="fixed inset-0 z-[90] fullscreen-playback-view" style={{ height: '100dvh' }}>
      {/* Main backdrop - no blur for performance */}
      <div className="absolute inset-0 bg-black/80" />
      
      {/* Content container - Mobile viewport height optimization */}
      <div className="relative h-full w-full flex items-center justify-center min-h-screen sm:min-h-0 overflow-hidden">
        {/* Top controls - refresh and close buttons */}
        <div className="absolute top-3 right-3 sm:top-6 sm:right-6 flex gap-2 z-20">
          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh playback state"
            >
              <RefreshCw className={`w-5 h-5 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {playbackState.track ? (
          <>
            {/* Dark backdrop behind everything - no blur */}
            <div className="absolute inset-0 bg-black/40" />
            
            {/* Center: Large Album Art with Ambient Glow - responsive padding */}
            <div className="relative p-4 sm:p-8 md:p-12 lg:p-16 xl:p-20 2xl:p-24 flex items-center justify-center max-h-[60vh] sm:max-h-none">
              {/* Album Art Container - responsive sizing with mobile constraints */}
              <div className="relative w-[240px] h-[240px] sm:w-[320px] sm:h-[320px] md:w-[450px] md:h-[450px] lg:w-[600px] lg:h-[600px] xl:w-[700px] xl:h-[700px] 2xl:w-[800px] 2xl:h-[800px] max-w-[60vw] max-h-[60vw] sm:max-w-none sm:max-h-none">
                {playbackState.track.albumArt ? (
                  <>
                    {/* Primary ambient glow - large color spread */}
                    <div 
                      className="absolute -inset-32 sm:-inset-48 md:-inset-64 lg:-inset-80 xl:-inset-96 opacity-40"
                      style={{
                        background: `url(${playbackState.track.albumArt})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(150px) saturate(3) brightness(1.3) contrast(1.2)',
                        transform: 'scale(2) rotate(45deg)',
                        borderRadius: '50%',
                      }}
                    />
                    
                    {/* Secondary glow layer - medium spread */}
                    <div 
                      className="absolute -inset-20 sm:-inset-32 md:-inset-40 lg:-inset-48 xl:-inset-64 opacity-50 rounded-full"
                      style={{
                        background: `url(${playbackState.track.albumArt})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(100px) saturate(2.5) brightness(1.2)',
                        transform: 'scale(1.5)',
                      }}
                    />
                    
                    {/* Tertiary glow for depth - closer to album */}
                    <div 
                      className="absolute -inset-8 sm:-inset-12 md:-inset-16 lg:-inset-20 xl:-inset-24 opacity-60 rounded-full"
                      style={{
                        background: `url(${playbackState.track.albumArt})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(60px) saturate(2) brightness(1.1)',
                        transform: 'scale(1.2)',
                      }}
                    />
                    
                    {/* Main album art */}
                    <img 
                      src={playbackState.track.albumArt}
                      alt={playbackState.track.album || 'Album art'}
                      className="relative z-10 w-full h-full rounded-3xl object-cover"
                      style={{
                        boxShadow: '0 20px 80px rgba(0, 0, 0, 0.6), 0 0 120px rgba(0, 0, 0, 0.4)',
                        // Ensure image fills container completely
                        objectFit: 'cover',
                        objectPosition: 'center',
                        // Slightly scale up to eliminate any edge gaps
                        transform: 'scale(1.01)'
                      }}
                    />
                  </>
                ) : (
                  <div className="relative z-10 w-full h-full rounded-3xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-2xl"
                       style={{
                         boxShadow: '0 0 80px rgba(0, 0, 0, 0.8), 0 0 120px rgba(0, 0, 0, 0.5)'
                       }}>
                    <Music className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 text-gray-500" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Track info - responsive positioning and sizing */}
            <div className="absolute top-3 left-3 sm:top-6 sm:left-6 max-w-[calc(100%-6rem)] sm:max-w-md z-20">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-0.5 sm:mb-1 drop-shadow-lg line-clamp-2">{playbackState.track.name}</h1>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-200 drop-shadow-lg line-clamp-1">{playbackState.track.artist}</p>
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-300 drop-shadow-lg line-clamp-1">{playbackState.track.album}</p>
            </div>
            
            {/* Compact controls - Positioned at bottom right with frosted glass effect */}
            <div className="fixed bottom-8 right-8 z-30 bg-black/40 backdrop-blur-xl rounded-2xl px-4 py-4 sm:px-6 sm:py-4 shadow-2xl border border-white/20" 
                 style={{ 
                   backdropFilter: 'blur(20px) saturate(180%)',
                   WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                   background: 'rgba(0, 0, 0, 0.5)',
                   minWidth: '400px',
                   maxWidth: '500px'
                 }}>              
              {/* Content wrapper to ensure everything stays clickable */}
              <div className="relative z-10">
                {/* Progress bar */}
                <div className="mb-3">
                  <ProgressBarJS
                    currentPosition={localPosition}
                    duration={playbackState.track.duration}
                    isTrackChanging={isTrackChanging}
                    onSeek={(position) => {
                      // Create a synthetic mouse event for compatibility
                      const duration = playbackState.track?.duration || 1;
                      const fakeEvent = {
                        currentTarget: { offsetWidth: 1 },
                        nativeEvent: { offsetX: position / duration }
                      } as React.MouseEvent<HTMLDivElement>;
                      onSeek(fakeEvent);
                    }}
                    variant="fullscreen"
                    showTime={true}
                    containerId="progressbar-fullscreen"
                  />
                </div>
                
                {/* Main controls - responsive layout */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2 mb-3">
                  <ControlButtons
                    isPlaying={playbackState.isPlaying}
                    loading={false}
                    onPlayPause={onPlayPause}
                    onSkip={onSkip}
                    onPrevious={onPrevious}
                    // Removed shuffle and repeat from here - they're in SecondaryControls
                    size="sm"
                    variant="mobile"
                    isMobile={true}
                    playButtonClassName="p-3 sm:p-4 bg-red-500 rounded-full text-white hover:bg-red-400 shadow-lg transition-all"
                    otherButtonClassName="p-2 sm:p-2.5 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                    activeClassName="text-red-400 bg-red-400/20"
                    inactiveClassName="text-gray-400 hover:bg-white/10 hover:text-white"
                  />
                </div>
                
                {/* Secondary controls - responsive layout */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
                  {/* Heart icon - touch-friendly sizing */}
                  <div className="flex items-center justify-center sm:justify-start">
                    {playbackState.track?.id && (
                      <HeartIcon
                        filled={savedStatus.get(playbackState.track.id) || false}
                        loading={libraryLoading.get(playbackState.track.id) || false}
                        size="sm"
                        onClick={() => playbackState.track?.id && onToggleSave(playbackState.track.id)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                        filledColor="text-red-500"
                      />
                    )}
                  </div>
                  
                  {/* Queue, shuffle and repeat controls - mobile-optimized (no volume in fullscreen) */}
                  <div className="flex items-center gap-3 sm:gap-2">
                    <SecondaryControls
                      shuffleState={playbackState.shuffleState}
                      repeatState={playbackState.repeatState}
                      onShuffle={onShuffle}
                      onRepeat={onRepeat}
                      volume={volume}
                      onVolumeChange={onVolumeChange}
                      onShowQueue={onShowQueue}
                      compact={true}
                      variant="mobile"
                      isMobile={true}
                      hideVolume={true}  // Hide volume in fullscreen - you should be vibing not fiddling!
                      queueIconClassName="w-5 h-5 sm:w-4 sm:h-4"
                      buttonClassName="p-2 sm:p-1.5 text-gray-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/10"
                      activeColor="text-red-400"
                      activeBgColor="bg-red-400/20"
                      indicatorBgColor="bg-red-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center px-4">
            <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 mb-4 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
              <Music className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 text-gray-600" />
            </div>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-400">No track playing</p>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default FullscreenView;