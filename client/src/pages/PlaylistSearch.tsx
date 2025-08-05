import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '../utils/api';
import SearchGuide from '../components/playlist-search/SearchGuide';
import PlaylistCard from '../components/playlist-search/PlaylistCard';
import PlaylistDetailsModal from '../components/playlist-search/PlaylistDetailsModal';
import PlaylistSearchControls from '../components/playlist-search/PlaylistSearchControls';
import type {
  SearchResults,
  PlaylistDetails
} from '../@types/playlist-search';

export default function PlaylistSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [showJson, setShowJson] = useState(false);
  
  // Slider controls state
  const [playlistLimit, setPlaylistLimit] = useState(20);
  const [trackSampleSize, setTrackSampleSize] = useState(30);
  const [renderLimit, setRenderLimit] = useState(3);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [modalTab, setModalTab] = useState<'overview' | 'tracks' | 'analytics' | 'json'>('overview');
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Starting playlist search for:', query);
      const url = `/api/playlist-search?q=${encodeURIComponent(query)}&playlistLimit=${playlistLimit}&renderLimit=${renderLimit}`;
      console.log('Request URL:', url);
      
      let response;
      try {
        response = await authenticatedFetch(url);
      } catch (fetchError: any) {
        console.error('Error during authenticatedFetch:', fetchError);
        console.error('Error stack:', fetchError.stack);
        throw new Error(`Network request failed: ${fetchError.message}`);
      }
      console.log('Response received:', response);

      if (!response.ok) {
        let errorMessage = 'Failed to search playlists';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Playlist search response:', data);
      
      // Validate the response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from server');
      }
      
      // Check if we have the expected structure
      if (data.success === false && data.error) {
        throw new Error(data.error);
      }
      
      setSearchResults(data);
    } catch (err: any) {
      console.error('Playlist search error:', err);
      setError(err.message || 'An error occurred while searching');
      setSearchResults(null);
    } finally {
      setLoading(false);
    }
  }, [playlistLimit, renderLimit]);

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer for debounced search
    const newTimer = setTimeout(() => {
      performSearch(value);
    }, 500);

    setDebounceTimer(newTimer);
  };

  // Re-search when control values change (if we have a query)
  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  }, [playlistLimit, renderLimit, performSearch]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // Fetch playlist details
  const fetchPlaylistDetails = async (playlistId: string) => {
    setLoadingDetails(true);
    setModalTab('overview');
    setShowModal(true);
    
    try {
      const response = await authenticatedFetch(`/api/playlist-search/${playlistId}?trackSampleSize=${trackSampleSize}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch playlist details');
      }
      
      const data = await response.json();
      setSelectedPlaylist(data);
    } catch (err: any) {
      console.error('Error fetching playlist details:', err);
      setError(err.message || 'Failed to load playlist details');
      setShowModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemId);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Format duration from ms to mm:ss
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate analytics
  const calculateAnalytics = () => {
    if (!selectedPlaylist?.tracks?.items) return null;
    
    const validTracks = selectedPlaylist.tracks.items.filter(item => item.track);
    
    // Top artists
    const artistCounts = new Map<string, { name: string, count: number }>();
    validTracks.forEach(item => {
      item.track?.artists.forEach(artist => {
        const existing = artistCounts.get(artist.id) || { name: artist.name, count: 0 };
        artistCounts.set(artist.id, { name: artist.name, count: existing.count + 1 });
      });
    });
    
    // Top albums
    const albumCounts = new Map<string, { name: string, artist: string, count: number }>();
    validTracks.forEach(item => {
      if (item.track?.album) {
        const album = item.track.album;
        const existing = albumCounts.get(album.id) || { 
          name: album.name, 
          artist: album.artists[0]?.name || 'Unknown',
          count: 0 
        };
        albumCounts.set(album.id, { ...existing, count: existing.count + 1 });
      }
    });
    
    // Release year distribution
    const yearCounts = new Map<string, number>();
    validTracks.forEach(item => {
      if (item.track?.album?.release_date) {
        const year = item.track.album.release_date.substring(0, 4);
        yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
      }
    });
    
    // Stats
    const explicitCount = validTracks.filter(item => item.track?.explicit).length;
    const avgPopularity = validTracks.reduce((sum, item) => sum + (item.track?.popularity || 0), 0) / validTracks.length;
    const totalDuration = validTracks.reduce((sum, item) => sum + (item.track?.duration_ms || 0), 0);
    
    return {
      topArtists: Array.from(artistCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10),
      topAlbums: Array.from(albumCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10),
      yearDistribution: Array.from(yearCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      stats: {
        totalTracks: validTracks.length,
        explicitCount,
        explicitPercentage: (explicitCount / validTracks.length * 100).toFixed(1),
        avgPopularity: avgPopularity.toFixed(1),
        totalDuration: formatDuration(totalDuration),
        totalDurationHours: (totalDuration / 3600000).toFixed(1)
      }
    };
  };

  // Function to truncate description
  const truncateDescription = (desc: string | null, maxLength: number = 150) => {
    if (!desc) return 'No description available';
    if (desc.length <= maxLength) return desc;
    return desc.substring(0, maxLength) + '...';
  };

  return (
    <>
      <div className="min-h-screen bg-zinc-900 text-zinc-100 p-6">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Playlist Search</h1>
          <p className="text-zinc-400">
            Search for Spotify playlists and explore their descriptions
          </p>
        </div>

        {/* Search Controls */}
        <PlaylistSearchControls
          playlistLimit={playlistLimit}
          trackSampleSize={trackSampleSize}
          renderLimit={renderLimit}
          onPlaylistLimitChange={setPlaylistLimit}
          onTrackSampleSizeChange={setTrackSampleSize}
          onRenderLimitChange={setRenderLimit}
        />

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              placeholder="Search for playlists... (e.g., 'summer vibes', 'workout', 'indie 2024')"
              className="w-full px-4 py-3 pr-12 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-5 w-5 text-spotify-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Try queries like: "chill", "workout motivation", "jazz NOT sad", "indie 2024", "summer*"
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {searchResults && searchResults.playlists && (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Search Results</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Found {(searchResults.playlists.total || 0).toLocaleString()} playlists
                  {searchResults.playlists.total > searchResults.playlists.limit && 
                    ` (showing ${searchResults.playlists.items?.length || 0})`
                  }
                </p>
              </div>
              <button
                onClick={() => setShowJson(!showJson)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm transition-colors"
              >
                {showJson ? 'Show Cards' : 'Show JSON'}
              </button>
            </div>

            {/* Toggle between Card View and JSON View */}
            {showJson ? (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
                <div className="bg-zinc-700/50 px-4 py-2 border-b border-zinc-700">
                  <span className="text-sm font-mono text-zinc-400">Raw JSON Response</span>
                </div>
                <div className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto">
                  <pre className="text-sm font-mono text-zinc-300 whitespace-pre">
                    {JSON.stringify(searchResults, null, 2)}
                  </pre>
                </div>
              </div>
            ) : searchResults.playlists.items && Array.isArray(searchResults.playlists.items) && searchResults.playlists.items.filter(item => item != null).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.playlists.items
                  .filter(playlist => playlist != null)  // Filter out null/undefined items first
                  .slice(0, renderLimit)  // Apply render limit
                  .map((playlist, index) => (
                    <PlaylistCard 
                      key={playlist.id || `playlist-${index}`}
                      playlist={playlist}
                      index={index}
                      onViewDetails={fetchPlaylistDetails}
                      truncateDescription={truncateDescription}
                    />
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                No playlists found in the results. Try a different search query.
              </div>
            )}

            {/* Pagination Info */}
            {searchResults.playlists.total > 0 && (
              <div className="text-center text-sm text-zinc-500 pt-4">
                Showing {Math.min(searchResults.playlists.items?.filter(item => item != null).length || 0, renderLimit)} of {searchResults.playlists.total.toLocaleString()} results
                {renderLimit < (searchResults.playlists.items?.filter(item => item != null).length || 0) && (
                  <p className="mt-1">Increase render limit to see more results</p>
                )}
                {searchResults.playlists.total > searchResults.playlists.limit && (
                  <p className="mt-1">Increase fetch limit to load more playlists</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!searchResults && !loading && !error && searchQuery && (
          <div className="text-center py-12">
            <p className="text-zinc-500">No results yet. Try searching for something!</p>
          </div>
        )}

        {/* Initial State */}
        {!searchQuery && (
          <SearchGuide 
            setSearchQuery={setSearchQuery}
            performSearch={performSearch}
          />
        )}
        </div>
      </div>

      {/* Playlist Details Modal */}
      <PlaylistDetailsModal 
        showModal={showModal}
        onClose={() => setShowModal(false)}
        selectedPlaylist={selectedPlaylist}
        loadingDetails={loadingDetails}
        modalTab={modalTab}
        onTabChange={setModalTab}
        copiedItem={copiedItem}
        onCopyToClipboard={copyToClipboard}
        calculateAnalytics={calculateAnalytics}
        formatDuration={formatDuration}
        formatDate={formatDate}
      />
    </>
  );
}