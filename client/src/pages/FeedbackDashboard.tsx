import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { api } from '../utils/api';
import { ThumbsUp, ThumbsDown, Ban, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, BarChart3 } from 'lucide-react';

interface AIDiscoveredTrack {
  trackUri: string;
  trackName: string;
  artist: string;
  discoveredAt: number;
  reasoning: string;
  feedback?: 'loved' | 'disliked' | 'blocked';
  feedbackAt?: number;
  previewUrl?: string;
}

interface DashboardData {
  discoveries: AIDiscoveredTrack[];
  loved: AIDiscoveredTrack[];
  disliked: AIDiscoveredTrack[];
  blocked: AIDiscoveredTrack[];
  stats: {
    totalDiscoveries: number;
    lovedCount: number;
    dislikedCount: number;
    blockedCount: number;
    pendingCount: number;
  };
}

interface TrackCardProps {
  track: AIDiscoveredTrack;
  index: number;
  fadingOut: boolean;
  submittingFeedback: boolean;
  handleFeedback: (trackUri: string, feedback: 'loved' | 'disliked') => void;
  handleBlock: (trackUri: string) => void;
}

const TrackCard: React.FC<TrackCardProps> = ({ track, index, fadingOut, submittingFeedback, handleFeedback, handleBlock }) => {
  const [isEmbedLoaded, setIsEmbedLoaded] = useState(false);
  const trackId = track.trackUri.match(/spotify:track:(.+)/)?.[1] || null;
  
  return (
    <div 
      key={`${track.trackUri}-${index}`} 
      className={`bg-zinc-800 rounded-lg p-4 border border-zinc-700 transition-all duration-300 ${
        fadingOut ? 'opacity-0 scale-95 -translate-y-2' : 'opacity-100 scale-100 translate-y-0'
      }`}
    >
      <div className="flex items-start justify-between">
        {/* Spotify button on the left */}
        {trackId && !isEmbedLoaded && (
          <div className="mr-3 flex-shrink-0">
            <button
              onClick={() => setIsEmbedLoaded(true)}
              className="flex flex-col items-center justify-center p-2 hover:bg-zinc-700 rounded-lg transition-colors group"
              aria-label={`Load Spotify preview for ${track.trackName} by ${track.artist}`}
            >
              <svg
                className="w-8 h-8 text-green-500 group-hover:text-green-400 transition-colors"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <span className="text-[10px] text-gray-400 group-hover:text-gray-300 mt-1">play</span>
            </button>
          </div>
        )}
        
        {/* Audio preview if available */}
        {track.previewUrl && !isEmbedLoaded && (
          <div className="mr-3 flex-shrink-0">
            <button
              onClick={() => setIsEmbedLoaded(true)}
              className="flex flex-col items-center justify-center p-2 hover:bg-zinc-700 rounded-lg transition-colors group"
              aria-label={`Load 30-second preview for ${track.trackName} by ${track.artist}`}
            >
              <svg
                className="w-8 h-8 text-green-500 group-hover:text-green-400 transition-colors"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              <span className="text-[10px] text-gray-400 group-hover:text-gray-300 mt-1">30s</span>
            </button>
          </div>
        )}
        
        {/* Content in the middle */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">{track.trackName}</h3>
          <p className="text-gray-300 text-sm mb-2">by {track.artist}</p>
          <p className="text-sm text-gray-400 italic">"{track.reasoning}"</p>
          <p className="text-xs text-gray-500 mt-1">
            Discovered {new Date(track.discoveredAt).toLocaleDateString()}
          </p>
        </div>
        
        {/* Buttons on the right */}
        <div className="flex flex-col gap-2 ml-4 flex-shrink-0">
          <button
            onClick={() => handleFeedback(track.trackUri, 'loved')}
            disabled={submittingFeedback}
            className={`p-2 rounded-lg transition-all ${
              track.feedback === 'loved'
                ? 'bg-green-600 text-white cursor-pointer hover:bg-green-700'
                : submittingFeedback
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-zinc-700 hover:bg-zinc-600 text-green-500 cursor-pointer'
            }`}
            title={track.feedback === 'loved' ? 'Remove love' : 'Love this track'}
          >
            {submittingFeedback 
              ? <div className="w-5 h-5 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
              : <ThumbsUp className="w-5 h-5" fill={track.feedback === 'loved' ? 'currentColor' : 'none'} />
            }
          </button>
          <button
            onClick={() => handleBlock(track.trackUri)}
            disabled={submittingFeedback}
            className={`p-2 rounded-lg transition-all ${
              track.feedback === 'blocked'
                ? 'bg-red-600 text-white cursor-pointer hover:bg-red-700'
                : submittingFeedback
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-zinc-700 hover:bg-zinc-600 text-red-500 cursor-pointer'
            }`}
            title={track.feedback === 'blocked' ? 'Unblock this track' : 'Block this track from AI discoveries'}
          >
            {submittingFeedback 
              ? <div className="w-5 h-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
              : <Ban className="w-5 h-5" fill={track.feedback === 'blocked' ? 'currentColor' : 'none'} />
            }
          </button>
          <button
            onClick={() => handleFeedback(track.trackUri, 'disliked')}
            disabled={submittingFeedback}
            className={`p-2 rounded-lg transition-all ${
              track.feedback === 'disliked'
                ? 'bg-green-600 text-white cursor-pointer hover:bg-green-700'
                : submittingFeedback
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-zinc-700 hover:bg-zinc-600 text-green-500 cursor-pointer'
            }`}
            title={track.feedback === 'disliked' ? 'Remove dislike' : 'Dislike this track'}
          >
            {submittingFeedback 
              ? <div className="w-5 h-5 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
              : <ThumbsDown className="w-5 h-5" fill={track.feedback === 'disliked' ? 'currentColor' : 'none'} />
            }
          </button>
        </div>
      </div>
      
      {/* Spotify embed that appears below content when loaded */}
      {isEmbedLoaded && (
        <div className="mt-3">
          {track.previewUrl ? (
            <div className="bg-zinc-700 p-3 rounded-lg">
              <audio controls className="w-full">
                <source src={track.previewUrl} type="audio/mpeg" />
              </audio>
            </div>
          ) : trackId ? (
            <iframe
              src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
              width="100%"
              height="80"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ borderRadius: '12px' }}
              title={`${track.trackName} by ${track.artist}`}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

const FeedbackDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useSpotifyAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'loved' | 'disliked' | 'blocked'>('pending');
  const [submittingFeedback, setSubmittingFeedback] = useState<Set<string>>(new Set());
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());
  
  // Pagination state
  const ITEMS_PER_PAGE = 20;
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({
    all: 1,
    pending: 1,
    loved: 1,
    disliked: 1,
    blocked: 1
  });


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

  // Ensure current page doesn't exceed total pages when data changes
  useEffect(() => {
    const totalPages = getTotalPages();
    if (totalPages > 0 && currentPages[filter] > totalPages) {
      setCurrentPages(prev => ({
        ...prev,
        [filter]: totalPages
      }));
    }
  }, [data, filter]);


  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.getAIFeedbackDashboard();
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const jsonResponse = await response.json();
      console.log('[FeedbackDashboard] Raw API response:', jsonResponse);
      
      // Extract data from the response structure
      const data = jsonResponse.data || jsonResponse;
      
      // Ensure data has the expected structure
      const normalizedData = {
        discoveries: data.discoveries || [],
        loved: data.loved || [],
        disliked: data.disliked || [],
        blocked: data.blocked || [],
        stats: data.stats || {
          totalDiscoveries: 0,
          lovedCount: 0,
          dislikedCount: 0,
          blockedCount: 0,
          pendingCount: 0
        }
      };
      
      console.log('[FeedbackDashboard] Normalized data:', normalizedData);
      
      setData(normalizedData);
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
    const targetTrack = data.discoveries?.find(track => track.trackUri === trackUri);
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
      const updatedDiscoveries = (data.discoveries || []).map(track => 
        track.trackUri === trackUri ? updatedTrack : track
      );
      
      // Update feedback lists - handle changing/removing existing feedback
      let updatedLoved = (data.loved || []).filter(track => track.trackUri !== trackUri);
      let updatedDisliked = (data.disliked || []).filter(track => track.trackUri !== trackUri);
      
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
        ...(data.stats || {}),
        lovedCount: updatedLoved.length,
        dislikedCount: updatedDisliked.length,
        pendingCount: updatedDiscoveries.filter(d => !d.feedback).length
      };
      
      // Apply optimistic update to state
      setData({
        discoveries: updatedDiscoveries,
        loved: updatedLoved,
        disliked: updatedDisliked,
        blocked: data.blocked || [],
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

  const handleBlock = async (trackUri: string) => {
    if (!data) return;
    
    // Find the track in current data
    const targetTrack = data.discoveries?.find(track => track.trackUri === trackUri);
    if (!targetTrack) return;
    
    // Prevent double submission if currently submitting
    if (submittingFeedback.has(trackUri)) {
      console.log('Feedback submission in progress for this track');
      return;
    }
    
    // If already blocked, unblock it
    const isUndoing = targetTrack.feedback === 'blocked';
    
    // Add to submitting set to prevent duplicate requests
    setSubmittingFeedback(prev => new Set(prev).add(trackUri));
    
    // Check if this change will cause the item to disappear from current view
    const willDisappearFromView = isUndoing
      ? (filter === 'blocked') // Undoing will move to pending
      : (filter === 'pending' || filter === 'loved' || filter === 'disliked');
    
    // Start fade out animation if item will disappear
    if (willDisappearFromView) {
      setFadingOut(prev => new Set(prev).add(trackUri));
    }
    
    try {
      // Optimistic update: immediately update local state
      const updatedTrack = {
        ...targetTrack,
        feedback: isUndoing ? undefined : 'blocked' as const,
        feedbackAt: isUndoing ? undefined : Date.now()
      };
      
      // Send API request in background first
      if (isUndoing) {
        await api.recordFeedback(trackUri, 'remove');
      } else {
        await api.recordFeedback(trackUri, 'blocked');
      }
      
      // Wait for fade animation if needed
      if (willDisappearFromView) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Match Tailwind's duration-300
      }
      
      // Update discoveries list
      const updatedDiscoveries = (data.discoveries || []).map(track => 
        track.trackUri === trackUri ? updatedTrack : track
      );
      
      // Update feedback lists - handle changing/removing existing feedback
      let updatedLoved = (data.loved || []).filter(track => track.trackUri !== trackUri);
      let updatedDisliked = (data.disliked || []).filter(track => track.trackUri !== trackUri);
      let updatedBlocked = (data.blocked || []).filter(track => track.trackUri !== trackUri);
      
      if (!isUndoing) {
        updatedBlocked = [...updatedBlocked, updatedTrack];
      }
      
      // Update stats
      const updatedStats = {
        ...(data.stats || {}),
        lovedCount: updatedLoved.length,
        dislikedCount: updatedDisliked.length,
        blockedCount: updatedBlocked.length,
        pendingCount: updatedDiscoveries.filter(d => !d.feedback).length
      };
      
      // Apply optimistic update to state
      setData({
        discoveries: updatedDiscoveries,
        loved: updatedLoved,
        disliked: updatedDisliked,
        blocked: updatedBlocked,
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
        return data.loved || [];
      case 'disliked':
        return data.disliked || [];
      case 'blocked':
        return data.blocked || [];
      case 'pending':
        // Discoveries are already sorted by most recent first from the server
        return (data.discoveries || []).filter(d => !d.feedback);
      case 'all':
      default:
        return data.discoveries || [];
    }
  };

  const getPaginatedTracks = (): AIDiscoveredTrack[] => {
    const allTracks = getFilteredTracks();
    const currentPage = currentPages[filter];
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    
    return allTracks.slice(startIndex, endIndex);
  };

  const getTotalPages = (): number => {
    const allTracks = getFilteredTracks();
    return Math.ceil(allTracks.length / ITEMS_PER_PAGE);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPages(prev => ({
      ...prev,
      [filter]: newPage
    }));
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
    <div className="flex-1 flex flex-col">
      {/* Page Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-6 w-full">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-green-400">🎯 AI Feedback Dashboard</h1>
              <p className="text-gray-400 mt-1">Manage your AI music discovery feedback</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 py-8">

          {/* Stats Cards */}
          {data && data.stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <div className="text-2xl font-bold text-green-400">{data.stats.totalDiscoveries || 0}</div>
                <div className="text-sm text-gray-400">Total Discoveries</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <div className="text-2xl font-bold text-green-400">{data.stats.lovedCount || 0}</div>
                <div className="text-sm text-gray-400">Loved</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <div className="text-2xl font-bold text-red-400">{data.stats.dislikedCount || 0}</div>
                <div className="text-sm text-gray-400">Disliked</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <div className="text-2xl font-bold text-red-600">{data.stats.blockedCount || 0}</div>
                <div className="text-sm text-gray-400">Blocked</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <div className="text-2xl font-bold text-yellow-400">{data.stats.pendingCount || 0}</div>
                <div className="text-sm text-gray-400">Pending</div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {(['pending', 'all', 'loved', 'disliked', 'blocked'] as const).map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => {
                  setFilter(filterOption);
                  // Reset to page 1 when switching tabs
                  setCurrentPages(prev => ({
                    ...prev,
                    [filterOption]: 1
                  }));
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === filterOption
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                }`}
              >
                {filterOption === 'pending' && (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Pending Feedback</span>
                  </>
                )}
                {filterOption === 'all' && (
                  <>
                    <BarChart3 className="w-4 h-4" />
                    <span>All Discoveries</span>
                  </>
                )}
                {filterOption === 'loved' && (
                  <>
                    <ThumbsUp className="w-4 h-4" />
                    <span>Loved</span>
                  </>
                )}
                {filterOption === 'disliked' && (
                  <>
                    <ThumbsDown className="w-4 h-4" />
                    <span>Disliked</span>
                  </>
                )}
                {filterOption === 'blocked' && (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>Blocked</span>
                  </>
                )}
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
              getPaginatedTracks().map((track, index) => (
                <TrackCard
                  key={`${track.trackUri}-${index}`}
                  track={track}
                  index={index}
                  fadingOut={fadingOut.has(track.trackUri)}
                  submittingFeedback={submittingFeedback.has(track.trackUri)}
                  handleFeedback={handleFeedback}
                  handleBlock={handleBlock}
                />
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {getTotalPages() > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPages[filter] === 1}
                className={`p-2 rounded-lg transition-colors ${
                  currentPages[filter] === 1
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 cursor-pointer'
                }`}
                title="First page"
              >
                <ChevronsLeft className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => handlePageChange(currentPages[filter] - 1)}
                disabled={currentPages[filter] === 1}
                className={`p-2 rounded-lg transition-colors ${
                  currentPages[filter] === 1
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 cursor-pointer'
                }`}
                title="Previous page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="px-4 py-2 bg-zinc-800 rounded-lg text-gray-300">
                Page {currentPages[filter]} of {getTotalPages()}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPages[filter] + 1)}
                disabled={currentPages[filter] === getTotalPages()}
                className={`p-2 rounded-lg transition-colors ${
                  currentPages[filter] === getTotalPages()
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 cursor-pointer'
                }`}
                title="Next page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => handlePageChange(getTotalPages())}
                disabled={currentPages[filter] === getTotalPages()}
                className={`p-2 rounded-lg transition-colors ${
                  currentPages[filter] === getTotalPages()
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 cursor-pointer'
                }`}
                title="Last page"
              >
                <ChevronsRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackDashboard;