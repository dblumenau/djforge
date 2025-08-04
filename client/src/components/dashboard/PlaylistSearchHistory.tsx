import { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle, History, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { apiEndpoint } from '../../config/api';
import { authenticatedFetch } from '../../utils/api';
import PlaylistSearchHistoryCard from './PlaylistSearchHistoryCard';
import PlaylistResultsGrid from './PlaylistResultsGrid';

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
  alignmentLevel?: 'strong' | 'moderate' | 'weak' | 'tangential';
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

        {/* Use shared PlaylistResultsGrid component */}
        <PlaylistResultsGrid 
          playlists={cachedResult.playlists}
          emptyMessage="No cached playlists to display"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-green-500" />
        <h2 className="text-2xl font-bold text-white">Search History</h2>
      </div>

      {/* Filter Bar */}
      <div className="relative max-w-md">
        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter search history..."
          className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Loading State */}
      {isLoadingHistory && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          <p className="text-zinc-400">Loading search history...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoadingHistory && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-medium">Error</h3>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* History Grid */}
      {!isLoadingHistory && !error && filteredHistory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHistory.map((search, index) => (
            <PlaylistSearchHistoryCard
              key={`${search.searchHash}-${search.timestamp}-${index}`}
              search={search}
              onClick={() => loadCachedResult(search.searchHash)}
              isLoading={isLoadingResult && loadedSearchHash === search.searchHash}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoadingHistory && !error && filteredHistory.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <Search className="w-12 h-12 text-zinc-600 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-zinc-400">
              {searchFilter ? 'No matching searches' : 'No search history'}
            </h3>
            <p className="text-zinc-500 max-w-md mx-auto">
              {searchFilter 
                ? 'Try adjusting your filter to find more results.'
                : 'Your playlist discovery searches will appear here for quick access.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}