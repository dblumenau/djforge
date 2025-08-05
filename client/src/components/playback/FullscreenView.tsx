import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Music } from 'lucide-react';
import { PlaybackState } from '../../types/playback.types';
import ControlButtons from './ControlButtons';
import SecondaryControls from './SecondaryControls';
import ProgressBar from './ProgressBar';
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
}) => {
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
    <div className="fixed inset-0 z-[90] fullscreen-playback-view">
      {/* Main backdrop - no blur for performance */}
      <div className="absolute inset-0 bg-black/80" />
      
      {/* Content container */}
      <div className="relative h-full w-full flex items-center justify-center">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all z-20"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        
        {playbackState.track ? (
          <>
            {/* Dark backdrop behind everything - no blur */}
            <div className="absolute inset-0 bg-black/40" />
            
            {/* Center: Large Album Art with Ambient Glow */}
            <div className="relative p-32">
              {/* Album Art Container */}
              <div className="relative w-[500px] h-[500px] md:w-[600px] md:h-[600px] lg:w-[700px] lg:h-[700px]">
                {playbackState.track.albumArt ? (
                  <>
                    {/* Ambient glow layer - blurred album art */}
                    <div 
                      className="absolute -inset-20 opacity-60 rounded-3xl"
                      style={{
                        background: `url(${playbackState.track.albumArt})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(100px) saturate(1.5)',
                        transform: 'scale(1.2)',
                      }}
                    />
                    
                    {/* Secondary glow for extra depth */}
                    <div 
                      className="absolute -inset-10 opacity-40 rounded-3xl"
                      style={{
                        background: `url(${playbackState.track.albumArt})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(50px) saturate(2)',
                        transform: 'scale(1.1)',
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
                    <Music className="w-48 h-48 text-gray-500" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Track info - Top left */}
            <div className="absolute top-6 left-6 max-w-md z-20">
              <h1 className="text-3xl font-bold text-white mb-1 drop-shadow-lg">{playbackState.track.name}</h1>
              <p className="text-xl text-gray-200 drop-shadow-lg">{playbackState.track.artist}</p>
              <p className="text-lg text-gray-300 drop-shadow-lg">{playbackState.track.album}</p>
            </div>
            
            {/* Compact controls - Bottom right corner */}
            <div className="absolute bottom-6 right-6 bg-black/70 rounded-2xl px-16 py-4 shadow-2xl border border-white/10 max-w-2xl overflow-hidden">              
              {/* Content wrapper to ensure everything stays clickable */}
              <div className="relative z-10">
                {/* Progress bar */}
                <div className="mb-3">
                  <ProgressBar
                    currentPosition={localPosition}
                    duration={playbackState.track.duration}
                    isTrackChanging={isTrackChanging}
                    onSeek={onSeek}
                    className="h-1.5 bg-gray-700/80"
                    progressClassName="bg-gradient-to-r from-red-500 to-red-400"
                    timeClassName="text-xs text-gray-400"
                  />
                </div>
                
                {/* Main controls */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  <ControlButtons
                    isPlaying={playbackState.isPlaying}
                    loading={false}
                    onPlayPause={onPlayPause}
                    onSkip={onSkip}
                    onPrevious={onPrevious}
                    shuffleState={playbackState.shuffleState}
                    repeatState={playbackState.repeatState}
                    onShuffle={onShuffle}
                    onRepeat={onRepeat}
                    size="sm"
                    playButtonClassName="p-3 bg-red-500 rounded-full text-white hover:bg-red-400"
                    otherButtonClassName="p-1.5 rounded-lg transition-all"
                    activeClassName="text-red-400 bg-red-400/20"
                    inactiveClassName="text-gray-400 hover:bg-white/10"
                  />
                </div>
                
                {/* Secondary controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {playbackState.track?.id && (
                      <HeartIcon
                        filled={savedStatus.get(playbackState.track.id) || false}
                        loading={libraryLoading.get(playbackState.track.id) || false}
                        size="sm"
                        onClick={() => playbackState.track?.id && onToggleSave(playbackState.track.id)}
                      />
                    )}
                  </div>
                  
                  <SecondaryControls
                    volume={volume}
                    onVolumeChange={onVolumeChange}
                    onShowQueue={onShowQueue}
                    compact={true}
                    volumeClassName="w-16 h-1 accent-red-500"
                    queueIconClassName="w-4 h-4"
                    buttonClassName="p-1 text-gray-400 hover:text-white transition-colors"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="w-32 h-32 mb-4 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
              <Music className="w-16 h-16 text-gray-600" />
            </div>
            <p className="text-2xl text-gray-400">No track playing</p>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default FullscreenView;