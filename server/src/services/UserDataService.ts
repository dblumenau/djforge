import { SpotifyWebAPI } from '../spotify/api';
import { 
  UserProfile, 
  SpotifyArtist, 
  SpotifyTrackExtended, 
  SavedTrack, 
  SavedAlbum, 
  RecentlyPlayedItem,
  SpotifyPlaylist,
  TimeRange,
  PaginatedResponse,
  UserDashboardData
} from '../types/spotify-data';
import { AIDiscoveredTrack } from '../types';

export class UserDataService {
  private redis: any; // Using any to avoid Redis type conflicts
  private spotifyApi: SpotifyWebAPI;
  private userId: string;
  private defaultTTL = 3600; // 1 hour cache by default

  constructor(redis: any, spotifyApi: SpotifyWebAPI, userId: string) {
    this.redis = redis;
    this.spotifyApi = spotifyApi;
    this.userId = userId;
  }

  async generateTasteProfile(contextType?: 'specific' | 'discovery' | 'conversational' | 'control' | 'info'): Promise<string> {
    try {
      console.log(`[TasteProfile] Starting generation for user: ${this.userId}`);
      
      // Check cache first - include context type in cache key for different variants
      const cacheKey = `taste:profile:${this.userId}${contextType ? `:${contextType}` : ''}`;
      const cachedProfile = await this.redis?.get(cacheKey);
      if (cachedProfile) {
        console.log(`[TasteProfile] Returning cached ${contextType || 'general'} profile`);
        return cachedProfile;
      }

      console.log('[TasteProfile] Cache miss, fetching fresh data...');

      // Fetch data needed for taste profile
      const [topArtistsMedium, topTracksMedium, recentTracks] = await Promise.all([
        this.getTopArtists('medium_term', false),
        this.getTopTracks('medium_term', false),
        this.getRecentlyPlayed()
      ]);

      console.log(`[TasteProfile] Data fetched - Artists: ${topArtistsMedium.length}, Tracks: ${topTracksMedium.length}, Recent: ${recentTracks.length}`);

      // Check if we have enough data
      if (topArtistsMedium.length === 0 && topTracksMedium.length === 0) {
        console.log('[TasteProfile] No top artists or tracks available - user may be new or have limited listening history');
        return 'User music preferences not available - insufficient listening history';
      }

      // Calculate genre distribution
      const genreCounts: Record<string, number> = {};
      topArtistsMedium.forEach((artist, index) => {
        const weight = topArtistsMedium.length - index;
        artist.genres.forEach(genre => {
          genreCounts[genre] = (genreCounts[genre] || 0) + weight;
        });
      });

      // Sort genres by weight
      const topGenres = Object.entries(genreCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([genre]) => genre);

      console.log(`[TasteProfile] Top genres: ${topGenres.join(', ')}`);

      // Get AI feedback data
      const aiFeedback = await this.getAIFeedback();
      
      // Build context-aware taste profile
      let profile = this.buildContextualProfile(contextType, topGenres, topArtistsMedium, topTracksMedium, aiFeedback);

      // Cache for 1 hour
      if (this.redis) {
        await this.redis.setEx(cacheKey, 3600, profile);
        console.log('[TasteProfile] Profile cached successfully');
      }

      return profile;
    } catch (error) {
      console.error('[TasteProfile] Error generating taste profile:', error);
      console.error('[TasteProfile] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return 'User music preferences not available';
    }
  }

  // Cache key generators
  private getKey(suffix: string): string {
    return `user:${this.userId}:${suffix}`;
  }

  // Generic cache getter
  private async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error(`Error getting cached data for ${key}:`, error);
    }
    return null;
  }

  // Generic cache setter
  private async setCachedData(key: string, data: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      await this.redis.setEx(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.error(`Error setting cached data for ${key}:`, error);
    }
  }

  // User Profile
  async getUserProfile(forceRefresh = false): Promise<UserProfile> {
    const key = this.getKey('profile');
    
    if (!forceRefresh) {
      const cached = await this.getCachedData<UserProfile>(key);
      if (cached) {
        console.log('📦 Profile loaded from cache');
        return cached;
      }
    }

    console.log('🌐 Fetching profile from Spotify API...');
    const profile = await this.spotifyApi.getUserProfile();
    await this.setCachedData(key, profile, 7200); // 2 hours for profile
    return profile;
  }

  // Top Artists
  async getTopArtists(timeRange: TimeRange = 'medium_term', forceRefresh = false): Promise<SpotifyArtist[]> {
    const key = this.getKey(`top_artists:${timeRange}`);
    
    if (!forceRefresh) {
      const cached = await this.getCachedData<SpotifyArtist[]>(key);
      if (cached) return cached;
    }

    const artists = await this.spotifyApi.getTopArtists(timeRange, 50);
    await this.setCachedData(key, artists);

    // Also store in sorted set for ranking
    const sortedKey = this.getKey(`top_artists_sorted:${timeRange}`);
    const multi = this.redis.multi();
    multi.del(sortedKey);
    artists.forEach((artist, index) => {
      multi.zAdd(sortedKey, { score: artists.length - index, value: artist.id });
    });
    multi.expire(sortedKey, this.defaultTTL);
    await multi.exec();

    return artists;
  }

  // Top Tracks
  async getTopTracks(timeRange: TimeRange = 'medium_term', forceRefresh = false): Promise<SpotifyTrackExtended[]> {
    const key = this.getKey(`top_tracks:${timeRange}`);
    
    if (!forceRefresh) {
      const cached = await this.getCachedData<SpotifyTrackExtended[]>(key);
      if (cached) return cached;
    }

    const tracks = await this.spotifyApi.getTopTracks(timeRange, 50);
    await this.setCachedData(key, tracks);

    // Store in sorted set
    const sortedKey = this.getKey(`top_tracks_sorted:${timeRange}`);
    const multi = this.redis.multi();
    multi.del(sortedKey);
    tracks.forEach((track, index) => {
      multi.zAdd(sortedKey, { score: tracks.length - index, value: track.id });
    });
    multi.expire(sortedKey, this.defaultTTL);
    await multi.exec();

    return tracks;
  }

  // Saved Tracks (with pagination)
  async getSavedTracks(limit = 50, offset = 0, forceRefresh = false): Promise<PaginatedResponse<SavedTrack>> {
    const key = this.getKey(`saved_tracks:${limit}:${offset}`);
    
    if (!forceRefresh) {
      const cached = await this.getCachedData<PaginatedResponse<SavedTrack>>(key);
      if (cached) return cached;
    }

    const response = await this.spotifyApi.getSavedTracks(limit, offset);
    const paginatedResponse: PaginatedResponse<SavedTrack> = {
      items: response.items,
      total: response.total,
      limit,
      offset,
      next: response.next,
      previous: response.previous
    };

    await this.setCachedData(key, paginatedResponse);

    // Store track IDs in list for quick access
    if (offset === 0) {
      const listKey = this.getKey('saved_tracks_ids');
      const multi = this.redis.multi();
      multi.del(listKey);
      response.items.forEach((item: SavedTrack) => {
        multi.rPush(listKey, item.track.id);
      });
      multi.expire(listKey, this.defaultTTL);
      await multi.exec();
    }

    return paginatedResponse;
  }

  // Saved Albums (with pagination)
  async getSavedAlbums(limit = 50, offset = 0, forceRefresh = false): Promise<PaginatedResponse<SavedAlbum>> {
    const key = this.getKey(`saved_albums:${limit}:${offset}`);
    
    if (!forceRefresh) {
      const cached = await this.getCachedData<PaginatedResponse<SavedAlbum>>(key);
      if (cached) return cached;
    }

    const response = await this.spotifyApi.getSavedAlbums(limit, offset);
    const paginatedResponse: PaginatedResponse<SavedAlbum> = {
      items: response.items,
      total: response.total,
      limit,
      offset,
      next: response.next,
      previous: response.previous
    };

    await this.setCachedData(key, paginatedResponse);

    // Store album IDs
    if (offset === 0) {
      const listKey = this.getKey('saved_albums_ids');
      const multi = this.redis.multi();
      multi.del(listKey);
      response.items.forEach((item: SavedAlbum) => {
        multi.rPush(listKey, item.album.id);
      });
      multi.expire(listKey, this.defaultTTL);
      await multi.exec();
    }

    return paginatedResponse;
  }

  // Recently Played
  async getRecentlyPlayed(forceRefresh = false): Promise<RecentlyPlayedItem[]> {
    const key = this.getKey('recently_played');
    
    if (!forceRefresh) {
      const cached = await this.getCachedData<RecentlyPlayedItem[]>(key);
      if (cached) return cached;
    }

    const items = await this.spotifyApi.getRecentlyPlayed();
    await this.setCachedData(key, items, 1800); // 30 minutes for recent tracks

    // Store in sorted set by timestamp
    const sortedKey = this.getKey('recently_played_sorted');
    const multi = this.redis.multi();
    multi.del(sortedKey);
    items.forEach((item: RecentlyPlayedItem) => {
      const timestamp = new Date(item.played_at).getTime();
      multi.zAdd(sortedKey, { score: timestamp, value: item.track.id });
    });
    multi.expire(sortedKey, 1800);
    await multi.exec();

    return items;
  }

  // Playlists
  async getPlaylists(forceRefresh = false): Promise<SpotifyPlaylist[]> {
    const key = this.getKey('playlists');
    
    if (!forceRefresh) {
      const cached = await this.getCachedData<SpotifyPlaylist[]>(key);
      if (cached) return cached;
    }

    const playlists = await this.spotifyApi.getPlaylists();
    await this.setCachedData(key, playlists);

    // Store playlist IDs in hash
    const hashKey = this.getKey('playlists_hash');
    const multi = this.redis.multi();
    multi.del(hashKey);
    playlists.forEach((playlist: SpotifyPlaylist) => {
      multi.hSet(hashKey, playlist.id, JSON.stringify({
        name: playlist.name,
        owner: playlist.owner.display_name,
        tracks: playlist.tracks.total
      }));
    });
    multi.expire(hashKey, this.defaultTTL);
    await multi.exec();

    return playlists;
  }

  // Get all dashboard data
  async getAllDashboardData(forceRefresh = false): Promise<UserDashboardData> {
    console.log(`🚀 Starting getAllDashboardData - forceRefresh: ${forceRefresh}, userId: ${this.userId}`);
    const startTime = Date.now();
    
    // Create promises with logging
    const profilePromise = this.getUserProfile(forceRefresh).then(result => {
      console.log(`✅ Profile fetched in ${Date.now() - startTime}ms`);
      return result;
    });
    
    const topArtistsShortPromise = this.getTopArtists('short_term', forceRefresh).then(result => {
      console.log(`✅ Top Artists (short_term) fetched in ${Date.now() - startTime}ms - ${result.length} artists`);
      return result;
    });
    
    const topArtistsMediumPromise = this.getTopArtists('medium_term', forceRefresh).then(result => {
      console.log(`✅ Top Artists (medium_term) fetched in ${Date.now() - startTime}ms - ${result.length} artists`);
      return result;
    });
    
    const topArtistsLongPromise = this.getTopArtists('long_term', forceRefresh).then(result => {
      console.log(`✅ Top Artists (long_term) fetched in ${Date.now() - startTime}ms - ${result.length} artists`);
      return result;
    });
    
    const topTracksShortPromise = this.getTopTracks('short_term', forceRefresh).then(result => {
      console.log(`✅ Top Tracks (short_term) fetched in ${Date.now() - startTime}ms - ${result.length} tracks`);
      return result;
    });
    
    const topTracksMediumPromise = this.getTopTracks('medium_term', forceRefresh).then(result => {
      console.log(`✅ Top Tracks (medium_term) fetched in ${Date.now() - startTime}ms - ${result.length} tracks`);
      return result;
    });
    
    const topTracksLongPromise = this.getTopTracks('long_term', forceRefresh).then(result => {
      console.log(`✅ Top Tracks (long_term) fetched in ${Date.now() - startTime}ms - ${result.length} tracks`);
      return result;
    });
    
    const savedTracksPromise = this.getSavedTracks(50, 0, forceRefresh).then(result => {
      console.log(`✅ Saved Tracks fetched in ${Date.now() - startTime}ms - ${result.total} total, ${result.items.length} returned`);
      return result;
    });
    
    const savedAlbumsPromise = this.getSavedAlbums(50, 0, forceRefresh).then(result => {
      console.log(`✅ Saved Albums fetched in ${Date.now() - startTime}ms - ${result.total} total, ${result.items.length} returned`);
      return result;
    });
    
    const recentlyPlayedPromise = this.getRecentlyPlayed(forceRefresh).then(result => {
      console.log(`✅ Recently Played fetched in ${Date.now() - startTime}ms - ${result.length} tracks`);
      return result;
    });
    
    const playlistsPromise = this.getPlaylists(forceRefresh).then(result => {
      console.log(`✅ Playlists fetched in ${Date.now() - startTime}ms - ${result.length} playlists`);
      return result;
    });

    console.log('⏳ Waiting for all promises to resolve...');
    
    // Fetch all data in parallel for better performance
    const [
      profile,
      topArtistsShort,
      topArtistsMedium,
      topArtistsLong,
      topTracksShort,
      topTracksMedium,
      topTracksLong,
      savedTracks,
      savedAlbums,
      recentlyPlayed,
      playlists
    ] = await Promise.all([
      profilePromise,
      topArtistsShortPromise,
      topArtistsMediumPromise,
      topArtistsLongPromise,
      topTracksShortPromise,
      topTracksMediumPromise,
      topTracksLongPromise,
      savedTracksPromise,
      savedAlbumsPromise,
      recentlyPlayedPromise,
      playlistsPromise
    ]);

    console.log(`🎉 All dashboard data fetched in ${Date.now() - startTime}ms`);

    return {
      profile,
      topArtists: {
        short_term: topArtistsShort,
        medium_term: topArtistsMedium,
        long_term: topArtistsLong
      },
      topTracks: {
        short_term: topTracksShort,
        medium_term: topTracksMedium,
        long_term: topTracksLong
      },
      savedTracks,
      savedAlbums,
      recentlyPlayed,
      playlists
    };
  }

  // Clear all cached data for user
  async clearCache(): Promise<void> {
    const pattern = this.getKey('*');
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  // AI Feedback methods
  async trackAIDiscovery(track: AIDiscoveredTrack): Promise<void> {
    try {
      const key = `user:${this.userId}:ai_pending`;
      const member = `${track.trackUri}|${track.trackName}|${track.artist}|${track.reasoning}`;
      await this.redis.zAdd(key, { score: track.discoveredAt, value: member });
      await this.redis.expire(key, 86400 * 30); // 30 days
    } catch (error) {
      console.error('Error tracking AI discovery:', error);
    }
  }

  async recordFeedback(trackUri: string, feedback: 'loved' | 'disliked'): Promise<void> {
    try {
      const discoveriesKey = `user:${this.userId}:ai_discoveries`;
      const lovedKey = `user:${this.userId}:ai_loved`;
      const dislikedKey = `user:${this.userId}:ai_disliked`;
      
      // Find the track in discoveries list
      const discoveries = await this.redis.lRange(discoveriesKey, 0, -1);
      const targetDiscovery = discoveries.find((discovery: string) => {
        try {
          const parsed = JSON.parse(discovery);
          // Try multiple matching strategies
          const decodedTrackUri = decodeURIComponent(trackUri);
          const trackUriMatch = parsed.trackUri === trackUri || parsed.trackUri === decodedTrackUri;
          const nameMatch = decodedTrackUri.includes(parsed.trackName) && decodedTrackUri.includes(parsed.artist);
          const exactMatch = trackUri.includes(encodeURIComponent(parsed.trackName)) && trackUri.includes(encodeURIComponent(parsed.artist));
          
          return trackUriMatch || nameMatch || exactMatch;
        } catch {
          return false;
        }
      });
      
      if (targetDiscovery) {
        const discoveryData = JSON.parse(targetDiscovery);
        
        // Remove any existing feedback for this track (to allow changing feedback)
        const [lovedMembers, dislikedMembers] = await Promise.all([
          this.redis.zRange(lovedKey, 0, -1),
          this.redis.zRange(dislikedKey, 0, -1)
        ]);
        
        const allFeedback = [...lovedMembers, ...dislikedMembers];
        const existingFeedback = allFeedback.find((member: string) => {
          try {
            const parsed = JSON.parse(member);
            return parsed.trackUri === trackUri || parsed.trackUri === discoveryData.trackUri;
          } catch {
            return false;
          }
        });
        
        if (existingFeedback) {
          // Remove existing feedback from both lists to allow changing mind
          await Promise.all([
            this.redis.zRem(lovedKey, existingFeedback),
            this.redis.zRem(dislikedKey, existingFeedback)
          ]);
          console.log(`🔄 Updating existing feedback for ${discoveryData.trackName} by ${discoveryData.artist}`);
        }
        
        // Add feedback info to discovery data
        discoveryData.feedback = feedback;
        discoveryData.feedbackAt = Date.now();
        
        // Add to appropriate feedback list  
        const targetKey = feedback === 'loved' ? lovedKey : dislikedKey;
        await this.redis.zAdd(targetKey, { score: Date.now(), value: JSON.stringify(discoveryData) });
        await this.redis.expire(targetKey, 86400 * 30); // 30 days
        
        // If the feedback is 'loved', add the track to DJ Forge playlist
        if (feedback === 'loved') {
          try {
            await this.addToJDForgePlaylist(discoveryData.trackUri);
            console.log(`🎵 Added loved track to DJ Forge playlist: ${discoveryData.trackName} by ${discoveryData.artist}`);
          } catch (error) {
            console.error(`⚠️ Failed to add track to DJ Forge playlist:`, error);
            // Don't fail the feedback recording if playlist addition fails
          }
        }
        
        console.log(`✅ Recorded ${feedback} feedback for ${discoveryData.trackName} by ${discoveryData.artist}`);
      } else {
        console.log(`⚠️ Track not found in discoveries: ${trackUri}`);
      }
    } catch (error) {
      console.error('Error recording feedback:', error);
    }
  }

  async removeFeedback(trackUri: string): Promise<void> {
    try {
      const lovedKey = `user:${this.userId}:ai_loved`;
      const dislikedKey = `user:${this.userId}:ai_disliked`;
      
      // Remove from feedback lists
      const [lovedMembers, dislikedMembers] = await Promise.all([
        this.redis.zRange(lovedKey, 0, -1),
        this.redis.zRange(dislikedKey, 0, -1)
      ]);
      
      const allMembers = [...lovedMembers, ...dislikedMembers];
      const targetMember = allMembers.find((member: string) => {
        try {
          const parsed = JSON.parse(member);
          return parsed.trackUri === trackUri || 
                 trackUri.includes(parsed.trackName) || 
                 trackUri.includes(parsed.artist);
        } catch {
          return member.startsWith(trackUri);
        }
      });
      
      if (targetMember) {
        await Promise.all([
          this.redis.zRem(lovedKey, targetMember),
          this.redis.zRem(dislikedKey, targetMember)
        ]);
      }
    } catch (error) {
      console.error('Error removing feedback:', error);
    }
  }

  async getAIFeedback(): Promise<{loved: AIDiscoveredTrack[], disliked: AIDiscoveredTrack[]}> {
    try {
      const lovedKey = `user:${this.userId}:ai_loved`;
      const dislikedKey = `user:${this.userId}:ai_disliked`;
      
      const [lovedMembers, dislikedMembers] = await Promise.all([
        this.redis.zRangeWithScores(lovedKey, 0, -1),
        this.redis.zRangeWithScores(dislikedKey, 0, -1)
      ]);
      
      const parseTrack = (member: string, score: number, feedback: 'loved' | 'disliked'): AIDiscoveredTrack | null => {
        try {
          // Try to parse as JSON first (new format)
          const trackData = JSON.parse(member);
          return {
            trackUri: trackData.trackUri,
            trackName: trackData.trackName,
            artist: trackData.artist,
            reasoning: trackData.reasoning || '',
            discoveredAt: trackData.discoveredAt || score,
            feedback,
            feedbackAt: trackData.feedbackAt || score,
            previewUrl: trackData.previewUrl
          };
        } catch {
          // Fall back to old pipe-separated format
          const [trackUri, trackName, artist, reasoning] = member.split('|');
          return {
            trackUri,
            trackName,
            artist,
            reasoning: reasoning || '',
            discoveredAt: score,
            feedback,
            feedbackAt: score
          };
        }
      };
      
      const loved = lovedMembers.map((item: any) => parseTrack(item.value, item.score, 'loved')).filter(Boolean) as AIDiscoveredTrack[];
      const disliked = dislikedMembers.map((item: any) => parseTrack(item.value, item.score, 'disliked')).filter(Boolean) as AIDiscoveredTrack[];
      
      return { loved, disliked };
    } catch (error) {
      console.error('Error getting AI feedback:', error);
      return { loved: [], disliked: [] };
    }
  }

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

  // DJ Forge playlist management
  async addToJDForgePlaylist(trackUri: string): Promise<void> {
    try {
      const playlistName = 'DJ Forge';
      const playlistDescription = 'AI-discovered tracks that you loved - curated by your personal DJ Forge assistant';
      
      // Ensure the DJ Forge playlist exists
      const playlist = await this.spotifyApi.ensurePlaylistExists(playlistName, playlistDescription);
      
      // Check if track is already in the playlist to avoid duplicates
      const existingTracks = await this.spotifyApi.getPlaylistTracks(playlist.id);
      const trackAlreadyExists = existingTracks.some((item: any) => 
        item.track && item.track.uri === trackUri
      );
      
      if (trackAlreadyExists) {
        console.log(`Track already exists in DJ Forge playlist: ${trackUri}`);
        return;
      }
      
      // Add the track to the playlist
      await this.spotifyApi.addTracksToPlaylist(playlist.id, [trackUri]);
      console.log(`✅ Successfully added track to DJ Forge playlist: ${trackUri}`);
      
    } catch (error) {
      console.error('Error adding track to DJ Forge playlist:', error);
      throw error;
    }
  }

  /**
   * Build contextual taste profile based on request type
   * Different request types get different emphasis and guidance
   */
  private buildContextualProfile(
    contextType: 'specific' | 'discovery' | 'conversational' | 'control' | 'info' | undefined,
    topGenres: string[],
    topArtistsMedium: any[],
    topTracksMedium: any[],
    aiFeedback: { loved: any[], disliked: any[] }
  ): string {
    const baseData = {
      genres: topGenres.length > 0 ? topGenres.join(', ') : 'varied genres',
      artists: topArtistsMedium.slice(0, 10).map(a => a.name).join(', ') || 'various artists',
      tracks: topTracksMedium.slice(0, 10).map(t => `${t.name} by ${t.artists.map((a: any) => a.name).join(', ')}`).join('; ') || 'varied tracks'
    };

    switch (contextType) {
      case 'specific':
        // For specific song requests - minimal taste context to avoid bias
        return `BACKGROUND - User's Musical Context (for reference only):
• Generally listens to: ${baseData.genres}
• Some familiar artists: ${baseData.artists}

IMPORTANT: The user is asking for a specific song. Use this context only to understand their general style, but focus on finding the exact song they requested. Don't substitute with something from their taste profile unless the specific song cannot be found.`;

      case 'discovery':
        // For discovery requests - rich taste context with discovery patterns
        let discoveryProfile = `BACKGROUND - User's Musical Discovery Context:
• Primary genres: ${baseData.genres}
• Familiar artists: ${baseData.artists}
• Recent favorites: ${baseData.tracks}`;

        // Add AI feedback with discovery emphasis
        if (aiFeedback.loved.length > 0 || aiFeedback.disliked.length > 0) {
          discoveryProfile += '\n\nPast Discovery Patterns:';
          
          if (aiFeedback.loved.length > 0) {
            discoveryProfile += `\n• Successful discoveries they loved: ${aiFeedback.loved.slice(0, 5).map(t => `${t.trackName} by ${t.artist}`).join('; ')}`;
          }
          
          if (aiFeedback.disliked.length > 0) {
            discoveryProfile += `\n• Discoveries that didn't connect: ${aiFeedback.disliked.slice(0, 3).map(t => `${t.trackName} by ${t.artist}`).join('; ')}`;
          }
        }

        discoveryProfile += `\n\nDISCOVERY GUIDANCE: Use this context to find music that expands their horizons while respecting their taste patterns. Look for adjacent artists, similar vibes, or evolution of their favorite genres. Avoid their exact favorites unless they fit perfectly.`;
        
        return discoveryProfile;

      case 'conversational':
        // For chat/questions - focus on knowledge and context
        return `BACKGROUND - User's Musical Knowledge Context:
• Interested in genres: ${baseData.genres}
• Listens to artists like: ${baseData.artists}
• Recent listening: ${baseData.tracks}

CONVERSATIONAL CONTEXT: This is for music discussion. Use this context to understand their perspective and provide relevant insights about artists, songs, or genres they might know or be interested in.`;

      case 'control':
        // For playback controls - minimal context needed
        return `BACKGROUND - Basic Musical Context:
• Generally enjoys: ${baseData.genres}

CONTROL CONTEXT: This is a playback control request. Music context is minimal and mainly for potential follow-up suggestions.`;

      case 'info':
        // For info requests - broader context for helpful responses
        return `BACKGROUND - User's Musical Library Context:
• Preferred genres: ${baseData.genres}
• Known artists: ${baseData.artists}
• Recent activity: ${baseData.tracks}

INFO CONTEXT: Use this context to provide relevant and personalized information responses about their music library, playlists, or suggestions.`;

      default:
        // Default general profile (backward compatibility)
        let generalProfile = `BACKGROUND - User's Musical Context (for inspiration, not limitation):
• Tends to enjoy genres like: ${baseData.genres}
• Often listens to artists such as: ${baseData.artists}
• Recent listening includes: ${baseData.tracks}

IMPORTANT: This context shows the user's general taste but you should feel free to recommend ANY artist that fits their request. Don't limit yourself to these artists - use this as inspiration to understand their style preferences.`;

        // Add AI feedback section if available
        if (aiFeedback.loved.length > 0 || aiFeedback.disliked.length > 0) {
          generalProfile += '\n\nPast AI Discovery Feedback (what worked/didn\'t work):';
          
          if (aiFeedback.loved.length > 0) {
            generalProfile += `\n• Loved these discoveries: ${aiFeedback.loved.map(t => `${t.trackName} by ${t.artist}`).join('; ')}`;
          }
          
          if (aiFeedback.disliked.length > 0) {
            generalProfile += `\n• Didn't connect with: ${aiFeedback.disliked.map(t => `${t.trackName} by ${t.artist}`).join('; ')}`;
          }
        }

        return generalProfile;
    }
  }
}