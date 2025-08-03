import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { PlaybackState } from '../../types/playback.types';
import VinylDisplay from './VinylDisplay';
import ControlButtons from './ControlButtons';
import SecondaryControls from './SecondaryControls';
import ProgressBar from './ProgressBar';
import HeartIcon from '../HeartIcon';

interface FullscreenViewProps {
  playbackState: PlaybackState;
  vinylRotation: number;
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
  vinylRotation,
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
    <div className="fixed inset-0 z-[90]">
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
            
            {/* Center: Large Vinyl as the star */}
            <div className="relative">
              {/* Main Vinyl - Even larger and centered */}
              <div className="relative w-[650px] h-[650px] md:w-[750px] md:h-[750px] lg:w-[850px] lg:h-[850px]">
                <VinylDisplay
                  albumArt={playbackState.track.albumArt}
                  albumName={playbackState.track.album}
                  rotation={vinylRotation}
                  size="xl"
                  className="w-full h-full"
                  style={{
                    boxShadow: '0 0 80px rgba(0, 0, 0, 0.8), 0 0 120px rgba(0, 0, 0, 0.5)'
                  }}
                />
              </div>
            </div>
            
            {/* Track info - Top left */}
            <div className="absolute top-6 left-6 max-w-md">
              <h1 className="text-3xl font-bold text-white mb-1 drop-shadow-lg">{playbackState.track.name}</h1>
              <p className="text-xl text-gray-200 drop-shadow-lg">{playbackState.track.artist}</p>
              <p className="text-lg text-gray-300 drop-shadow-lg">{playbackState.track.album}</p>
            </div>
            
            {/* Compact controls - Bottom right corner */}
            <div className="absolute bottom-6 right-6 bg-black/70 rounded-2xl p-4 shadow-2xl border border-white/10 max-w-sm overflow-hidden">              
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
            <VinylDisplay
              albumArt={null}
              albumName=""
              rotation={0}
              size="xl"
              className="w-32 h-32 mb-4 mx-auto"
            />
            <p className="text-2xl text-gray-400">No track playing</p>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default FullscreenView;