import axios, { AxiosInstance } from 'axios';
import { SpotifyAuthTokens, SpotifyTrack } from '../types';
import { refreshAccessToken } from './auth';

export class SpotifyWebAPI {
  private api: AxiosInstance;
  private tokens: SpotifyAuthTokens;
  private onTokenRefresh: (tokens: SpotifyAuthTokens) => void;

  constructor(
    tokens: SpotifyAuthTokens,
    onTokenRefresh: (tokens: SpotifyAuthTokens) => void
  ) {
    this.tokens = tokens;
    this.onTokenRefresh = onTokenRefresh;
    
    this.api = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    // Add response interceptor for token refresh
    this.api.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401 && this.tokens.refresh_token) {
          try {
            const newTokens = await refreshAccessToken(this.tokens.refresh_token);
            this.tokens = { ...this.tokens, ...newTokens };
            this.onTokenRefresh(this.tokens);
            
            // Retry original request with new token
            error.config.headers['Authorization'] = `Bearer ${newTokens.access_token}`;
            return this.api.request(error.config);
          } catch (refreshError) {
            throw refreshError;
          }
        }
        throw error;
      }
    );
  }

  async search(query: string, types: string[] = ['track']): Promise<SpotifyTrack[]> {
    const response = await this.api.get('/search', {
      params: {
        q: query,
        type: types.join(','),
        limit: 10
      }
    });

    return response.data.tracks?.items || [];
  }

  async getRecommendations(trackId: string): Promise<SpotifyTrack[]> {
    const response = await this.api.get('/recommendations', {
      params: {
        seed_tracks: trackId,
        limit: 20
      }
    });

    return response.data.tracks || [];
  }

  async getCurrentPlayback() {
    const response = await this.api.get('/me/player');
    return response.data;
  }

  async getDevices() {
    const response = await this.api.get('/me/player/devices');
    return response.data.devices || [];
  }

  async addToQueue(uri: string) {
    await this.api.post('/me/player/queue', null, {
      params: { uri }
    });
  }

  async getPlaylists() {
    const response = await this.api.get('/me/playlists', {
      params: { limit: 50 }
    });
    return response.data.items || [];
  }

  async getPlaylistTracks(playlistId: string) {
    const response = await this.api.get(`/playlists/${playlistId}/tracks`, {
      params: { limit: 100 }
    });
    return response.data.items || [];
  }

  async getRecentlyPlayed() {
    const response = await this.api.get('/me/player/recently-played', {
      params: { limit: 50 }
    });
    return response.data.items || [];
  }
}