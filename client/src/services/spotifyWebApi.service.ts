import { authService } from './auth.service';

class SpotifyWebApiService {
  private static instance: SpotifyWebApiService;

  private constructor() {}

  static getInstance(): SpotifyWebApiService {
    if (!SpotifyWebApiService.instance) {
      SpotifyWebApiService.instance = new SpotifyWebApiService();
    }
    return SpotifyWebApiService.instance;
  }

  // Shuffle control
  async setShuffle(state: boolean, deviceId?: string): Promise<void> {
    const params = new URLSearchParams({ state: state.toString() });
    if (deviceId) {
      params.append('device_id', deviceId);
    }

    const response = await fetch(`https://api.spotify.com/v1/me/player/shuffle?${params}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${await authService.getAccessToken()}`
      }
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to set shuffle: ${response.status}`);
    }
  }

  // Repeat control
  async setRepeat(state: 'track' | 'context' | 'off', deviceId?: string): Promise<void> {
    const params = new URLSearchParams({ state });
    if (deviceId) {
      params.append('device_id', deviceId);
    }

    const response = await fetch(`https://api.spotify.com/v1/me/player/repeat?${params}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${await authService.getAccessToken()}`
      }
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to set repeat: ${response.status}`);
    }
  }

  // Add to queue
  async addToQueue(uri: string, deviceId?: string): Promise<void> {
    const params = new URLSearchParams({ uri });
    if (deviceId) {
      params.append('device_id', deviceId);
    }

    const response = await fetch(`https://api.spotify.com/v1/me/player/queue?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await authService.getAccessToken()}`
      }
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to add to queue: ${response.status}`);
    }
  }

  // Get all devices
  async getDevices(): Promise<any> {
    const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: {
        'Authorization': `Bearer ${await authService.getAccessToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get devices: ${response.status}`);
    }

    return response.json();
  }

  // Get current playback
  async getCurrentPlayback(): Promise<any> {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: {
        'Authorization': `Bearer ${await authService.getAccessToken()}`
      }
    });

    if (response.status === 204) {
      return null; // No active playback
    }

    if (!response.ok) {
      throw new Error(`Failed to get current playback: ${response.status}`);
    }

    return response.json();
  }

  // Transfer playback to a specific device
  async transferPlayback(deviceIds: string[], play = false): Promise<void> {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${await authService.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        device_ids: deviceIds,
        play
      })
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to transfer playback: ${response.status}`);
    }
  }

  // Play specific context (album, playlist, etc.)
  async playContext(
    contextUri: string, 
    deviceId?: string, 
    offset?: { position?: number; uri?: string }
  ): Promise<void> {
    const body: any = { context_uri: contextUri };
    if (offset) {
      body.offset = offset;
    }

    const url = deviceId 
      ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
      : 'https://api.spotify.com/v1/me/player/play';

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${await authService.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to play context: ${response.status}`);
    }
  }

  // Play specific tracks
  async playTracks(trackUris: string[], deviceId?: string, offset?: number): Promise<void> {
    const body: any = { uris: trackUris };
    if (offset !== undefined) {
      body.offset = { position: offset };
    }

    const url = deviceId 
      ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
      : 'https://api.spotify.com/v1/me/player/play';

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${await authService.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to play tracks: ${response.status}`);
    }
  }
}

export const spotifyWebApiService = SpotifyWebApiService.getInstance();