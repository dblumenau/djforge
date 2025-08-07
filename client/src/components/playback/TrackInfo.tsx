import React from 'react';
import { Calendar, Star, Hash, ExternalLink } from 'lucide-react';
import { PlaybackState } from '../../types/playback.types';

interface TrackInfoProps {
  track: PlaybackState['track'];
  context?: PlaybackState['context'];
  className?: string;
}

const TrackInfo: React.FC<TrackInfoProps> = ({ track, context, className = '' }) => {
  if (!track) {
    return null;
  }

  return (
    <div className={`flex-1 min-w-0 space-y-3 ${className}`}>
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight line-clamp-2">
          {track.name}
        </h2>
        <p className="text-lg md:text-xl text-gray-300 mt-1">
          {/* Show artist links if we have the full artist data, otherwise fallback to simple string */}
          {track.artists && Array.isArray(track.artists) ? (
            track.artists.map((artist: any, index: number) => (
              <span key={artist.id || index}>
                {artist.external_urls?.spotify ? (
                  <a 
                    href={artist.external_urls.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                    title={`Open ${artist.name} in Spotify`}
                  >
                    {artist.name}
                  </a>
                ) : (
                  artist.name
                )}
                {index < (track.artists?.length || 0) - 1 && ', '}
              </span>
            ))
          ) : (
            track.artist
          )}
        </p>
        <p className="text-base md:text-lg text-gray-400 mt-2">
          {track.albumUri ? (
            <a 
              href={`https://open.spotify.com/album/${track.albumId || track.albumUri.split(':').pop()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition-colors"
              title="Open album in Spotify"
            >
              {track.album}
            </a>
          ) : (
            track.album
          )}
        </p>
        
        {/* Playback Context (Playlist/Album source) */}
        {context && context.external_urls?.spotify && (
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <span>Playing from</span>
            <a 
              href={context.external_urls.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500 hover:text-green-400 transition-colors font-medium"
              title={`Open ${context.type} in Spotify`}
            >
              {context.name || (context.type === 'playlist' ? 'Playlist' : 
               context.type === 'album' ? 'Album' : 
               context.type === 'artist' ? 'Artist Radio' : 
               context.type === 'show' ? 'Podcast' : 
               context.type.charAt(0).toUpperCase() + context.type.slice(1))}
            </a>
            <span className="px-2 py-0.5 text-xs bg-gray-700/50 text-gray-400 rounded-full">
              {context.type === 'playlist' ? 'Playlist' : 
               context.type === 'album' ? 'Album' : 
               context.type === 'artist' ? 'Artist Radio' : 
               context.type === 'show' ? 'Podcast' : 
               context.type.charAt(0).toUpperCase() + context.type.slice(1)}
            </span>
          </p>
        )}
      </div>
      
      {/* Additional metadata - cleaner layout */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
        {track.releaseDate && (
          <span className="flex items-center gap-1.5" title="Release Date">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>{new Date(track.releaseDate).getFullYear()}</span>
          </span>
        )}
        {track.popularity !== undefined && (
          <span className="flex items-center gap-1.5" title="Popularity">
            <Star className="w-4 h-4 flex-shrink-0" />
            <span>{track.popularity}/100</span>
          </span>
        )}
        {track.track_number && (
          <span className="flex items-center gap-1.5" title="Track Number">
            <Hash className="w-4 h-4 flex-shrink-0" />
            <span>Track {track.track_number}</span>
          </span>
        )}
        {track.external_urls?.spotify && (
          <a 
            href={track.external_urls.spotify}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-green-500 hover:text-green-400 transition-colors"
            title="Open in Spotify"
          >
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
            <span>Open in Spotify</span>
          </a>
        )}
      </div>
    </div>
  );
};

export default TrackInfo;