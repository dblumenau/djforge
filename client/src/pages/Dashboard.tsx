import { useState, useEffect, useCallback } from 'react';
import { apiEndpoint } from '../config/api';
import { authenticatedFetch } from '../utils/api';
import MusicLoader from '../components/MusicLoader';
import AlbumGrid from '../components/dashboard/AlbumGrid';
import RecentlyPlayedTimeline from '../components/dashboard/RecentlyPlayedTimeline';
import SavedTracksTable from '../components/dashboard/SavedTracksTable';
import GenreDistribution from '../components/dashboard/GenreDistribution';
import ListeningTrends from '../components/dashboard/ListeningTrends';
import PlaylistGrid from '../components/dashboard/PlaylistGrid';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';

// Spotify type definitions for client-side
interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

interface SpotifyArtist {
  id: string;
  name: string;
  type: 'artist';
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
  genres?: string[];
  popularity?: number;
  followers?: {
    total: number;
  };
  images?: SpotifyImage[];
}

interface SpotifyAlbum {
  id: string;
  name: string;
  type: 'album';
  uri: string;
  href: string;
  album_type: 'album' | 'single' | 'compilation';
  total_tracks: number;
  available_markets: string[];
  external_urls: {
    spotify: string;
  };
  images: SpotifyImage[];
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  artists: SpotifyArtist[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  type: 'track';
  uri: string;
  href: string;
  duration_ms: number;
  explicit: boolean;
  popularity: number;
  preview_url: string | null;
  track_number: number;
  disc_number: number;
  external_urls: {
    spotify: string;
  };
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  is_local: boolean;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  type: 'playlist';
  uri: string;
  href: string;
  description: string | null;
  public: boolean;
  collaborative: boolean;
  external_urls: {
    spotify: string;
  };
  images: SpotifyImage[];
  owner: {
    id: string;
    display_name: string;
    type: 'user';
  };
  tracks: {
    href: string;
    total: number;
  };
}

interface SpotifyUser {
  id: string;
  display_name?: string;
  email?: string;
  type: 'user';
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
  followers?: {
    total: number;
  };
  images?: SpotifyImage[];
  country?: string;
  product?: string;
}

interface SpotifyRecentlyPlayedItem {
  track: SpotifyTrack;
  played_at: string;
  context: {
    type: 'artist' | 'playlist' | 'album' | 'show' | 'episode';
    href: string;
    external_urls: {
      spotify: string;
    };
    uri: string;
  } | null;
}

interface SpotifySavedTrackItem {
  added_at: string;
  track: SpotifyTrack;
}

interface SpotifySavedAlbumItem {
  added_at: string;
  album: SpotifyAlbum;
}

// Skeleton components
import ProfileSkeleton from '../components/skeletons/ProfileSkeleton';
import StatCardSkeleton from '../components/skeletons/StatCardSkeleton';
import TrackListSkeleton from '../components/skeletons/TrackListSkeleton';
import AlbumGridSkeleton from '../components/skeletons/AlbumGridSkeleton';
import TimelineSkeleton from '../components/skeletons/TimelineSkeleton';
import ChartSkeleton from '../components/skeletons/ChartSkeleton';

interface DashboardData {
  profile: SpotifyUser;
  topArtists: {
    short_term: SpotifyArtist[];
    medium_term: SpotifyArtist[];
    long_term: SpotifyArtist[];
  };
  topTracks: {
    short_term: SpotifyTrack[];
    medium_term: SpotifyTrack[];
    long_term: SpotifyTrack[];
  };
  savedTracks: {
    items: SpotifySavedTrackItem[];
    total: number;
    limit: number;
    offset: number;
  };
  savedAlbums: {
    items: SpotifySavedAlbumItem[];
    total: number;
    limit: number;
    offset: number;
  };
  recentlyPlayed: SpotifyRecentlyPlayedItem[];
  playlists: SpotifyPlaylist[];
}

type Section = 'overview' | 'top' | 'saved' | 'recent' | 'playlists' | 'insights';

interface DashboardLoadingState {
  profile: boolean;
  stats: boolean; 
  topItems: boolean;
  savedTracks: boolean;
  savedAlbums: boolean;
  recentlyPlayed: boolean;
  playlists: boolean;
  insights: boolean;
}

export default function Dashboard() {
  const { playTrack, queueTrack, playPlaylist, isLoading } = useSpotifyPlayback();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [activeTab, setActiveTab] = useState<'artists' | 'tracks'>('artists');
  const [timeRange, setTimeRange] = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMoreTracks, setLoadingMoreTracks] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<string>('');
  
