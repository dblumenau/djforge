import { useState, useCallback } from 'react';
import { Search, Music, Sparkles, Loader2, AlertCircle, Brain, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { apiEndpoint } from '../../config/api';
import { authenticatedFetch } from '../../utils/api';
import { useSpotifyPlayback } from '../../hooks/useSpotifyPlayback';
import PlaylistDiscoveryCard from './PlaylistDiscoveryCard';
import PlaylistDetailsModal from './PlaylistDetailsModal';
import ModelSelector from '../ModelSelector';
import PlaylistSearchControls from '../playlist-search/PlaylistSearchControls';
import usePlaylistDiscoveryProgress from '../../hooks/usePlaylistDiscoveryProgress';

interface DiscoveredPlaylist {
  id: string;
  name: string;
  owner: string;
  description?: string;
  followers: number;
  trackCount: number;
  images: Array<{ url: string; height: number; width: number }>;
  uniqueArtists: string[];
  summary?: string;
  characteristics?: {
    primaryGenre?: string;
    mood?: string;
    instrumentation?: string[];
    tempo?: string;
  };
  matchScore?: number;
  reasoning?: string;
}

interface PlaylistDiscoveryResponse {
  query: string;
  playlists: DiscoveredPlaylist[];
  totalSearchResults?: number;
  selectedCount?: number;
  finalCount?: number;
  fallbackUsed?: boolean;
  originalError?: string;
  phases?: {
    search: string;
    selection: string;
    details: string;
    summarization: string;
  };
}


export default function PlaylistDiscovery() {
  const { playPlaylist, queuePlaylist, playTrack, queueTrack, isLoading: isPlaybackLoading } = useSpotifyPlayback();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DiscoveredPlaylist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<DiscoveredPlaylist | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('llmModel') || 'google/gemini-2.5-flash';
  });
  const [savedPlaylists, setSavedPlaylists] = useState<Set<string>>(new Set());
  const [savingPlaylists, setSavingPlaylists] = useState<Set<string>>(new Set());

  // Slider controls state
  const [playlistLimit, setPlaylistLimit] = useState(20);
  const [trackSampleSize, setTrackSampleSize] = useState(30);
  const [renderLimit, setRenderLimit] = useState(3);

  const sessionId = localStorage.getItem('spotify_session_id') || '';
  const currentProgress = usePlaylistDiscoveryProgress(sessionId);

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('llmModel', model);
  };

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);
    setLastQuery(searchQuery.trim());


    try {
      console.log(`🔍 Playlist Discovery: "${searchQuery}" with model: ${selectedModel}`);

      const response = await authenticatedFetch(apiEndpoint('/api/playlist-discovery/full-search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery.trim(),
          model: selectedModel,
          playlistLimit,
          trackSampleSize,
          renderLimit
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PlaylistDiscoveryResponse = await response.json();
      

      // Check if fallback was used and show notification
      if (data.fallbackUsed) {
        toast.warning('Using fallback model due to primary model error', {
          description: data.originalError ? `Error: ${data.originalError}` : 'Primary model failed to process request'
        });
      }

      if (data.playlists && data.playlists.length > 0) {
        console.log(`✅ Found ${data.playlists.length} curated playlists`);
        setResults(data.playlists);
      } else {
        setResults([]);
        setError('No playlists found for this query. Try a different search term.');
      }

    } catch (err: any) {
      console.error('❌ Playlist discovery error:', err);
      
      if (err.message?.includes('401')) {
        setError('Authentication failed. Please log in again.');
      } else if (err.message?.includes('429')) {
        setError('Rate limit exceeded. Please wait a moment and try again.');
      } else {
        setError(err.message || 'Failed to discover playlists. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedModel, playlistLimit, trackSampleSize, renderLimit]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  }, [query, handleSearch]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(query);
    }
  }, [query, handleSearch]);

  const handlePlay = useCallback(async (playlistId: string) => {
    try {
      console.log(`🎵 Playing playlist: ${playlistId}`);
      
      // Find the playlist details for the name
      const playlist = results.find(p => p.id === playlistId);
      const spotifyUri = `spotify:playlist:${playlistId}`;
      
      await playPlaylist(spotifyUri, playlist?.name);
      toast.success(`Now playing: ${playlist?.name || 'playlist'}`, {
        description: `${playlist?.trackCount || 0} tracks`
      });
    } catch (error) {
      console.error('❌ Failed to play playlist:', error);
      toast.error('Failed to play playlist', {
        description: 'Please try again or check your Spotify connection'
      });
    }
  }, [results, playPlaylist]);

  const handleQueue = useCallback(async (playlistId: string) => {
    try {
      console.log(`➕ Adding playlist to queue: ${playlistId}`);
      
      const playlist = results.find(p => p.id === playlistId);
      const spotifyUri = `spotify:playlist:${playlistId}`;
      
      const result = await queuePlaylist(spotifyUri, playlist?.name);
      
      if (result.success) {
        toast.success('Added to queue', {
          description: result.response || `Queued tracks from "${playlist?.name}"`
        });
      } else {
        throw new Error(result.error || 'Failed to queue playlist');
      }
    } catch (error: any) {
      console.error('❌ Failed to queue playlist:', error);
      toast.error('Failed to queue playlist', {
        description: error.message || 'Please try again'
      });
    }
  }, [results, queuePlaylist]);

  const handleSave = useCallback(async (playlistId: string) => {
    // Prevent duplicate requests
    if (savingPlaylists.has(playlistId)) return;
    
    try {
      setSavingPlaylists(prev => new Set(prev).add(playlistId));
      
      const playlist = results.find(p => p.id === playlistId);
      const isCurrentlySaved = savedPlaylists.has(playlistId);
      
      console.log(`${isCurrentlySaved ? '❌ Unfollowing' : '💾 Saving'} playlist: ${playlistId}`);
      
      // Use direct Spotify API call to follow/unfollow the playlist
      const response = await authenticatedFetch(`https://api.spotify.com/v1/playlists/${playlistId}/followers`, {
        method: isCurrentlySaved ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public: false })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isCurrentlySaved ? 'unfollow' : 'follow'} playlist`);
      }

      // Update saved state
      setSavedPlaylists(prev => {
        const next = new Set(prev);
        if (isCurrentlySaved) {
          next.delete(playlistId);
        } else {
          next.add(playlistId);
        }
        return next;
      });
      
      // Show success feedback
      if (isCurrentlySaved) {
        toast.success('Playlist removed from library', {
          description: `"${playlist?.name}" has been removed from your Spotify library`,
          duration: 3000
        });
      } else {
        toast.success('Playlist saved to library', {
          description: `"${playlist?.name}" has been added to your Spotify library`,
          duration: 3000
        });
      }
      
    } catch (error) {
      console.error(`❌ Failed to ${savedPlaylists.has(playlistId) ? 'unfollow' : 'follow'} playlist:`, error);
      toast.error(`Failed to ${savedPlaylists.has(playlistId) ? 'remove' : 'save'} playlist`, {
        description: 'Please try again or check your connection'
      });
    } finally {
      setSavingPlaylists(prev => {
        const next = new Set(prev);
        next.delete(playlistId);
        return next;
      });
    }
  }, [results, savedPlaylists, savingPlaylists]);

  const handleViewTracks = useCallback((playlistId: string) => {
    console.log(`👁️ View tracks for playlist: ${playlistId}`);
    
    const playlist = results.find(p => p.id === playlistId);
    if (playlist) {
      setSelectedPlaylist(playlist);
      setIsModalOpen(true);
    }
  }, [results]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedPlaylist(null);
  }, []);

  const handlePlayTrack = useCallback(async (trackId: string) => {
    try {
      console.log(`🎵 Playing track: ${trackId}`);
      const spotifyUri = `spotify:track:${trackId}`;
      await playTrack(spotifyUri);
    } catch (error) {
      console.error('❌ Failed to play track:', error);
    }
  }, [playTrack]);

  const handleQueueTrack = useCallback(async (trackId: string) => {
    try {
      console.log(`➕ Adding track to queue: ${trackId}`);
      const spotifyUri = `spotify:track:${trackId}`;
      await queueTrack(spotifyUri);
    } catch (error) {
      console.error('❌ Failed to queue track:', error);
    }
  }, [queueTrack]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-green-500" />
          <h2 className="text-2xl font-bold text-white">Discover Playlists</h2>
        </div>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Use natural language to find the perfect playlists. Try queries like "taylor swift but on harp" or "chill indie rock for studying"
        </p>
      </div>

      {/* Search Interface */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-4">
          {/* Model Selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              AI Model
            </label>
            <ModelSelector
              onModelChange={handleModelChange}
              fullWidth={true}
              compact={false}
            />
          </div>
          
          {/* Divider */}
          <div className="border-b border-zinc-700/50"></div>
          
          {/* Search Input */}
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe the playlists you're looking for..."
                disabled={isLoading}
                className="w-full pl-12 pr-24 py-4 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed text-lg transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </form>
          
          {/* Slider Controls - now inside the card */}
          <PlaylistSearchControls
            playlistLimit={playlistLimit}
            trackSampleSize={trackSampleSize}
            renderLimit={renderLimit}
            onPlaylistLimitChange={setPlaylistLimit}
            onTrackSampleSizeChange={setTrackSampleSize}
            onRenderLimitChange={setRenderLimit}
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="flex flex-col items-center space-y-4">
            {/* Progress bar */}
            <div className="w-full max-w-md">
              <div className="bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-green-500 h-full transition-all duration-300"
                  style={{ width: `${currentProgress.progress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1 text-center">
                {currentProgress.progress}% complete
              </p>
            </div>
            
            {/* Current step */}
            <div className="space-y-2">
              <p className="text-lg text-white font-medium">
                {currentProgress.step || 'Starting search...'}
              </p>
              
              {/* Phase indicator with icons */}
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                {currentProgress.phase === 'searching' && <Search className="w-4 h-4 animate-pulse" />}
                {currentProgress.phase === 'analyzing' && <Brain className="w-4 h-4 animate-pulse" />}
                {currentProgress.phase === 'fetching' && <Download className="w-4 h-4 animate-pulse" />}
                {currentProgress.phase === 'summarizing' && <FileText className="w-4 h-4 animate-pulse" />}
                <span className="capitalize">{currentProgress.phase}</span>
                {currentProgress.itemNumber && currentProgress.totalItems && (
                  <span className="text-zinc-500">
                    ({currentProgress.itemNumber} of {currentProgress.totalItems})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-medium">Search Failed</h3>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {results.length > 0 && !isLoading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Found {results.length} playlist{results.length !== 1 ? 's' : ''} for "{lastQuery}"
            </h3>
            <button
              onClick={() => handleSearch(lastQuery)}
              disabled={isLoading}
              className="text-sm text-green-400 hover:text-green-300 transition-colors"
            >
              Refresh Results
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((playlist) => (
              <PlaylistDiscoveryCard
                key={playlist.id}
                playlist={playlist}
                onPlay={handlePlay}
                onQueue={handleQueue}
                onSave={handleSave}
                onViewTracks={handleViewTracks}
                isLoading={isPlaybackLoading(`spotify:playlist:${playlist.id}`)}
                isSaved={savedPlaylists.has(playlist.id)}
                isSaving={savingPlaylists.has(playlist.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !isLoading && !error && (
        <div className="text-center py-16 space-y-4">
          <Music className="w-16 h-16 text-zinc-600 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-zinc-400">Ready to discover amazing playlists?</h3>
            <p className="text-zinc-500 max-w-md mx-auto">
              Enter a natural language query above to get started. Our AI will find the most relevant playlists for you.
            </p>
          </div>
          <div className="text-sm text-zinc-600 space-y-1">
            <p><strong>Try examples like:</strong></p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {[
                "taylor swift but on harp",
                "chill indie rock for studying", 
                "upbeat pop for workouts",
                "acoustic covers of popular songs",
                "90s hip hop classics"
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setQuery(example);
                    handleSearch(example);
                  }}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full text-xs transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Playlist Details Modal */}
      <PlaylistDetailsModal
        playlist={selectedPlaylist}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onPlayTrack={handlePlayTrack}
        onQueueTrack={handleQueueTrack}
        onPlayPlaylist={handlePlay}
      />
    </div>
  );
}