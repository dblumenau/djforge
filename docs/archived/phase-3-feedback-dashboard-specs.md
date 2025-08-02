## Phase 3 Implementation Specs for AI Minions

### CRITICAL WARNINGS (SAME AS PREVIOUS PHASES)
- DO NOT DELETE ANY EXISTING CODE
- DO NOT REFACTOR ANYTHING OUTSIDE YOUR SPECIFIC TASK  
- DO NOT "IMPROVE" OTHER PARTS OF THE CODEBASE
- ADD ONLY - MODIFY ONLY WHAT'S SPECIFIED
- TEST YOUR CHANGES DON'T BREAK EXISTING FUNCTIONALITY

### FORBIDDEN PATTERNS FOR PHASE 3
- NO creating reusable component libraries
- NO adding state management libraries (Redux, Zustand, etc.)
- NO creating custom hooks beyond what's specified
- NO adding CSS frameworks or component libraries
- NO creating "smart" components that do too much
- NO optimizing API calls beyond what's asked
- NO adding TypeScript generics or advanced types
- NO creating abstract data transformation layers

### Task 3.1: Create Feedback Dashboard Backend Endpoint

**Files to modify:**
1. `server/src/routes/feedback.ts` - ADD new dashboard endpoint
2. `server/src/services/UserDataService.ts` - ADD dashboard data aggregation method

**In `routes/feedback.ts`, ADD this endpoint:**
```typescript
// GET /api/feedback/dashboard - Get all feedback data for dashboard
router.get('/dashboard', ensureValidToken, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID not found' });
    }

    const userDataService = new UserDataService(
      loggingService?.redisClient,
      spotifyControl.getApi(),
      userId
    );

    const dashboardData = await userDataService.getAIFeedbackDashboard();
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching AI feedback dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback dashboard data'
    });
  }
});
```

**In `UserDataService.ts`, ADD this method:**
```typescript
async getAIFeedbackDashboard(): Promise<{
  discoveries: AIDiscoveredTrack[],
  loved: AIDiscoveredTrack[],
  disliked: AIDiscoveredTrack[],
  stats: {
    totalDiscoveries: number,
    lovedCount: number,
    dislikedCount: number,
    pendingCount: number
  }
}> {
  try {
    const discoveriesKey = `user:${this.userId}:ai_discoveries`;
    const lovedKey = `user:${this.userId}:ai_loved`;
    const dislikedKey = `user:${this.userId}:ai_disliked`;

    // Get all data in parallel
    const [rawDiscoveries, lovedMembers, dislikedMembers] = await Promise.all([
      this.redis.lRange(discoveriesKey, 0, 99), // Last 100 discoveries
      this.redis.zRangeWithScores(lovedKey, 0, -1),
      this.redis.zRangeWithScores(dislikedKey, 0, -1)
    ]);

    // Parse discoveries
    const discoveries = rawDiscoveries.map((item: string) => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Parse loved tracks
    const loved = lovedMembers.map((item: any) => {
      try {
        return JSON.parse(item.value);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Parse disliked tracks  
    const disliked = dislikedMembers.map((item: any) => {
      try {
        return JSON.parse(item.value);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Calculate stats
    const stats = {
      totalDiscoveries: discoveries.length,
      lovedCount: loved.length,
      dislikedCount: disliked.length,
      pendingCount: discoveries.length - loved.length - disliked.length
    };

    return { discoveries, loved, disliked, stats };
  } catch (error) {
    console.error('Error getting AI feedback dashboard:', error);
    return {
      discoveries: [],
      loved: [],
      disliked: [],
      stats: { totalDiscoveries: 0, lovedCount: 0, dislikedCount: 0, pendingCount: 0 }
    };
  }
}
```

**Task 3.1 Specific Guardrails:**
- DO NOT add caching logic for dashboard data
- DO NOT create pagination at this stage
- DO NOT add sorting or filtering backend logic
- Keep the data simple - just return raw lists
- Limit discoveries to last 300 to prevent performance issues

### Task 3.2: Create Frontend API Client Method

