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
}