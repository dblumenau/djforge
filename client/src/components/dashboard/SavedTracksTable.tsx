import { useState, useMemo } from 'react';

interface SavedTrack {
  added_at: string;
  track: {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: {
      name: string;
      images: Array<{ url: string }>;
    };
    duration_ms: number;
    popularity: number;
    uri: string;
  };
}

interface SavedTracksTableProps {
  tracks: SavedTrack[];
  total: number;
  onPlay?: (trackUri: string) => void;
  onQueue?: (trackUri: string) => void;
  onLoadMore?: () => void;
  loading?: boolean;
  isLoading?: (uri: string) => boolean;
}

export default function SavedTracksTable({ tracks, total, onPlay, onQueue, onLoadMore, loading, isLoading }: SavedTracksTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'added_at' | 'name' | 'artist' | 'popularity'>('added_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedTracks = useMemo(() => {
    let filtered = tracks;
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = tracks.filter(item => 
        item.track.name.toLowerCase().includes(term) ||
        item.track.artists.some(a => a.name.toLowerCase().includes(term)) ||
        item.track.album.name.toLowerCase().includes(term)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'added_at':
          aVal = new Date(a.added_at).getTime();
          bVal = new Date(b.added_at).getTime();
          break;
        case 'name':
          aVal = a.track.name.toLowerCase();
          bVal = b.track.name.toLowerCase();
          break;
        case 'artist':
          aVal = a.track.artists[0]?.name.toLowerCase() || '';
          bVal = b.track.artists[0]?.name.toLowerCase() || '';
          break;
        case 'popularity':
          aVal = a.track.popularity;
          bVal = b.track.popularity;
          break;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tracks, searchTerm, sortBy, sortOrder]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search your liked songs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 transition-colors"
          />
          <svg className="absolute left-3 top-2.5 w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <span className="text-sm text-zinc-400">
          {filteredAndSortedTracks.length} of {total} songs
        </span>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left p-4 text-xs font-medium text-zinc-400 uppercase tracking-wider w-12">#</th>
              <th className="text-left p-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">Title</th>
              <th 
                className="text-left p-4 text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('artist')}
              >
                Artist {sortBy === 'artist' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left p-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">Album</th>
              <th 
                className="text-left p-4 text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('added_at')}
              >
                Added {sortBy === 'added_at' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-center p-4 text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors w-20"
                onClick={() => handleSort('popularity')}
              >
                Pop {sortBy === 'popularity' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-right p-4 text-xs font-medium text-zinc-400 uppercase tracking-wider w-20">Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTracks.map((item, index) => (
              <tr 
                key={`${item.track.id}-${index}`}
                className="group border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
              >
                <td className="p-4 text-sm text-zinc-400">{index + 1}</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {item.track.album.images?.[0] && (
                      <img
                        src={item.track.album.images[0].url}
                        alt={item.track.album.name}
                        className="w-10 h-10 rounded"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-green-400 transition-colors">
                        {item.track.name}
                      </p>
                    </div>
                    {(onPlay || onQueue) && (
                      <div className="ml-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onPlay && (
                          <button
                            onClick={() => onPlay(item.track.uri)}
                            disabled={isLoading?.(item.track.uri)}
                            className="disabled:opacity-50"
                            title="Play"
                          >
                            {isLoading?.(item.track.uri) ? (
                              <svg className="animate-spin h-7 w-7 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-7 h-7 text-green-500 hover:text-green-400 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                              </svg>
                            )}
                          </button>
                        )}
                        {onQueue && (
                          <button
                            onClick={() => onQueue(item.track.uri)}
                            disabled={isLoading?.(item.track.uri)}
                            className="disabled:opacity-50"
                            title="Add to Queue"
                          >
                            {isLoading?.(item.track.uri) ? (
                              <svg className="animate-spin h-5 w-5 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-zinc-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-4 text-sm text-zinc-400 truncate max-w-xs">
                  {item.track.artists.map(a => a.name).join(', ')}
                </td>
                <td className="p-4 text-sm text-zinc-400 truncate max-w-xs">
                  {item.track.album.name}
                </td>
                <td className="p-4 text-sm text-zinc-500">
                  {formatDate(item.added_at)}
                </td>
                <td className="p-4 text-center">
                  <div className="w-full bg-zinc-700 rounded-full h-1.5">
                    <div 
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${item.track.popularity}%` }}
                    />
                  </div>
                </td>
                <td className="p-4 text-sm text-zinc-500 text-right">
                  {formatDuration(item.track.duration_ms)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load more button */}
      {tracks.length < total && (
        <div className="text-center py-4">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : `Load More (${total - tracks.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}