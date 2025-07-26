import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { api } from '../utils/api';

interface AIDiscoveredTrack {
  trackUri: string;
  trackName: string;
  artist: string;
  discoveredAt: number;
  reasoning: string;
  feedback?: 'loved' | 'disliked';
  feedbackAt?: number;
  previewUrl?: string;
}

interface DashboardData {
  discoveries: AIDiscoveredTrack[];
  loved: AIDiscoveredTrack[];
  disliked: AIDiscoveredTrack[];
  stats: {
    totalDiscoveries: number;
    lovedCount: number;
    dislikedCount: number;
    pendingCount: number;
  };
}

const FeedbackDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useSpotifyAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'loved' | 'disliked'>('pending');
  const [submittingFeedback, setSubmittingFeedback] = useState<Set<string>>(new Set());
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());

  const getTrackIdFromUri = (trackUri: string): string | null => {
    const match = trackUri.match(/spotify:track:(.+)/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    // Wait for auth check to complete before redirecting
    if (!authLoading && !isAuthenticated) {
      navigate('/landing');
      return;
    }

    // Only load data if authenticated and auth check is complete
    if (!authLoading && isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    // Load Spotify iFrame API if not already loaded
    if (!(window as any).onSpotifyIframeApiReady) {
      const script = document.createElement('script');
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      document.head.appendChild(script);
      
      (window as any).onSpotifyIframeApiReady = () => {
        // API ready - players will be created individually
        console.log('Spotify iFrame API ready');
      };
    }
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.getAIFeedbackDashboard();
      setData(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load feedback data');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (trackUri: string, feedback: 'loved' | 'disliked') => {
    if (!data) return;
    
    // Find the track in current data
    const targetTrack = data.discoveries.find(track => track.trackUri === trackUri);
    if (!targetTrack) return;
    
    // Prevent double submission if currently submitting
    if (submittingFeedback.has(trackUri)) {
      console.log('Feedback submission in progress for this track');
      return;
    }
    
    // If same feedback is clicked, remove it (undo)
    const isUndoing = targetTrack.feedback === feedback;
    
    // Add to submitting set to prevent duplicate requests
    setSubmittingFeedback(prev => new Set(prev).add(trackUri));
    
    // Check if this change will cause the item to disappear from current view
    const willDisappearFromView = isUndoing
      ? (filter === 'loved' || filter === 'disliked') // Undoing will move to pending
      : (filter === 'pending' && !isUndoing) ||
        (filter === 'loved' && feedback !== 'loved') ||
        (filter === 'disliked' && feedback !== 'disliked');
    
    // Start fade out animation if item will disappear
    if (willDisappearFromView) {
      setFadingOut(prev => new Set(prev).add(trackUri));
    }
    
    try {
      // Optimistic update: immediately update local state
      const updatedTrack = {
        ...targetTrack,
        feedback: isUndoing ? undefined : feedback,
        feedbackAt: isUndoing ? undefined : Date.now()
      };
      
      // Send API request in background first
      if (isUndoing) {
        await api.recordFeedback(trackUri, 'remove');
      } else {
        await api.recordFeedback(trackUri, feedback);
      }
      
      // Wait for fade animation if needed
      if (willDisappearFromView) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Match Tailwind's duration-300
      }
      
      // Update discoveries list
      const updatedDiscoveries = data.discoveries.map(track => 
        track.trackUri === trackUri ? updatedTrack : track
      );
      
      // Update feedback lists - handle changing/removing existing feedback
      let updatedLoved = data.loved.filter(track => track.trackUri !== trackUri);
      let updatedDisliked = data.disliked.filter(track => track.trackUri !== trackUri);
      
      if (!isUndoing) {
        if (feedback === 'loved') {
          updatedLoved = [...updatedLoved, updatedTrack];
        } else {
          updatedDisliked = [...updatedDisliked, updatedTrack];
        }
      }
      // If undoing, the track just gets removed from both lists (no addition)
      
      // Update stats
      const updatedStats = {
        ...data.stats,
        lovedCount: updatedLoved.length,
        dislikedCount: updatedDisliked.length,
        pendingCount: updatedDiscoveries.filter(d => !d.feedback).length
      };
      
      // Apply optimistic update to state
      setData({
        discoveries: updatedDiscoveries,
        loved: updatedLoved,
        disliked: updatedDisliked,
        stats: updatedStats
      });
      
    } catch (err) {
      console.error('Failed to record feedback:', err);
      // Revert optimistic update on error by reloading data
      await loadDashboardData();
    } finally {
      // Remove from submitting and fading sets
      setSubmittingFeedback(prev => {
        const newSet = new Set(prev);
        newSet.delete(trackUri);
        return newSet;
      });
      setFadingOut(prev => {
        const newSet = new Set(prev);
        newSet.delete(trackUri);
        return newSet;
      });
    }
  };

  const getFilteredTracks = (): AIDiscoveredTrack[] => {
    if (!data) return [];
    
    switch (filter) {
      case 'loved':
        return data.loved;
      case 'disliked':
        return data.disliked;
      case 'pending':
        return data.discoveries.filter(d => !d.feedback);
      case 'all':
      default:
        return data.discoveries;
    }
  };

  // Show loading while auth is checking or while data is loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-lg">
            {authLoading ? 'Checking authentication...' : 'Loading your feedback...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Error</h1>
          <p className="mb-4">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-green-500 text-black font-bold rounded-full hover:bg-green-400 transition-colors"
          >
            Back to Main App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">🎯 AI Feedback Dashboard</h1>
              <p className="text-gray-400">Manage your AI music discovery feedback</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
            >
              ← Back to Main App
            </button>
          </div>

          {/* Stats Cards */}
          {data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <div className="text-2xl font-bold text-green-400">{data.stats.totalDiscoveries}</div>
                <div className="text-sm text-gray-400">Total Discoveries</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <div className="text-2xl font-bold text-green-400">{data.stats.lovedCount}</div>
                <div className="text-sm text-gray-400">Loved</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <div className="text-2xl font-bold text-red-400">{data.stats.dislikedCount}</div>
                <div className="text-sm text-gray-400">Disliked</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <div className="text-2xl font-bold text-yellow-400">{data.stats.pendingCount}</div>
                <div className="text-sm text-gray-400">Pending</div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6">
            {(['pending', 'all', 'loved', 'disliked'] as const).map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === filterOption
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                }`}
              >
                {filterOption === 'pending' && '⏳ Pending Feedback'}
                {filterOption === 'all' && '📊 All Discoveries'}
                {filterOption === 'loved' && '❤️ Loved'}
                {filterOption === 'disliked' && '💔 Disliked'}
              </button>
            ))}
          </div>

          {/* Tracks List */}
          <div className="space-y-4">
            {getFilteredTracks().length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-2">No tracks found</p>
                <p>Try a different filter or start using AI discovery commands!</p>
              </div>
            ) : (
              getFilteredTracks().map((track, index) => (
                <div 
                  key={`${track.trackUri}-${index}`} 
                  className={`bg-zinc-800 rounded-lg p-6 border border-zinc-700 transition-all duration-300 ${
                    fadingOut.has(track.trackUri) 
                      ? 'opacity-0 scale-95 -translate-y-2' 
                      : 'opacity-100 scale-100 translate-y-0'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-1">{track.trackName}</h3>
                      <p className="text-gray-300 mb-2">by {track.artist}</p>
                      
                      {/* Spotify Preview Player */}
                      {(() => {
                        const trackId = getTrackIdFromUri(track.trackUri);
                        
                        // If we have a preview URL, use HTML5 audio for 30-second preview
                        if (track.previewUrl) {
                          return (
                            <div className="mb-3">
                              <div className="bg-zinc-700 p-3 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className="text-sm text-gray-300">🎵 30-second preview:</div>
                                  <audio controls className="flex-1">
                                    <source src={track.previewUrl} type="audio/mpeg" />
                                    Your browser does not support the audio element.
                                  </audio>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        // Fallback to Spotify iframe embed (may show preview for non-logged users)
                        return trackId ? (
                          <div className="mb-3">
                            <iframe
                              src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
                              width="100%"
                              height="152"
                              frameBorder="0"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                              style={{ borderRadius: '12px' }}
                              title={`${track.trackName} by ${track.artist}`}
                            />
                            <div className="text-xs text-gray-500 mt-1">
                              Note: Preview availability depends on your Spotify login status
                            </div>
                          </div>
                        ) : null;
                      })()}
                      
                      <p className="text-sm text-gray-400 italic">"{track.reasoning}"</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Discovered {new Date(track.discoveredAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 mt-4 md:mt-0">
                      <button
                        onClick={() => handleFeedback(track.trackUri, 'loved')}
                        disabled={submittingFeedback.has(track.trackUri)}
                        className={`px-4 py-2 rounded-lg transition-all ${
                          track.feedback === 'loved'
                            ? 'bg-green-600 text-white cursor-pointer hover:bg-green-700'
                            : submittingFeedback.has(track.trackUri)
                            ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
                            : track.feedback === 'disliked'
                            ? 'bg-zinc-700 hover:bg-green-600 text-zinc-300 cursor-pointer border border-green-500'
                            : 'bg-zinc-700 hover:bg-green-900 text-zinc-300 cursor-pointer'
                        }`}
                      >
                        {submittingFeedback.has(track.trackUri) 
                          ? '⏳' 
                          : track.feedback === 'loved' 
                            ? '💔 Unlove' 
                            : '👍 Love'}
                      </button>
                      <button
                        onClick={() => handleFeedback(track.trackUri, 'disliked')}
                        disabled={submittingFeedback.has(track.trackUri)}
                        className={`px-4 py-2 rounded-lg transition-all ${
                          track.feedback === 'disliked'
                            ? 'bg-red-600 text-white cursor-pointer hover:bg-red-700'
                            : submittingFeedback.has(track.trackUri)
                            ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
                            : track.feedback === 'loved'
                            ? 'bg-zinc-700 hover:bg-red-600 text-zinc-300 cursor-pointer border border-red-500'
                            : 'bg-zinc-700 hover:bg-red-900 text-zinc-300 cursor-pointer'
                        }`}
                      >
                        {submittingFeedback.has(track.trackUri) 
                          ? '⏳' 
                          : track.feedback === 'disliked' 
                            ? '❤️ Un-dislike' 
                            : '👎 Dislike'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDashboard;