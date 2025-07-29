import { authService } from './auth.service';
import { apiEndpoint } from '../config/api';

export class SpotifyClient {
  // Direct Spotify API call (for high-frequency endpoints)
  async spotifyRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await authService.getAccessToken();
    
    try {
      const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (response.status === 401) {
        // Token expired, force refresh and retry
        const newToken = await authService.getAccessToken();
        
        // Retry with new token
        return fetch(`https://api.spotify.com/v1${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }
  
  // Server API call (for proxied endpoints)
  async serverRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const sessionId = authService.getSessionId();
    
    if (!sessionId) {
      throw new Error('No active session');
    }
    
    return fetch(apiEndpoint(`/api${endpoint}`), {
      ...options,
      credentials: 'include',
      headers: {
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }
  
  // High-frequency direct calls
  async getCurrentPlayback() {
    const response = await this.spotifyRequest('/me/player');
    return response.status === 204 ? null : response.json();
  }
  
  async getDevices() {
    const response = await this.spotifyRequest('/me/player/devices');
    return response.json();
  }
  
  async getQueue() {
    const response = await this.spotifyRequest('/me/player/queue');
    return response.json();
  }
  
  // Server-proxied calls
  async sendCommand(command: string) {
    const response = await this.serverRequest('/llm/command', {
      method: 'POST',
      body: JSON.stringify({ command })
    });
    return response.json();
  }
  
  async play() {
    const response = await this.serverRequest('/control/play', {
      method: 'POST'
    });
    return response.json();
  }
  
  async pause() {
    const response = await this.serverRequest('/control/pause', {
      method: 'POST'
    });
    return response.json();
  }
  
  async queueTrack(uri: string) {
    const response = await this.serverRequest('/control/queue', {
      method: 'POST',
      body: JSON.stringify({ uri })
    });
    return response.json();
  }
}

export const spotifyClient = new SpotifyClient();