import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '../utils/api';
import { Music, User, Globe, Lock, Hash } from 'lucide-react';

interface PlaylistOwner {
  display_name: string;
  id: string;
  type: string;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

interface PlaylistImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  owner: PlaylistOwner;
  public: boolean;
  collaborative: boolean;
  images: PlaylistImage[];
  tracks: {
    total: number;
    href: string;
  };
  external_urls: {
    spotify: string;
  };
  uri: string;
  type: string;
  snapshot_id: string;
}

interface SearchResults {
  playlists: {
    items: Playlist[];
    total: number;
    limit: number;
    offset: number;
    next: string | null;
    previous: string | null;
  };
}

export default function PlaylistSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [showJson, setShowJson] = useState(false);

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
      const url = `/api/playlist-search?q=${encodeURIComponent(query)}`;
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
  }, []);

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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // Function to truncate description
  const truncateDescription = (desc: string | null, maxLength: number = 150) => {
    if (!desc) return 'No description available';
    if (desc.length <= maxLength) return desc;
    return desc.substring(0, maxLength) + '...';
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Playlist Search</h1>
          <p className="text-zinc-400">
            Search for Spotify playlists and explore their descriptions
          </p>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              placeholder="Search for playlists... (e.g., 'summer vibes', 'workout', 'jazz 2024')"
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
            Try queries like: "chill", "workout motivation", "jazz NOT sad", "genre:indie", "summer*"
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
            ) : searchResults.playlists.items && Array.isArray(searchResults.playlists.items) && searchResults.playlists.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.playlists.items.map((playlist, index) => {
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

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
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
                          {playlist.uri && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(playlist.uri);
                                // You could add a toast notification here
                              }}
                              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm transition-colors"
                              title="Copy URI"
                            >
                              Copy URI
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                No playlists found in the results. Try a different search query.
              </div>
            )}

            {/* Pagination Info */}
            {searchResults.playlists.total > searchResults.playlists.limit && (
              <div className="text-center text-sm text-zinc-500 pt-4">
                Showing {searchResults.playlists.items.length} of {searchResults.playlists.total.toLocaleString()} results
                {searchResults.playlists.next && (
                  <p className="mt-1">Scroll or modify your search to see more results</p>
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
          <div className="space-y-6">
            {/* Quick Start */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-semibold mb-2">Start Searching</h3>
              <p className="text-zinc-400 mb-4">
                Enter a search query above to explore Spotify playlist data
              </p>
            </div>

            {/* Comprehensive Search Guide */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
              <div className="bg-zinc-700/50 px-6 py-4 border-b border-zinc-700">
                <h3 className="text-lg font-semibold text-white">Comprehensive Search Guide</h3>
                <p className="text-sm text-zinc-400 mt-1">All the ways you can search Spotify playlists</p>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Basic Text Search */}
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span className="text-spotify-green">1.</span> Basic Text Search
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">summer vibes</code>
                      <span className="text-zinc-400">Search playlist names and descriptions</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">"exact phrase"</code>
                      <span className="text-zinc-400">Use quotes for exact phrase matching</span>
                    </div>
                  </div>
                </div>

                {/* Wildcards */}
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span className="text-spotify-green">2.</span> Wildcards & Pattern Matching
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">love*</code>
                      <span className="text-zinc-400">Matches love, loves, lover, lovely, etc.</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">*vibes</code>
                      <span className="text-zinc-400">Matches anything ending with "vibes"</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">chill*2024</code>
                      <span className="text-zinc-400">Combine wildcards with text</span>
                    </div>
                  </div>
                </div>

                {/* Boolean Operators */}
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span className="text-spotify-green">3.</span> Boolean Operators
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">rock OR metal</code>
                      <span className="text-zinc-400">Playlists with either rock OR metal</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">jazz AND smooth</code>
                      <span className="text-zinc-400">Must contain both jazz AND smooth</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">happy NOT sad</code>
                      <span className="text-zinc-400">Include happy but exclude sad</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">NOT explicit</code>
                      <span className="text-zinc-400">Exclude playlists with "explicit"</span>
                    </div>
                  </div>
                </div>

                {/* Field Filters */}
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span className="text-spotify-green">4.</span> Field Filters
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">genre:rock</code>
                      <span className="text-zinc-400">Filter by music genre</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">year:2024</code>
                      <span className="text-zinc-400">Playlists created/updated in 2024</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">year:2020-2024</code>
                      <span className="text-zinc-400">Year range filtering</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">tag:summer</code>
                      <span className="text-zinc-400">Search by playlist tags</span>
                    </div>
                  </div>
                </div>

                {/* Advanced Combinations */}
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span className="text-spotify-green">5.</span> Advanced Combinations
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">genre:indie year:2024</code>
                      <span className="text-zinc-400">Indie playlists from 2024</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">(rock OR metal) NOT classical</code>
                      <span className="text-zinc-400">Rock or metal, but not classical</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">workout* year:2023-2024</code>
                      <span className="text-zinc-400">Recent workout playlists</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">"road trip" genre:rock</code>
                      <span className="text-zinc-400">Exact phrase + genre filter</span>
                    </div>
                  </div>
                </div>

                {/* Special Searches */}
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span className="text-spotify-green">6.</span> Special Search Types
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">owner:spotify</code>
                      <span className="text-zinc-400">Official Spotify playlists</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">owner:"user name"</code>
                      <span className="text-zinc-400">Playlists by specific user</span>
                    </div>
                    <div className="flex gap-3">
                      <code className="bg-zinc-900 px-2 py-1 rounded text-zinc-300 flex-shrink-0">followers:&gt;1000</code>
                      <span className="text-zinc-400">Popular playlists (theoretical)</span>
                    </div>
                  </div>
                </div>

                {/* Pro Tips */}
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span className="text-spotify-green">💡</span> Pro Tips
                  </h4>
                  <ul className="space-y-2 text-sm text-zinc-400">
                    <li>• Search is case-insensitive (rock = Rock = ROCK)</li>
                    <li>• Playlist descriptions often contain rich metadata about mood, activities, and occasions</li>
                    <li>• Combine multiple operators for precise results</li>
                    <li>• Use quotes to search for exact phrases in names or descriptions</li>
                    <li>• Wildcards (*) can be placed anywhere in your search term</li>
                    <li>• The API returns max 50 results per query - refine your search for better results</li>
                  </ul>
                </div>

                {/* Example Searches */}
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span className="text-spotify-green">🎵</span> Example Searches to Try
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                          onClick={() => {
                            setSearchQuery('chill* NOT sleep');
                            performSearch('chill* NOT sleep');
                          }}>
                      chill* NOT sleep
                    </code>
                    <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                          onClick={() => {
                            setSearchQuery('genre:electronic year:2024');
                            performSearch('genre:electronic year:2024');
                          }}>
                      genre:electronic year:2024
                    </code>
                    <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                          onClick={() => {
                            setSearchQuery('"morning motivation"');
                            performSearch('"morning motivation"');
                          }}>
                      "morning motivation"
                    </code>
                    <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                          onClick={() => {
                            setSearchQuery('(jazz OR blues) AND smooth');
                            performSearch('(jazz OR blues) AND smooth');
                          }}>
                      (jazz OR blues) AND smooth
                    </code>
                    <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                          onClick={() => {
                            setSearchQuery('workout* genre:hip-hop');
                            performSearch('workout* genre:hip-hop');
                          }}>
                      workout* genre:hip-hop
                    </code>
                    <code className="bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                          onClick={() => {
                            setSearchQuery('owner:spotify rock');
                            performSearch('owner:spotify rock');
                          }}>
                      owner:spotify rock
                    </code>
                  </div>
                  <p className="text-xs text-zinc-500 mt-3">Click any example to try it!</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}