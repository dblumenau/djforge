import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Music, RefreshCw, Calendar, Star, Hash, ExternalLink } from 'lucide-react';
import { PlaybackState } from '../../types/playback.types';
import ControlButtons from './ControlButtons';
import ProgressBarJS from './ProgressBarJS';
import HeartIcon from '../HeartIcon';

interface FullscreenViewProps {
  playbackState: PlaybackState;
  savedStatus: Map<string, boolean>;
  libraryLoading: Map<string, boolean>;
  localPosition: number;
  isTrackChanging: boolean;
  context?: PlaybackState['context'];
  onClose: () => void;
  onPlayPause: () => void;
  onSkip: () => void;
  onPrevious: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  onShowQueue?: () => void;
  onToggleSave: (trackId: string) => void;
  onRefresh?: () => void;
}

const FullscreenView: React.FC<FullscreenViewProps> = ({
  playbackState,
  savedStatus,
  libraryLoading,
  localPosition,
  isTrackChanging,
  context,
  onClose,
  onPlayPause,
  onSkip,
  onPrevious,
  onShuffle,
  onRepeat,
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
            
            {/* Track info with enhanced metadata - responsive positioning and sizing */}
            <div className="absolute top-3 left-3 sm:top-6 sm:left-6 max-w-[calc(100%-6rem)] sm:max-w-lg z-20">
              {/* Main track info */}
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-0.5 sm:mb-1 drop-shadow-lg line-clamp-2">
                {playbackState.track.name}
              </h1>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-200 drop-shadow-lg line-clamp-1">
                {playbackState.track.artist}
              </p>
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-300 drop-shadow-lg line-clamp-1">
                {playbackState.track.album}
              </p>
              
              {/* Context display with badge - responsive wrapping at 350px */}
              {context && context.external_urls?.spotify && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1" style={{ maxWidth: '350px' }}>
                  <span className="text-xs sm:text-sm text-gray-300 drop-shadow-md whitespace-nowrap">Playing from</span>
                  <a 
                    href={context.external_urls.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs sm:text-sm text-red-500 hover:text-red-400 transition-colors font-medium drop-shadow-md break-words min-w-0"
                  >
                    {context.name || (context.type === 'playlist' ? 'Playlist' : 
                     context.type === 'album' ? 'Album' : 
                     context.type === 'artist' ? 'Artist Radio' : 
                     context.type === 'show' ? 'Podcast' : 
                     context.type.charAt(0).toUpperCase() + context.type.slice(1))}
                  </a>
                  <span className="px-2 py-0.5 text-xs bg-white/20 backdrop-blur-sm text-white/80 rounded-full drop-shadow-md whitespace-nowrap">
                    {context.type === 'playlist' ? 'Playlist' : 
                     context.type === 'album' ? 'Album' : 
                     context.type === 'artist' ? 'Artist Radio' : 
                     context.type === 'show' ? 'Podcast' : 
                     context.type.charAt(0).toUpperCase() + context.type.slice(1)}
                  </span>
                </div>
              )}
              
              {/* Additional metadata */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                {playbackState.track.releaseDate && (
                  <span className="flex items-center gap-1 text-gray-300 drop-shadow-md">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>{new Date(playbackState.track.releaseDate).getFullYear()}</span>
                  </span>
                )}
                {playbackState.track.popularity !== undefined && (
                  <span className="flex items-center gap-1 text-gray-300 drop-shadow-md">
                    <Star className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>{playbackState.track.popularity}/100</span>
                  </span>
                )}
                {playbackState.track.track_number && (
                  <span className="flex items-center gap-1 text-gray-300 drop-shadow-md">
                    <Hash className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Track {playbackState.track.track_number}</span>
                  </span>
                )}
              </div>
              
              {/* Open in Spotify link on its own line */}
              {playbackState.track.external_urls?.spotify && (
                <div className="mt-2">
                  <a 
                    href={playbackState.track.external_urls.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs sm:text-sm text-red-500 hover:text-red-400 transition-colors drop-shadow-md"
                  >
                    <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Open in Spotify</span>
                  </a>
                </div>
              )}
            </div>
            
            {/* Compact controls - Positioned at bottom right with frosted glass effect */}
            <div className="fixed bottom-8 right-8 z-30 bg-black/40 backdrop-blur-xl rounded-2xl px-6 py-3 pt-0 sm:px-8 sm:py-3 shadow-2xl border border-white/20" 
                 style={{ 
                   backdropFilter: 'blur(20px) saturate(180%)',
                   WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                   background: 'rgba(0, 0, 0, 0.5)',
                   minWidth: '480px',
                   maxWidth: '580px'
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
                
                {/* Single row controls layout with perfect center alignment */}
                <div className="relative flex items-center justify-between">
                  {/* Left group: Heart icon only */}
                  <div className="flex items-center gap-2">
                    {/* Heart icon */}
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
                  
                  {/* Center group: Main playback controls - perfectly centered */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
                    <ControlButtons
                      isPlaying={playbackState.isPlaying}
                      loading={false}
                      onPlayPause={onPlayPause}
                      onSkip={onSkip}
                      onPrevious={onPrevious}
                      size="sm"
                      variant="mobile"
                      isMobile={true}
                      playButtonClassName="p-3 sm:p-4 bg-red-500 rounded-full text-white hover:bg-red-400 shadow-lg transition-all"
                      otherButtonClassName="p-2 sm:p-2.5 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                      activeClassName="text-red-400 bg-red-400/20"
                      inactiveClassName="text-gray-400 hover:bg-white/10 hover:text-white"
                    />
                  </div>
                  
                  {/* Right group: Shuffle, Repeat, Queue - with much more separation */}
                  <div className="flex items-center">
                    {/* Shuffle and Repeat grouped tightly together */}
                    <div className="flex items-center gap-1">
                      {/* Shuffle button */}
                      <button
                        onClick={onShuffle}
                        className={`p-2 sm:p-2.5 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${
                          playbackState.shuffleState 
                            ? 'text-red-400 bg-red-400/20' 
                            : 'text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                        title="Shuffle"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                        </svg>
                      </button>

                      {/* Repeat button */}
                      <button
                        onClick={onRepeat}
                        className={`p-2 sm:p-2.5 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center relative ${
                          playbackState.repeatState !== 'off' 
                            ? 'text-red-400 bg-red-400/20' 
                            : 'text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                        title={`Repeat: ${playbackState.repeatState}`}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                        </svg>
                        {playbackState.repeatState === 'track' && (
                          <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-black rounded-full w-3 h-3 flex items-center justify-center font-bold">
                            1
                          </span>
                        )}
                      </button>
                    </div>
                    
                    {/* Queue button with extra separation */}
                    {onShowQueue && (
                      <button
                        onClick={onShowQueue}
                        className="p-2 sm:p-1.5 text-gray-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 ml-3 sm:ml-4"
                        title="View queue"
                      >
                        <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                        </svg>
                      </button>
                    )}
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