**Files to modify:**
1. `client/src/utils/api.ts` - ADD dashboard data fetching method

**In `api.ts`, ADD this method:**
```typescript
// Get AI feedback dashboard data
getAIFeedbackDashboard: async () => {
  const response = await fetch(apiEndpoint('/api/feedback/dashboard'), {
    method: 'GET',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}
```

**Task 3.2 Specific Guardrails:**
- DO NOT add any caching logic in the frontend
- DO NOT create separate API methods for stats/loved/disliked
- Use the existing error handling pattern

### Task 3.3: Create Feedback Dashboard Page Component

**Files to create:**
1. `client/src/pages/FeedbackDashboard.tsx` - CREATE NEW FILE

**Complete page implementation:**
```typescript
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
  const { isAuthenticated } = useSpotifyAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'loved' | 'disliked'>('pending');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/landing');
      return;
    }

    loadDashboardData();
  }, [isAuthenticated, navigate]);

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
    try {
      await api.recordFeedback(trackUri, feedback);
      // Reload data to show updated feedback
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to record feedback:', err);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-lg">Loading your feedback...</p>
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
                <div key={`${track.trackUri}-${index}`} className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
                  <div className="flex flex-col md:flex-row md:items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-1">{track.trackName}</h3>
                      <p className="text-gray-300 mb-2">by {track.artist}</p>
                      <p className="text-sm text-gray-400 italic">"{track.reasoning}"</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Discovered {new Date(track.discoveredAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 mt-4 md:mt-0">
                      <button
                        onClick={() => handleFeedback(track.trackUri, 'loved')}
                        className={`px-4 py-2 rounded-lg transition-all ${
                          track.feedback === 'loved'
                            ? 'bg-green-600 text-white'
                            : 'bg-zinc-700 hover:bg-green-900 text-zinc-300'
                        }`}
                      >
                        👍 Love
                      </button>
                      <button
                        onClick={() => handleFeedback(track.trackUri, 'disliked')}
                        className={`px-4 py-2 rounded-lg transition-all ${
                          track.feedback === 'disliked'
                            ? 'bg-red-600 text-white'
                            : 'bg-zinc-700 hover:bg-red-900 text-zinc-300'
                        }`}
                      >
                        👎 Dislike
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
```

