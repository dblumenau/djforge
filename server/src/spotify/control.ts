import { Router } from 'express';
import { SpotifyWebAPI } from './api';
import { SpotifyAuthTokens } from '../types';

export const controlRouter = Router();

// Helper to get WebAPI instance from session
const getWebAPI = (req: any): SpotifyWebAPI => {
  if (!req.session.spotifyTokens) {
    throw new Error('Not authenticated with Spotify');
  }
  
  return new SpotifyWebAPI(
    req.session.spotifyTokens,
    (tokens) => { req.session.spotifyTokens = tokens; }
  );
};

// SpotifyControl class for use by interpreter
export class SpotifyControl {
  private webAPI: SpotifyWebAPI;

  constructor(tokens: SpotifyAuthTokens, onTokenRefresh: (tokens: SpotifyAuthTokens) => void) {
    this.webAPI = new SpotifyWebAPI(tokens, onTokenRefresh);
  }

  async play() {
    try {
      await this.webAPI.play();
      return { success: true, message: 'Playing' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async pause() {
    try {
      await this.webAPI.pause();
      return { success: true, message: 'Paused' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async skip() {
    try {
      await this.webAPI.nextTrack();
      return { success: true, message: 'Skipped to next track' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async previous() {
    try {
      await this.webAPI.previousTrack();
      return { success: true, message: 'Went to previous track' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async setVolume(level: number) {
    try {
      await this.webAPI.setVolume(level);
      return { success: true, message: `Volume set to ${level}` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async getCurrentTrack() {
    try {
      const playback = await this.webAPI.getCurrentPlayback();
      if (!playback || !playback.item) {
        return { 
          success: true, 
          message: 'No track playing',
          track: null 
        };
      }
      
      const track = playback.item;
      return { 
        success: true, 
        message: `Now playing: ${track.name} by ${track.artists.map((a: any) => a.name).join(', ')}`,
        track: {
          name: track.name,
          artist: track.artists.map((a: any) => a.name).join(', '),
          album: track.album.name,
          duration: Math.floor(track.duration_ms / 1000),
          position: Math.floor(playback.progress_ms / 1000),
          id: track.id
        }
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async searchAndPlay(query: string) {
    try {
      // Search for tracks
      const tracks = await this.webAPI.search(query);
      
      if (tracks.length === 0) {
        return { success: false, message: `No tracks found for: "${query}"` };
      }

      // Play the first result
      const track = tracks[0];
      await this.webAPI.playTrack(track.uri);
      
      return { 
        success: true, 
        message: `Playing: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`,
        track,
        alternatives: tracks.slice(1, 5) // Return other options
      };
    } catch (error: any) {
      return { success: false, message: `Search failed: ${error.message}` };
    }
  }

  async queueTrack(query: string) {
    try {
      // Search for tracks
      const tracks = await this.webAPI.search(query);
      
      if (tracks.length === 0) {
        return { success: false, message: `No tracks found for: "${query}"` };
      }

      // Queue the first result
      const track = tracks[0];
      await this.webAPI.addToQueue(track.uri);
      
      return { 
        success: true, 
        message: `Added to queue: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`,
        track
      };
    } catch (error: any) {
      return { success: false, message: `Queue failed: ${error.message}` };
    }
  }

  async search(query: string) {
    return this.webAPI.search(query);
  }

  async playTrack(uri: string) {
    return this.webAPI.playTrack(uri);
  }

  async playPlaylist(uri: string) {
    try {
      await this.webAPI.playPlaylist(uri);
      return { success: true, message: 'Playing playlist' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async searchAndPlayPlaylist(query: string) {
    try {
      // Search for playlists
      const playlists = await this.webAPI.search(query, ['playlist']);
      
      if (playlists.length === 0) {
        return { success: false, message: `No playlists found for: "${query}"` };
      }

      // Play the first result
      const playlist = playlists[0];
      await this.webAPI.playPlaylist(playlist.uri);
      
      return { 
        success: true, 
        message: `Playing playlist: ${playlist.name}`,
        playlist,
        alternatives: playlists.slice(1, 3) // Return other options
      };
    } catch (error: any) {
      return { success: false, message: `Playlist search failed: ${error.message}` };
    }
  }

  async queueTrackByUri(uri: string) {
    await this.webAPI.addToQueue(uri);
    return { success: true };
  }

  async setShuffle(enabled: boolean) {
    try {
      await this.webAPI.setShuffle(enabled);
      return { success: true, message: `Shuffle ${enabled ? 'enabled' : 'disabled'}` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async setRepeat(enabled: boolean) {
    try {
      await this.webAPI.setRepeat(enabled ? 'context' : 'off');
      return { success: true, message: `Repeat ${enabled ? 'enabled' : 'disabled'}` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async getDevices() {
    try {
      const devices = await this.webAPI.getDevices();
      return { success: true, devices };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async getRecommendations(trackId: string) {
    try {
      const tracks = await this.webAPI.getRecommendations(trackId);
      return { 
        success: true, 
        message: `Found ${tracks.length} recommendations`,
        tracks: tracks.slice(0, 10).map(t => ({
          name: t.name,
          artists: t.artists.map(a => a.name).join(', '),
          album: t.album.name,
          popularity: t.popularity,
          uri: t.uri
        }))
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async getPlaylists() {
    try {
      const playlists = await this.webAPI.getPlaylists();
      return { success: true, playlists };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async getPlaylistTracks(playlistId: string) {
    try {
      const tracks = await this.webAPI.getPlaylistTracks(playlistId);
      return { 
        success: true, 
        message: `Found ${tracks.length} tracks in playlist`,
        tracks: tracks.slice(0, 20).map(t => ({
          name: t.name,
          artists: t.artists.map(a => a.name).join(', '),
          album: t.album.name,
          uri: t.uri
        }))
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async getRecentlyPlayed() {
    try {
      const tracks = await this.webAPI.getRecentlyPlayed();
      return { 
        success: true, 
        message: `Found ${tracks.length} recently played tracks`,
        tracks: tracks.slice(0, 20).map(t => ({
          name: t.name,
          artists: t.artists.map(a => a.name).join(', '),
          album: t.album.name,
          uri: t.uri
        }))
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async transferPlayback(deviceId: string, play: boolean = true) {
    try {
      await this.webAPI.transferPlayback(deviceId, play);
      return { success: true, message: `Playback transferred to device` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async seekToPosition(positionSeconds: number) {
    try {
      await this.webAPI.seekToPosition(positionSeconds * 1000); // Convert to milliseconds
      return { success: true, message: `Seeked to ${positionSeconds} seconds` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session.spotifyTokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Basic playback controls using Web API
controlRouter.post('/play', requireAuth, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.play(req.body.deviceId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/pause', requireAuth, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.pause();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/next', requireAuth, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.nextTrack();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/previous', requireAuth, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.previousTrack();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Volume control
controlRouter.post('/volume', requireAuth, async (req, res) => {
  const { volume, deviceId } = req.body;
  
  if (typeof volume !== 'number' || volume < 0 || volume > 100) {
    return res.status(400).json({ error: 'Volume must be between 0 and 100' });
  }
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.setVolume(volume, deviceId);
    res.json({ success: true, volume });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.get('/volume', requireAuth, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    const volume = await webAPI.getVolume();
    res.json({ volume });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current playback state
controlRouter.get('/current', requireAuth, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    const playback = await webAPI.getCurrentPlayback();
    
    if (!playback) {
      return res.json({
        isRunning: false,
        state: 'stopped',
        track: null
      });
    }
    
    res.json({
      isRunning: true,
      state: playback.is_playing ? 'playing' : 'paused',
      track: playback.item ? {
        name: playback.item.name,
        artist: playback.item.artists.map((a: any) => a.name).join(', '),
        album: playback.item.album.name,
        duration: Math.floor(playback.item.duration_ms / 1000),
        position: Math.floor(playback.progress_ms / 1000),
        id: playback.item.id
      } : null,
      device: playback.device,
      shuffleState: playback.shuffle_state,
      repeatState: playback.repeat_state
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Shuffle and repeat controls
controlRouter.post('/shuffle', requireAuth, async (req, res) => {
  const { enabled } = req.body;
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.setShuffle(enabled);
    res.json({ success: true, shuffling: enabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/repeat', requireAuth, async (req, res) => {
  const { enabled, mode } = req.body;
  
  try {
    const webAPI = getWebAPI(req);
    // If mode is provided, use it directly. Otherwise, use boolean for backward compatibility
    const repeatMode = mode || (enabled ? 'context' : 'off');
    await webAPI.setRepeat(repeatMode);
    res.json({ success: true, repeating: repeatMode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get available devices
controlRouter.get('/devices', requireAuth, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    const devices = await webAPI.getDevices();
    res.json({ devices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer playback to a specific device
controlRouter.post('/transfer', requireAuth, async (req, res) => {
  const { deviceId, play } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID required' });
  }
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.transferPlayback(deviceId, play);
    res.json({ success: true, message: 'Playback transferred' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Play specific track (requires Web API search first)
controlRouter.post('/play-uri', requireAuth, async (req, res) => {
  const { uri, deviceId } = req.body;
  
  if (!uri || typeof uri !== 'string') {
    return res.status(400).json({ error: 'Spotify URI required' });
  }
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.playTrack(uri, deviceId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search for tracks
controlRouter.get('/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query required' });
  }
  
  try {
    const webAPI = getWebAPI(req);
    const tracks = await webAPI.search(q);
    res.json({ tracks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Queue a track
controlRouter.post('/queue', requireAuth, async (req, res) => {
  const { uri } = req.body;
  
  if (!uri || typeof uri !== 'string') {
    return res.status(400).json({ error: 'Spotify URI required' });
  }
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.addToQueue(uri);
    res.json({ success: true, message: 'Track added to queue' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Seek to position
controlRouter.post('/seek', requireAuth, async (req, res) => {
  const { position } = req.body;
  
  if (typeof position !== 'number' || position < 0) {
    return res.status(400).json({ error: 'Position must be a positive number (in seconds)' });
  }
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.seekToPosition(position * 1000); // Convert to milliseconds
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});