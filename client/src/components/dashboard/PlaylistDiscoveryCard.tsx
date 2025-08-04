import { Play, Plus, Heart, Eye, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface PlaylistDiscoveryCardProps {
  playlist: {
    id: string;
    name: string;
    owner: string;
    description?: string;
    followers: number;
    trackCount: number;
    images: Array<{ url: string; height: number; width: number }>;
    summary?: string;
    characteristics?: {
      primaryGenre?: string;
      mood?: string;
      instrumentation?: string[];
      tempo?: string;
      decadeRange?: string;
    };
    matchScore?: number;
  };
  onPlay: (playlistId: string) => void;
  onQueue: (playlistId: string) => void;
  onSave: (playlistId: string) => void;
  onViewTracks: (playlistId: string) => void;
  isLoading?: boolean;
  isSaved?: boolean;
  isSaving?: boolean;
}

export default function PlaylistDiscoveryCard({ 
  playlist, 
  onPlay, 
  onQueue, 
  onSave, 
  onViewTracks,
  isLoading = false,
  isSaved = false,
  isSaving = false
}: PlaylistDiscoveryCardProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [showReadMore, setShowReadMore] = useState(false);

  // Get the description text (prioritize summary over description)
  const descriptionText = playlist.summary || playlist.description;

  // Check if description needs "Read more" button
  useEffect(() => {
    if (descriptionText) {
      // Simple character count approach - approximately 180 characters fits in 3 lines
      setShowReadMore(descriptionText.length > 180);
    }
  }, [descriptionText]);
  
  // Format follower count with K/M suffixes
  const formatFollowers = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Create 4-image mosaic or single image fallback
  const renderPlaylistImage = () => {
    const images = playlist.images;
    
    if (!images || images.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-zinc-800">
          <svg className="w-16 h-16 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </div>
      );
    }

    // For now, use single image (4-image mosaic would require multiple images from different sources)
    return (
      <img
        src={images[0].url}
        alt={playlist.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
      />
    );
  };

  return (
    <div className={`group relative bg-zinc-900 rounded-lg overflow-hidden hover:bg-zinc-800 transition-all duration-200 hover:shadow-xl h-[550px] md:h-[600px] flex flex-col ${isLoading ? 'pointer-events-none opacity-75' : ''}`}>
      {/* Playlist Cover with Play Overlay */}
      <div className="relative aspect-square overflow-hidden bg-zinc-800 flex-shrink-0 max-h-60">
        {renderPlaylistImage()}
        
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onPlay(playlist.id)}
            disabled={isLoading}
            className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform hover:bg-green-400 disabled:opacity-60"
            aria-label={`Play ${playlist.name}`}
          >
            {isLoading ? (
              <svg className="animate-spin h-7 w-7 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Play className="w-7 h-7 text-black ml-1" fill="currentColor" />
            )}
          </button>
        </div>

        {/* Follower count badge */}
        {playlist.followers > 0 && (
          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
            <Users className="w-3 h-3 text-zinc-300" />
            <span className="text-xs text-zinc-300 font-medium">
              {formatFollowers(playlist.followers)}
            </span>
          </div>
        )}

        {/* Match score badge (if available) */}
        {playlist.matchScore && (
          <div className="absolute top-3 left-3 bg-green-500/90 backdrop-blur-sm rounded-full px-2 py-1">
            <span className="text-xs text-black font-semibold">
              {Math.round(playlist.matchScore * 100)}% match
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 flex-1 flex flex-col min-h-0 gap-0">
        {/* Playlist Info */}
        <div className="space-y-1 flex-shrink-0 mb-3">
          <h3 className="font-semibold text-white line-clamp-2 group-hover:text-green-400 transition-colors">
            {playlist.name}
          </h3>
          <p className="text-sm text-zinc-400 truncate">
            By {playlist.owner}
          </p>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{playlist.trackCount} tracks</span>
            {playlist.characteristics?.primaryGenre && (
              <span className="px-2 py-0.5 bg-zinc-800 rounded-full">
                {playlist.characteristics.primaryGenre}
              </span>
            )}
          </div>
        </div>

        {/* LLM Summary with Expandable Description */}
        {descriptionText && (
          <div className="flex-shrink-0 mb-3">
            <div 
              ref={descriptionRef}
              className={`text-sm text-zinc-300 leading-relaxed transition-all duration-300 ${
                isDescriptionExpanded 
                  ? 'max-h-24 overflow-y-auto pr-2' 
                  : 'line-clamp-3'
              }`}
              style={isDescriptionExpanded ? {
                scrollbarWidth: 'thin',
                scrollbarColor: '#52525b #27272a'
              } : undefined}
            >
              {descriptionText}
            </div>
            
            {/* Read More/Less Button */}
            {showReadMore && (
              <button
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="flex items-center gap-1 mt-2 text-xs text-zinc-400 hover:text-zinc-300 transition-colors focus:outline-none focus:text-zinc-300"
                aria-expanded={isDescriptionExpanded}
                aria-label={isDescriptionExpanded ? 'Show less of description' : 'Show more of description'}
              >
                {isDescriptionExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Read more
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Characteristics Table */}
        {playlist.characteristics && (
          <div className="border-t border-zinc-800 pt-3 flex-1 min-h-0 overflow-hidden mb-3">
            <div className={`grid grid-cols-2 gap-y-2 text-sm h-full overflow-y-auto ${
              isDescriptionExpanded ? 'max-h-32' : ''
            }`}>
              {/* Mood */}
              {playlist.characteristics.mood && (
                <>
                  <div className="text-zinc-500">Mood</div>
                  <div className="text-zinc-300">{playlist.characteristics.mood}</div>
                </>
              )}
              
              {/* Instrumentation */}
              {playlist.characteristics.instrumentation && playlist.characteristics.instrumentation.length > 0 && (
                <>
                  <div className="text-zinc-500">Instruments</div>
                  <div className="text-zinc-300">
                    {playlist.characteristics.instrumentation.slice(0, 3).join(', ')}
                  </div>
                </>
              )}
              
              {/* Decade Range */}
              {playlist.characteristics.decadeRange && (
                <>
                  <div className="text-zinc-500">Decade</div>
                  <div className="text-zinc-300">{playlist.characteristics.decadeRange}</div>
                </>
              )}
              
              {/* Tempo */}
              {playlist.characteristics.tempo && (
                <>
                  <div className="text-zinc-500">Tempo</div>
                  <div className="text-zinc-300">{playlist.characteristics.tempo}</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 flex-shrink-0 mt-auto min-h-[84px]">
          <button
            onClick={() => onQueue(playlist.id)}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm rounded-md transition-colors disabled:opacity-60"
            aria-label={`Add ${playlist.name} to queue`}
          >
            <Plus className="w-4 h-4" />
            Queue
          </button>
          
          <button
            onClick={() => onSave(playlist.id)}
            disabled={isLoading || isSaving}
            className={`flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-all disabled:opacity-60 ${
              isSaved 
                ? 'bg-green-600/20 hover:bg-red-600/20 text-green-400 hover:text-red-400' 
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
            }`}
            aria-label={isSaved ? `Remove ${playlist.name} from library` : `Save ${playlist.name} to library`}
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            {isSaving ? 'Saving...' : (isSaved ? 'Saved' : 'Save')}
          </button>
          
          <button
            onClick={() => onViewTracks(playlist.id)}
            disabled={isLoading}
            className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-md transition-colors disabled:opacity-60"
            aria-label={`View tracks in ${playlist.name}`}
          >
            <Eye className="w-4 h-4" />
            View Tracks
          </button>
        </div>
      </div>
    </div>
  );
}