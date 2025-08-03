import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, History, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { apiEndpoint } from '../../config/api';
import { authenticatedFetch } from '../../utils/api';
import PlaylistSearchHistoryCard from './PlaylistSearchHistoryCard';
import PlaylistDiscoveryCard from './PlaylistDiscoveryCard';
import { useSpotifyPlayback } from '../../hooks/useSpotifyPlayback';

interface SearchHistoryMetadata {
  searchHash: string;
  query: string;
  model: string;
  timestamp: number;
  resultCount: number;
  cached: boolean;
}

interface DiscoveredPlaylist {
  id: string;
  name: string;
  owner: string;
  description?: string;
  followers: number;
  trackCount: number;
  images: Array<{ url: string; height: number; width: number }>;
  uniqueArtists: number;
  summary?: string;
  characteristics?: {
    primaryGenre?: string;
    mood?: string;
    instrumentation?: string[];
    tempo?: string;
    decadeRange?: string;
  };
  matchScore?: number;
  reasoning?: string;
}

interface CachedSearchResult {
  query: string;
  playlists: DiscoveredPlaylist[];
  totalSearchResults: number;
  selectedCount: number;
  finalCount: number;
}

export default function PlaylistSearchHistory() {
  const { playPlaylist, isLoading: isPlaybackLoading } = useSpotifyPlayback();
  const [searchHistory, setSearchHistory] = useState<SearchHistoryMetadata[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<SearchHistoryMetadata[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [cachedResult, setCachedResult] = useState<CachedSearchResult | null>(null);
  const [loadedSearchHash, setLoadedSearchHash] = useState<string | null>(null);

  // Load search history on component mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Filter history based on search filter
  useEffect(() => {
    if (!searchFilter.trim()) {
      setFilteredHistory(searchHistory);
    } else {
      const filtered = searchHistory.filter(search =>
        search.query.toLowerCase().includes(searchFilter.toLowerCase()) ||
        search.model.toLowerCase().includes(searchFilter.toLowerCase())
      );
      setFilteredHistory(filtered);
    }
  }, [searchHistory, searchFilter]);

  const loadSearchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      setError(null);

      const response = await authenticatedFetch(apiEndpoint('/api/playlist-discovery/history'));
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSearchHistory(data.history || []);
    } catch (err: any) {
      console.error('❌ Error loading search history:', err);
      setError(err.message || 'Failed to load search history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadCachedResult = async (searchHash: string) => {
    try {
      setIsLoadingResult(true);
      setError(null);

      const response = await authenticatedFetch(apiEndpoint(`/api/playlist-discovery/cached-result/${searchHash}`));
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          toast.error('Search result has expired');
          // Refresh history to update cached status
          loadSearchHistory();
          return;
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setCachedResult(data);
      setLoadedSearchHash(searchHash);
      
      toast.success('Loaded cached search results');
    } catch (err: any) {
      console.error('❌ Error loading cached result:', err);
      setError(err.message || 'Failed to load cached result');
    } finally {
      setIsLoadingResult(false);
    }
  };

  const handlePlayPlaylist = useCallback(async (playlistId: string) => {
    try {
      await playPlaylist(playlistId);
    } catch (error) {
      console.error('Failed to play playlist:', error);
      toast.error('Failed to play playlist');
    }
  }, [playPlaylist]);

  const handleQueuePlaylist = useCallback(async () => {
    // For queueing, we'll need to get the first track of the playlist
    // This is a simplified implementation - in a full version you'd queue multiple tracks
    toast.info('Playlist queuing not yet implemented for cached results');
  }, []);

  const handleSavePlaylist = useCallback(async () => {
    toast.info('Playlist saving not yet implemented for cached results');
  }, []);

  const handleViewTracks = useCallback(() => {
    toast.info('Track viewing not yet implemented for cached results');
  }, []);

  const clearResults = () => {
    setCachedResult(null);
    setLoadedSearchHash(null);
  };

  // If showing cached results, render those
  if (cachedResult && loadedSearchHash) {
    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Cached Results</h2>
            <p className="text-zinc-400">
              Results for: "{cachedResult.query}" ({cachedResult.playlists.length} playlists)
            </p>
          </div>
          <button
            onClick={clearResults}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            Back to History
          </button>
        </div>

        {/* Cached Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cachedResult.playlists.map((playlist) => (
            <PlaylistDiscoveryCard
              key={playlist.id}
              playlist={playlist}
              onPlay={handlePlayPlaylist}
              onQueue={handleQueuePlaylist}
              onSave={handleSavePlaylist}
              onViewTracks={handleViewTracks}
              isLoading={isPlaybackLoading(`spotify:playlist:${playlist.id}`)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-green-500" />
        <div>
          <h2 className="text-2xl font-bold text-white">Search History</h2>
          <p className="text-zinc-400">
            View and reload your past playlist discovery searches
          </p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Filter searches..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-green-600/50 focus:ring-1 focus:ring-green-600/30"
        />
        {searchFilter && (
          <button
            onClick={() => setSearchFilter('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoadingHistory && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-500" />
          <p className="text-zinc-400">Loading search history...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoadingHistory && (
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-900/20 border border-red-800/30">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Error loading search history</p>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={loadSearchHistory}
              className="ml-auto px-3 py-1 rounded-lg bg-red-800/30 hover:bg-red-800/50 text-red-300 text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingHistory && !error && filteredHistory.length === 0 && searchHistory.length === 0 && (
        <div className="text-center py-12">
          <History className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-xl font-medium text-white mb-2">No search history</h3>
          <p className="text-zinc-400 mb-4">
            Your playlist discovery searches will appear here
          </p>
        </div>
      )}

      {/* No Results for Filter */}
      {!isLoadingHistory && !error && filteredHistory.length === 0 && searchHistory.length > 0 && searchFilter && (
        <div className="text-center py-12">
          <Filter className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-xl font-medium text-white mb-2">No matching searches</h3>
          <p className="text-zinc-400 mb-4">
            No searches match "{searchFilter}"
          </p>
          <button
            onClick={() => setSearchFilter('')}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Search History Grid */}
      {!isLoadingHistory && !error && filteredHistory.length > 0 && (
        <div className="space-y-4">
          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              {filteredHistory.length} search{filteredHistory.length !== 1 ? 'es' : ''}
              {searchFilter && ` matching "${searchFilter}"`}
            </p>
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="text-sm text-green-400 hover:text-green-300"
              >
                Clear filter
              </button>
            )}
          </div>

          {/* History Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHistory.map((search) => (
              <PlaylistSearchHistoryCard
                key={search.searchHash}
                search={search}
                onClick={loadCachedResult}
                isLoading={isLoadingResult && loadedSearchHash === search.searchHash}
              />
            ))}
          </div>
        </div>
      )}

      {/* Loading Result State */}
      {isLoadingResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-green-500" />
              <p className="text-white">Loading cached results...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}