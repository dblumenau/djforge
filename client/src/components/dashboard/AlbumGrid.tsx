
interface Album {
  album: {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    images: Array<{ url: string }>;
    release_date: string;
    total_tracks: number;
    external_urls: { spotify: string };
  };
  added_at: string;
}

interface AlbumGridProps {
  albums: Album[];
  onPlay?: (albumUri: string) => void;
  isLoading?: (uri: string) => boolean;
}

export default function AlbumGrid({ albums, onPlay, isLoading }: AlbumGridProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {albums.map((item) => (
        <div 
          key={item.album.id} 
          className="group relative bg-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-all duration-200 hover:shadow-xl"
        >
          {/* Album Cover */}
          <div className="relative aspect-square mb-3 overflow-hidden rounded-md">
            {item.album.images?.[0] && (
              <img
                src={item.album.images[0].url}
                alt={item.album.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            )}
            
            {/* Play button overlay */}
            {onPlay && (
              <button
                onClick={() => onPlay(`spotify:album:${item.album.id}`)}
                disabled={isLoading?.(`spotify:album:${item.album.id}`)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-60"
              >
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
                  {isLoading?.(`spotify:album:${item.album.id}`) ? (
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
              </button>
            )}
          </div>

          {/* Album Info */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm truncate text-white group-hover:text-green-400 transition-colors">
              {item.album.name}
            </h4>
            <p className="text-xs text-zinc-400 truncate">
              {item.album.artists.map(a => a.name).join(', ')}
            </p>
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{item.album.total_tracks} tracks</span>
              <span>{new Date(item.album.release_date).getFullYear()}</span>
            </div>
          </div>

          {/* Added date tooltip */}
          <div className="absolute -top-2 -right-2 bg-zinc-700 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            Added {formatDate(item.added_at)}
          </div>
        </div>
      ))}
    </div>
  );
}