**Task 3.3 Specific Guardrails:**
- DO NOT add Spotify preview players (that's Task 3.6)
- DO NOT create separate components for tracks or stats
- DO NOT add complex sorting/pagination logic
- Keep all logic in one file for simplicity
- Use only Tailwind classes that exist in v4

### Task 3.4: Add Route to Router

**Files to modify:**
1. `client/src/App.tsx` - ADD new route for feedback dashboard

**In `App.tsx`, ADD this route:**
```typescript
// Add this import at the top
import FeedbackDashboard from './pages/FeedbackDashboard';

// Add this route in the Routes section
<Route path="/feedback-dashboard" element={<FeedbackDashboard />} />
```

**Task 3.4 Specific Guardrails:**
- DO NOT modify any existing routes
- DO NOT add route guards beyond existing auth check
- ADD the route exactly as specified

### Task 3.5: Add Navigation Link to Main App

**Files to modify:**
1. `client/src/pages/MainApp.tsx` - ADD button to navigate to feedback dashboard

**In `MainApp.tsx`, ADD this button in the header section (near the Dashboard button):**
```typescript
<button
  onClick={() => navigate('/feedback-dashboard')}
  className="px-4 py-2 bg-orange-600 text-white font-semibold rounded-full hover:bg-orange-700 transition-colors text-sm"
>
  AI Feedback
</button>
```

**Task 3.5 Specific Guardrails:**
- ADD the button near the existing Dashboard button
- DO NOT modify the layout significantly
- Use orange color to distinguish from other buttons
- Keep the button text short

### Task 3.6: Add Spotify Preview Players to Track Cards

**Files to modify:**
1. `client/src/pages/FeedbackDashboard.tsx` - ADD Spotify iframe preview players to each track

**Implementation Details:**

**Step 1: Include Spotify iFrame API script**
Add this to the component's useEffect:
```typescript
useEffect(() => {
  // Load Spotify iFrame API if not already loaded
  if (!window.onSpotifyIframeApiReady) {
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    document.head.appendChild(script);
    
    window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
      // API ready - players will be created individually
      console.log('Spotify iFrame API ready');
    };
  }
}, []);
```

**Step 2: Extract track ID from URI**
Add this helper function:
```typescript
const getTrackIdFromUri = (trackUri: string): string | null => {
  const match = trackUri.match(/spotify:track:(.+)/);
  return match ? match[1] : null;
};
```

**Step 3: Modify track card rendering**
Replace the track name/artist section in the track cards with:
```typescript
<div className="flex-1">
  <h3 className="text-xl font-semibold text-white mb-1">{track.trackName}</h3>
  <p className="text-gray-300 mb-2">by {track.artist}</p>
  
  {/* Add Spotify Preview Player */}
  {(() => {
    const trackId = getTrackIdFromUri(track.trackUri);
    return trackId ? (
      <div className="mb-3">
        <iframe
          src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          frameBorder="0"
          allowfullscreen=""
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{ borderRadius: '12px' }}
          title={`Preview of ${track.trackName} by ${track.artist}`}
        />
      </div>
    ) : null;
  })()}
  
  <p className="text-sm text-gray-400 italic">"{track.reasoning}"</p>
  <p className="text-xs text-gray-500 mt-2">
    Discovered {new Date(track.discoveredAt).toLocaleDateString()}
  </p>
</div>
```

**Task 3.6 Specific Guardrails:**
- Preview players should be 152px height (Spotify standard)
- Use theme=0 for dark theme to match dashboard
- Include proper accessibility attributes (title, allow)
- Handle cases where track URI is invalid gracefully
- Do NOT create separate player components
- Do NOT add play/pause controls beyond Spotify's built-in ones
- Do NOT try to sync players with main Spotify app
- Keep iframe styling minimal (just border radius)

**Preview Player Behavior:**
- For users logged into Spotify: Full 30-second previews
- For users not logged in: 30-second previews automatically
- No authentication required for preview functionality
- Players are independent - multiple can play simultaneously

### Testing Checklist for Phase 3
- [ ] `/feedback-dashboard` route loads without errors
- [ ] Stats show correct counts
- [ ] Filter tabs work properly
- [ ] Feedback buttons update state correctly
- [ ] Navigation back to main app works
- [ ] Page handles empty state gracefully
- [ ] Mobile responsive design works
- [ ] Spotify preview players load for each track
- [ ] Preview players have proper dark theme styling
- [ ] Players handle invalid track URIs gracefully
- [ ] Multiple players can play simultaneously
- [ ] TypeScript compiles without errors
- [ ] Existing functionality still works

### FINAL WARNINGS FOR PHASE 3
1. If you created more than 1 new page file, you did too much
2. If you added more than 400 lines total, you overdid it (increased for Task 3.6)
3. If you installed any npm packages, UNINSTALL THEM
4. If you created any reusable components, DELETE THEM
5. If you added any CSS files, REMOVE THEM
6. Keep it simple - dashboard with preview players, nothing more!

### Expected File Changes Summary
- ✅ `server/src/routes/feedback.ts` - ADD 1 endpoint method
- ✅ `server/src/services/UserDataService.ts` - ADD 1 dashboard method  
- ✅ `client/src/utils/api.ts` - ADD 1 API method
- ✅ `client/src/pages/FeedbackDashboard.tsx` - CREATE NEW (only new file) + ADD preview players
- ✅ `client/src/App.tsx` - ADD 1 route line
- ✅ `client/src/pages/MainApp.tsx` - ADD 1 button

**Total: 6 files modified, 1 file created**

### Task 3.6 Note
Task 3.6 adds Spotify preview players to the FeedbackDashboard component. This enhances the user experience by allowing quick track previews for better feedback decisions. The implementation uses Spotify's official iframe embed API with proper error handling and accessibility features.
