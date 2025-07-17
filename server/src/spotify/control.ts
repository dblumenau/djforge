import { Router } from 'express';
import { SpotifyWebAPI } from './api';
import { SpotifyAuthTokens, SpotifyTrack } from '../types';
import { ensureValidToken } from './auth';

export const controlRouter = Router();

// Helper to get WebAPI instance from request
const getWebAPI = (req: any): SpotifyWebAPI => {
  if (!req.spotifyTokens) {
    throw new Error('Not authenticated with Spotify');
  }
  
  return new SpotifyWebAPI(
    req.spotifyTokens,
    (tokens) => { req.spotifyTokens = tokens; }
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
        message: `Playing: ${track.name} by ${track.artists.map((a: { name: string }) => a.name).join(', ')}`,
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
        message: `Added to queue: ${track.name} by ${track.artists.map((a: { name: string }) => a.name).join(', ')}`,
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
      console.log(`[DEBUG] Playing playlist with URI: ${uri}`);
      await this.webAPI.playPlaylist(uri);
      return { success: true, message: 'Playing playlist' };
    } catch (error: any) {
      console.log(`[DEBUG] Playlist play failed: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async playPlaylistWithTracks(playlistId: string) {
    try {
      console.log(`[DEBUG] Playing playlist with tracks method for ID: ${playlistId}`);
      
      // Get all tracks from the playlist
      const tracksResponse = await this.getPlaylistTracks(playlistId);
      if (!tracksResponse.success || !tracksResponse.tracks) {
        return { success: false, message: "Couldn't get playlist tracks" };
      }

      const tracks = tracksResponse.tracks;
      if (tracks.length === 0) {
        return { success: false, message: "Playlist is empty" };
      }

      console.log(`[DEBUG] Found ${tracks.length} tracks in playlist`);

      // Play the first track
      const firstTrack = tracks[0];
      await this.webAPI.playTrack(firstTrack.uri);

      // Queue the rest of the tracks
      for (let i = 1; i < tracks.length; i++) {
        await this.webAPI.addToQueue(tracks[i].uri);
      }

      return { 
        success: true, 
        message: `Playing playlist with ${tracks.length} tracks`,
        tracksQueued: tracks.length - 1,
        playlistInfo: {
          totalTracks: tracks.length,
          method: 'manual_queue'
        }
      };
    } catch (error: any) {
      console.log(`[DEBUG] Playlist with tracks failed: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async queuePlaylist(playlistId: string) {
    try {
      console.log(`[DEBUG] Queuing playlist with ID: ${playlistId}`);
      
      // Get ALL tracks from the playlist directly from API (not limited to 20)
      const allTracks = await this.webAPI.getPlaylistTracks(playlistId);
      console.log(`[DEBUG] Got ${allTracks.length} tracks from playlist API`);
      
      if (allTracks.length === 0) {
        return { success: false, message: "Playlist is empty" };
      }
      
      // Only queue up to 10 tracks to avoid overwhelming the queue
      const tracksToQueue = allTracks.slice(0, 10);
      console.log(`[DEBUG] Queuing ${tracksToQueue.length} tracks from playlist (max 10)`);
      
      // Queue all tracks from the playlist
      for (let i = 0; i < tracksToQueue.length; i++) {
        const track = tracksToQueue[i].track || tracksToQueue[i];
        if (track && track.uri) {
          await this.webAPI.addToQueue(track.uri);
        }
      }
      
      return { 
        success: true, 
        message: `Queued ${tracksToQueue.length} tracks from playlist${allTracks.length > 10 ? ` (limited to 10 of ${allTracks.length})` : ''}`,
        tracksQueued: tracksToQueue.length,
        playlistInfo: {
          totalTracks: allTracks.length,
          method: 'queue_all'
        }
      };
    } catch (error: any) {
      console.log(`[DEBUG] Playlist queue failed: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async searchAndQueuePlaylist(query: string) {
    try {
      let playlists;
      
      // Special case for "random" - get user's playlists and pick one randomly
      if (query.toLowerCase().includes('random')) {
        const playlistsResponse = await this.getPlaylists();
        if (!playlistsResponse.success) {
          return { success: false, message: "Couldn't get your playlists" };
        }
        playlists = playlistsResponse.playlists;
        if (playlists.length === 0) {
          return { success: false, message: "You don't have any playlists" };
        }
        // Pick a random playlist
        const randomIndex = Math.floor(Math.random() * playlists.length);
        playlists = [playlists[randomIndex]];
      } else {
        // Search for playlists by name
        const rawPlaylists = await this.webAPI.search(query, ['playlist']);
        
        // Filter out null/invalid playlist entries
        playlists = rawPlaylists.filter(p => p && p.id && p.uri && (p.name || p.title));
        
        console.log(`[DEBUG] Raw playlists found: ${rawPlaylists.length}, Valid playlists: ${playlists.length}`);
        console.log(`[DEBUG] First playlist:`, playlists[0] ? JSON.stringify({
          name: playlists[0].name,
          id: playlists[0].id,
          uri: playlists[0].uri,
          tracks: playlists[0].tracks
        }, null, 2) : 'none');
        
        if (playlists.length === 0) {
          return { 
            success: false, 
            message: `No valid playlists found for: "${query}". Try searching for a playlist by name like "discover weekly" or "daily mix".`
          };
        }
      }

      // Queue the first result (or the random one)
      const playlist = playlists[0];
      console.log(`[DEBUG] Queuing playlist: ${playlist.name || playlist.title || 'Unknown'} (ID: ${playlist.id})`);
      
      // Handle different playlist object formats
      const playlistName = playlist.name || playlist.title || 'Unknown Playlist';
      const playlistId = playlist.id;
      
      if (!playlistId) {
        console.log(`[DEBUG] Invalid playlist object - missing ID`);
        return { success: false, message: "Found invalid playlist data" };
      }
      
      // Queue all tracks from the playlist
      const result = await this.queuePlaylist(playlistId);
      if (result.success) {
        return {
          ...result,
          message: `Queued playlist: ${playlistName} (${result.tracksQueued} tracks)`,
          playlist: {
            name: playlistName,
            id: playlistId,
            uri: playlist.uri,
            totalTracks: result.playlistInfo?.totalTracks
          },
          alternatives: playlists.slice(1, 3).map(p => ({ 
            name: p.name || p.title || 'Unknown', 
            id: p.id 
          }))
        };
      }
      
      return result;
    } catch (error: any) {
      return { success: false, message: `Playlist queue failed: ${error.message}` };
    }
  }

  async searchAndPlayPlaylist(query: string) {
    try {
      let playlists;
      
      // Special case for "random" - get user's playlists and pick one randomly
      if (query.toLowerCase().includes('random')) {
        const playlistsResponse = await this.getPlaylists();
        if (!playlistsResponse.success) {
          return { success: false, message: "Couldn't get your playlists" };
        }
        playlists = playlistsResponse.playlists;
        if (playlists.length === 0) {
          return { success: false, message: "You don't have any playlists" };
        }
        // Pick a random playlist
        const randomIndex = Math.floor(Math.random() * playlists.length);
        playlists = [playlists[randomIndex]];
      } else {
        // Search for playlists by name
        const rawPlaylists = await this.webAPI.search(query, ['playlist']);
        
        // Filter out null/invalid playlist entries
        playlists = rawPlaylists.filter(p => p && p.id && p.uri && (p.name || p.title));
        
        console.log(`[DEBUG] Raw playlists found: ${rawPlaylists.length}, Valid playlists: ${playlists.length}`);
        
        if (playlists.length === 0) {
          return { 
            success: false, 
            message: `No valid playlists found for: "${query}". Try searching for a playlist by name like "discover weekly" or "daily mix".`
          };
        }
      }

      // Play the first result (or the random one)
      const playlist = playlists[0];
      console.log(`[DEBUG] Playlist object:`, JSON.stringify(playlist, null, 2));
      
      // Handle different playlist object formats
      const playlistName = playlist.name || playlist.title || 'Unknown Playlist';
      const playlistId = playlist.id;
      const playlistUri = playlist.uri;
      
      if (!playlistId || !playlistUri) {
        console.log(`[DEBUG] Invalid playlist object - missing ID or URI`);
        return { success: false, message: "Found invalid playlist data" };
      }
      
      console.log(`[DEBUG] Found playlist: ${playlistName} (ID: ${playlistId})`);
      
      // Try the robust method first (manually queue all tracks)
      const result = await this.playPlaylistWithTracks(playlistId);
      if (result.success) {
        return {
          ...result,
          message: `Playing playlist: ${playlistName} (${(result.tracksQueued || 0) + 1} tracks)`,
          playlist: {
            name: playlistName,
            id: playlistId,
            uri: playlistUri,
            totalTracks: result.playlistInfo?.totalTracks
          },
          alternatives: playlists.slice(1, 3).map(p => ({ 
            name: p.name || p.title || 'Unknown', 
            id: p.id 
          }))
        };
      }
      
      // Fallback to context_uri method
      console.log(`[DEBUG] Fallback to context_uri method for ${playlistName}`);
      await this.webAPI.playPlaylist(playlistUri);
      
      return { 
        success: true, 
        message: `Playing playlist: ${playlistName} (via context)`,
        playlist: {
          name: playlistName,
          id: playlistId,
          uri: playlistUri,
          method: 'context_uri'
        },
        alternatives: playlists.slice(1, 3).map(p => ({ 
          name: p.name || p.title || 'Unknown', 
          id: p.id 
        }))
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
          artists: t.artists.map((a: { name: string }) => a.name).join(', '),
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
        tracks: tracks.slice(0, 20).map((t: SpotifyTrack) => ({
          name: t.name,
          artists: t.artists.map((a: { name: string }) => a.name).join(', '),
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
        tracks: tracks.slice(0, 20).map((t: SpotifyTrack) => ({
          name: t.name,
          artists: t.artists.map((a: { name: string }) => a.name).join(', '),
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

  async clearQueue() {
    try {
      console.log(`[DEBUG] Clearing queue`);
      await this.webAPI.clearQueue();
      return { 
        success: true, 
        message: 'Queue cleared - only current track remains' 
      };
    } catch (error: any) {
      console.log(`[DEBUG] Clear queue failed: ${error.message}`);
      return { success: false, message: `Failed to clear queue: ${error.message}` };
    }
  }

  async getUserProfile(): Promise<any> {
    try {
      const profile = await this.webAPI.getUserProfile();
      return profile;
    } catch (error: any) {
      console.error('Failed to get user profile:', error);
      throw error;
    }
  }
}

// All endpoints now use ensureValidToken from auth.ts

// Basic playback controls using Web API
controlRouter.post('/play', ensureValidToken, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.play(req.body.deviceId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/pause', ensureValidToken, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.pause();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/next', ensureValidToken, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.nextTrack();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/previous', ensureValidToken, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.previousTrack();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Volume control
controlRouter.post('/volume', ensureValidToken, async (req, res) => {
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

controlRouter.get('/volume', ensureValidToken, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    const volume = await webAPI.getVolume();
    res.json({ volume });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current playback state
controlRouter.get('/current', ensureValidToken, async (req, res) => {
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
controlRouter.post('/shuffle', ensureValidToken, async (req, res) => {
  const { enabled } = req.body;
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.setShuffle(enabled);
    res.json({ success: true, shuffling: enabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/repeat', ensureValidToken, async (req, res) => {
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
controlRouter.get('/devices', ensureValidToken, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    const devices = await webAPI.getDevices();
    res.json({ devices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer playback to a specific device
controlRouter.post('/transfer', ensureValidToken, async (req, res) => {
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
controlRouter.post('/play-uri', ensureValidToken, async (req, res) => {
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
controlRouter.get('/search', ensureValidToken, async (req, res) => {
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
controlRouter.post('/queue', ensureValidToken, async (req, res) => {
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
controlRouter.post('/seek', ensureValidToken, async (req, res) => {
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