  // Granular loading states for each section
  const [loadingStates, setLoadingStates] = useState<DashboardLoadingState>({
    profile: true,
    stats: true,
    topItems: true,
    savedTracks: true,
    savedAlbums: true,
    recentlyPlayed: true,
    playlists: true,
    insights: true,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
        setRefreshProgress('Starting refresh...');
        console.log('🔄 Starting dashboard refresh...');
      } else {
        setLoading(true);
        console.log('📊 Loading dashboard data...');
      }
      
      const startTime = Date.now();
      console.log(`📡 Fetching dashboard data from: /api/user-data/dashboard${refresh ? '?refresh=true' : ''}`);
      
      if (refresh) {
        setRefreshProgress('Fetching your Spotify data...');
      }
      
      const response = await authenticatedFetch(apiEndpoint(`/api/user-data/dashboard${refresh ? '?refresh=true' : ''}`));
      
      const fetchTime = Date.now() - startTime;
      console.log(`⏱️ Dashboard fetch took: ${fetchTime}ms`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Dashboard response received:', {
          success: data.success,
          cached: data.cached,
          dataKeys: data.data ? Object.keys(data.data) : [],
          profile: data.data?.profile?.display_name,
          topArtistsCount: {
            short: data.data?.topArtists?.short_term?.length,
            medium: data.data?.topArtists?.medium_term?.length,
            long: data.data?.topArtists?.long_term?.length
          },
          topTracksCount: {
            short: data.data?.topTracks?.short_term?.length,
            medium: data.data?.topTracks?.medium_term?.length,
            long: data.data?.topTracks?.long_term?.length
          },
          savedTracksCount: data.data?.savedTracks?.total,
          savedAlbumsCount: data.data?.savedAlbums?.total,
          recentlyPlayedCount: data.data?.recentlyPlayed?.length,
          playlistsCount: data.data?.playlists?.length
        });
        
