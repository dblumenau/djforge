import { Music, User, Globe, Lock, Hash, BarChart } from 'lucide-react';
import type { Playlist } from '../../@types/playlist-search';

interface PlaylistCardProps {
  playlist: Playlist;
  index: number;
  onViewDetails: (playlistId: string) => void;
  truncateDescription: (desc: string | null, maxLength?: number) => string;
}

export default function PlaylistCard({ playlist, index, onViewDetails, truncateDescription }: PlaylistCardProps) {
  // Add safety check for each playlist item
  if (!playlist || typeof playlist !== 'object') {
    console.warn(`Invalid playlist at index ${index}:`, playlist);
    return null;
  }
  
  return (
    <div 
      key={playlist.id || `playlist-${index}`} 
      className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden hover:border-zinc-600 transition-colors"
    >
      {/* Playlist Image */}
      <div className="aspect-square relative bg-zinc-900">
        {playlist.images && Array.isArray(playlist.images) && playlist.images.length > 0 && playlist.images[0]?.url ? (
          <img 
            src={playlist.images[0].url} 
            alt={playlist.name || 'Playlist'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-16 h-16 text-zinc-700" />
          </div>
        )}
        
        {/* Privacy Badge */}
        <div className="absolute top-2 right-2">
          {playlist.public === true ? (
            <div className="bg-green-900/90 text-green-300 px-2 py-1 rounded text-xs flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Public
            </div>
          ) : (
            <div className="bg-zinc-900/90 text-zinc-300 px-2 py-1 rounded text-xs flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Private
            </div>
          )}
        </div>
      </div>

      {/* Playlist Info */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div>
          <h3 className="font-semibold text-white line-clamp-1">
            {playlist.name || 'Untitled Playlist'}
          </h3>
          <p className="text-sm text-zinc-400 flex items-center gap-1 mt-1">
            <User className="w-3 h-3" />
            {playlist.owner?.display_name || playlist.owner?.id || 'Spotify'}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-zinc-300 line-clamp-3 min-h-[3rem]">
          {truncateDescription(playlist.description, 100)}
        </p>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400 flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {playlist.tracks?.total || 0} tracks
          </span>
          {playlist.collaborative === true && (
            <span className="text-green-400 text-xs">
              Collaborative
            </span>
          )}
        </div>

        {/* API Endpoint */}
        <div className="pt-2 border-t border-zinc-700">
          <p className="text-xs text-zinc-500 mb-1">API Endpoint:</p>
          <code className="block text-xs bg-zinc-900 p-2 rounded text-zinc-400 break-all">
            {playlist.tracks?.href}
          </code>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => onViewDetails(playlist.id)}
            className="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded text-sm text-center transition-colors flex items-center justify-center gap-1"
          >
            <BarChart className="w-4 h-4" />
            View Details
          </button>
          {playlist.external_urls?.spotify && (
            <a
              href={playlist.external_urls.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-3 py-2 bg-spotify-green hover:bg-green-600 text-black font-medium rounded text-sm text-center transition-colors"
            >
              Open in Spotify
            </a>
          )}
        </div>
      </div>
    </div>
  );
}