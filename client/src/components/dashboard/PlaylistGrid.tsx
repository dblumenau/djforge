
interface Playlist {
  id: string;
  name: string;
  description: string | null;
  owner: {
    display_name: string;
  };
  images: Array<{ url: string }>;
  tracks: {
    total: number;
  };
  public: boolean;
  collaborative: boolean;
  uri: string;
}

interface PlaylistGridProps {
  playlists: Playlist[];
  onPlay?: (playlistUri: string, playlistName?: string) => void;
  isLoading?: (uri: string) => boolean;
}

export default function PlaylistGrid({ playlists, onPlay, isLoading }: PlaylistGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {playlists.map((playlist) => (
        <div 
          key={playlist.id} 
          className={`group relative bg-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-all duration-200 hover:shadow-xl cursor-pointer ${isLoading?.(playlist.uri) ? 'pointer-events-none opacity-75' : ''}`}
          onClick={() => !isLoading?.(playlist.uri) && onPlay?.(playlist.uri, playlist.name)}
        >
          {/* Playlist Cover */}
          <div className="relative aspect-square mb-3 overflow-hidden rounded-md bg-zinc-800">
            {playlist.images?.[0] ? (
              <img
                src={playlist.images[0].url}
                alt={playlist.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-12 h-12 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            
            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
                {isLoading?.(playlist.uri) ? (
                  <svg className="animate-spin h-6 w-6 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 4v12l10-6z" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Playlist Info */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm truncate text-white group-hover:text-green-400 transition-colors">
              {playlist.name}
            </h4>
            <p className="text-xs text-zinc-400 truncate">
              By {playlist.owner.display_name}
            </p>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>{playlist.tracks.total} tracks</span>
              {playlist.collaborative && (
                <span className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs">Collab</span>
              )}
            </div>
          </div>

          {/* Description tooltip */}
          {playlist.description && (
            <div className="absolute inset-x-0 -bottom-2 translate-y-full bg-zinc-800 text-xs p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-lg">
              <p className="text-zinc-300 line-clamp-3">{playlist.description}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}