        if (data.success) {
          setDashboardData(data.data);
          setError(null);
          setRefreshProgress('');
          console.log('✅ Dashboard data successfully set in state');
          
          // Clear all loading states once data is available
          setLoadingStates({
            profile: false,
            stats: false,
            topItems: false,
            savedTracks: false,
            savedAlbums: false,
            recentlyPlayed: false,
            playlists: false,
            insights: false,
          });
        } else {
          throw new Error(data.error || 'Failed to fetch dashboard data');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err: any) {
      console.error('❌ Dashboard error:', err);
      setError(err.message || 'Failed to load dashboard data');
      setRefreshProgress('');
    } finally {
      console.log(`🏁 Dashboard ${refresh ? 'refresh' : 'load'} completed`);
      setLoading(false);
      setRefreshing(false);
      setRefreshProgress('');
    }
  };

  const loadMoreSavedTracks = useCallback(async () => {
    if (!dashboardData || loadingMoreTracks) return;
    
    try {
      setLoadingMoreTracks(true);
      const offset = dashboardData.savedTracks.items.length;
      const response = await authenticatedFetch(
        apiEndpoint(`/api/user-data/saved-tracks?limit=50&offset=${offset}`)
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDashboardData(prev => ({
            ...prev!,
            savedTracks: {
              ...prev!.savedTracks,
              items: [...prev!.savedTracks.items, ...data.data.items]
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error loading more tracks:', error);
    } finally {
      setLoadingMoreTracks(false);
    }
  }, [dashboardData, loadingMoreTracks]);

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case 'short_term': return 'Last 4 Weeks';
      case 'medium_term': return 'Last 6 Months';
      case 'long_term': return 'All Time';
      default: return range;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <MusicLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => fetchDashboardData()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const sections = [
    { id: 'overview' as Section, label: 'Overview', icon: '🏠' },
    { id: 'top' as Section, label: 'Top Items', icon: '🔥' },
    { id: 'saved' as Section, label: 'Library', icon: '💚' },
    { id: 'recent' as Section, label: 'Recent', icon: '🕐' },
    { id: 'playlists' as Section, label: 'Playlists', icon: '📂' },
    { id: 'insights' as Section, label: 'Insights', icon: '📊' }
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Page Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-green-400">📊 Spotify Dashboard</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Data'}
              </button>
              {refreshProgress && (
                <span className="text-sm text-zinc-400 animate-pulse">
                  {refreshProgress}
                </span>
              )}
            </div>
          </div>
          
          {/* Section Navigation */}
          <nav className="flex gap-2 overflow-x-auto pb-2">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
                  activeSection === section.id
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                <span className="mr-2">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-8">
            {/* Profile Section */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
              {loadingStates.profile || !dashboardData ? (
                <ProfileSkeleton />
              ) : (
                <div className="bg-zinc-900 rounded-lg p-6 flex items-center gap-6">
                  {dashboardData.profile.images?.[0] && (
                    <img
                      src={dashboardData.profile.images[0].url}
                      alt={dashboardData.profile.display_name}
                      className="w-24 h-24 rounded-full"
                    />
                  )}
                  <div>
                    <h3 className="text-2xl font-bold">{dashboardData.profile.display_name}</h3>
                    <p className="text-zinc-400">{dashboardData.profile.email}</p>
                    <p className="text-sm text-zinc-500 mt-2">
                      {dashboardData.profile.product === 'premium' ? '✓ Premium' : 'Free'} • 
                      {dashboardData.profile.country} • 
                      {dashboardData.profile.followers?.total || 0} followers
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Quick Stats */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {loadingStates.stats || !dashboardData ? (
                <>
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </>
              ) : (
                <>
                  <div className="bg-zinc-900 rounded-lg p-6 text-center">
                    <p className="text-3xl font-bold text-green-400">{dashboardData.savedTracks.total}</p>
                    <p className="text-sm text-zinc-400 mt-1">Liked Songs</p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-6 text-center">
                    <p className="text-3xl font-bold text-purple-400">{dashboardData.savedAlbums.total}</p>
                    <p className="text-sm text-zinc-400 mt-1">Saved Albums</p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-6 text-center">
                    <p className="text-3xl font-bold text-orange-400">{dashboardData.playlists.length}</p>
                    <p className="text-sm text-zinc-400 mt-1">Playlists</p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-6 text-center">
                    <p className="text-3xl font-bold text-blue-400">{dashboardData.recentlyPlayed.length}</p>
                    <p className="text-sm text-zinc-400 mt-1">Recent Tracks</p>
                  </div>
                </>
              )}
            </section>

            {/* Recent Activity Preview */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
              <div className="bg-zinc-900 rounded-lg p-6">
                {loadingStates.recentlyPlayed || !dashboardData ? (
                  <TimelineSkeleton dateGroups={2} tracksPerGroup={3} />
                ) : (
                  <>
                    <RecentlyPlayedTimeline 
                      tracks={dashboardData.recentlyPlayed.slice(0, 10)} 
                      onPlay={playTrack}
                      onQueue={queueTrack}
                      isLoading={isLoading}
                    />
                    {dashboardData.recentlyPlayed.length > 10 && (
                      <button
                        onClick={() => setActiveSection('recent')}
                        className="mt-4 text-sm text-green-400 hover:text-green-300"
                      >
                        View all {dashboardData.recentlyPlayed.length} tracks →
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Top Items Section */}
        {activeSection === 'top' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('artists')}
                  className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                    activeTab === 'artists' 
                      ? 'text-green-400 border-green-400' 
                      : 'text-zinc-400 border-transparent hover:text-white'
                  }`}
                >
                  Top Artists
                </button>
                <button
                  onClick={() => setActiveTab('tracks')}
                  className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                    activeTab === 'tracks' 
                      ? 'text-green-400 border-green-400' 
                      : 'text-zinc-400 border-transparent hover:text-white'
                  }`}
                >
                  Top Tracks
                </button>
              </div>
              
              {/* Time Range Selector */}
              <div className="flex gap-2">
                {(['short_term', 'medium_term', 'long_term'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      timeRange === range
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {getTimeRangeLabel(range)}
                  </button>
                ))}
              </div>
            </div>

            {/* Top Artists Grid */}
            {activeTab === 'artists' && (
              <>
                {loadingStates.topItems || !dashboardData ? (
                  <AlbumGridSkeleton count={20} />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {dashboardData.topArtists[timeRange].slice(0, 20).map((artist, index) => (
                      <div key={artist.id} className="bg-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-colors">
                        <div className="relative">
                          <span className="absolute top-2 left-2 bg-black/60 text-xs px-2 py-1 rounded">
                            #{index + 1}
                          </span>
                          {artist.images?.[0] && (
                            <img
                              src={artist.images[0].url}
                              alt={artist.name}
                              className="w-full aspect-square object-cover rounded-lg mb-3"
                            />
                          )}
                        </div>
                        <h4 className="font-semibold truncate">{artist.name}</h4>
                        <p className="text-sm text-zinc-400 truncate">
                          {artist.genres?.slice(0, 2).join(', ') || 'No genres'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Popularity: {artist.popularity}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Top Tracks List */}
            {activeTab === 'tracks' && (
              <>
                {loadingStates.topItems || !dashboardData ? (
                  <TrackListSkeleton count={20} />
                ) : (
                  <div className="space-y-2">
                    {dashboardData.topTracks[timeRange].slice(0, 20).map((track, index) => (
                  <div key={track.id} className="bg-zinc-900 rounded-lg p-4 flex items-center gap-4 hover:bg-zinc-800 transition-colors group">
                    <span className="text-zinc-500 w-8 text-right">#{index + 1}</span>
                    {track.album?.images?.[0] && (
                      <img
                        src={track.album.images[0].url}
                        alt={track.album.name}
                        className="w-12 h-12 rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate">{track.name}</h4>
                      <p className="text-sm text-zinc-400 truncate">
                        {track.artists?.map((a: any) => a.name).join(', ')} • {track.album?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => playTrack(track.uri)}
                        disabled={isLoading(track.uri)}
                        className="disabled:opacity-50"
                        title="Play"
                      >
                        {isLoading(track.uri) ? (
                          <svg className="animate-spin h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-8 h-8 text-green-500 hover:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => queueTrack(track.uri)}
                        disabled={isLoading(track.uri)}
                        className="disabled:opacity-50"
                        title="Add to Queue"
                      >
                        {isLoading(track.uri) ? (
                          <svg className="animate-spin h-6 w-6 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-zinc-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-zinc-400">
                        {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                      </p>
                      <p className="text-xs text-zinc-500">Pop: {track.popularity}</p>
                    </div>
                  </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Saved/Library Section */}
        {activeSection === 'saved' && (
          <div className="space-y-8">
            {/* Saved Tracks */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Liked Songs</h2>
              {loadingStates.savedTracks || !dashboardData ? (
                <TrackListSkeleton count={10} />
              ) : (
                <SavedTracksTable
                  tracks={dashboardData.savedTracks.items}
                  total={dashboardData.savedTracks.total}
                  onPlay={playTrack}
                  onQueue={queueTrack}
                  onLoadMore={loadMoreSavedTracks}
                  loading={loadingMoreTracks}
                  isLoading={isLoading}
                />
              )}
            </section>

            {/* Saved Albums */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Saved Albums</h2>
              {loadingStates.savedAlbums || !dashboardData ? (
                <AlbumGridSkeleton count={18} />
              ) : (
                <AlbumGrid 
                  albums={dashboardData.savedAlbums.items} 
                  onPlay={(uri) => playPlaylist(uri)}
                  isLoading={isLoading}
                />
              )}
            </section>
          </div>
        )}

        {/* Recently Played Section */}
        {activeSection === 'recent' && (
          <section>
            <h2 className="text-xl font-semibold mb-6">Recently Played</h2>
            {loadingStates.recentlyPlayed || !dashboardData ? (
              <TimelineSkeleton dateGroups={4} tracksPerGroup={5} />
            ) : (
              <RecentlyPlayedTimeline 
                tracks={dashboardData.recentlyPlayed} 
                onPlay={playTrack}
                onQueue={queueTrack}
                isLoading={isLoading}
              />
            )}
          </section>
        )}

        {/* Playlists Section */}
        {activeSection === 'playlists' && (
          <section>
            <h2 className="text-xl font-semibold mb-6">Your Playlists</h2>
            {loadingStates.playlists || !dashboardData ? (
              <AlbumGridSkeleton count={15} />
            ) : (
              <PlaylistGrid 
                playlists={dashboardData.playlists}
                onPlay={playPlaylist}
                isLoading={isLoading}
              />
            )}
          </section>
        )}

        {/* Insights Section */}
        {activeSection === 'insights' && (
          <div className="space-y-8">
            {/* Listening Trends */}
            <section>
              <h2 className="text-xl font-semibold mb-6">Listening Patterns</h2>
              {loadingStates.insights || !dashboardData ? (
                <ChartSkeleton height="h-64" />
              ) : (
                <ListeningTrends recentlyPlayed={dashboardData.recentlyPlayed} />
              )}
            </section>

            {/* Genre Distribution */}
            <section>
              <h2 className="text-xl font-semibold mb-6">Your Music Taste</h2>
              {loadingStates.insights || !dashboardData ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartSkeleton height="h-80" title={false} />
                  <ChartSkeleton height="h-80" title={false} />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GenreDistribution 
                    artists={dashboardData.topArtists[timeRange]} 
                    timeRange={timeRange}
                  />
                  <div className="bg-zinc-900 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-2">Top Genres</h3>
                  <p className="text-sm text-zinc-400 mb-6">Your most listened genres</p>
                  <div className="space-y-3">
                    {(() => {
                      const genreCounts: Record<string, number> = {};
                      dashboardData.topArtists[timeRange].forEach((artist, index) => {
                        const weight = dashboardData.topArtists[timeRange].length - index;
                        artist.genres.forEach((genre: string) => {
                          genreCounts[genre] = (genreCounts[genre] || 0) + weight;
                        });
                      });
                      
                      return Object.entries(genreCounts)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 10)
                        .map(([genre, count], index) => (
                          <div key={genre} className="flex items-center justify-between">
                            <span className="text-sm capitalize">{genre}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 bg-zinc-700 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ width: `${(count / Object.values(genreCounts)[0]) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-zinc-500 w-8 text-right">#{index + 1}</span>
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                  </div>
                </div>
                )}
            </section>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}