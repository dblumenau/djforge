import { Router } from 'express';
import { SpotifyWebAPI } from './api';
import { SpotifyAuthTokens, SpotifyTrack } from '../types';
import { requireValidTokens } from '../middleware/session-auth';
import { logDebugError } from '../utils/error-logger';
import { logger } from '../config/logger';

export const controlRouter = Router();

// Helper to get WebAPI instance from request
const getWebAPI = (req: any): SpotifyWebAPI => {
  if (!req.tokens) {
    throw new Error('Not authenticated with Spotify');
  }
  
  return new SpotifyWebAPI(
    req.tokens,
    (tokens) => { req.tokens = tokens; }
  );
};

// SpotifyControl class for use by interpreter
export class SpotifyControl {
  private webAPI: SpotifyWebAPI;

  constructor(tokens: SpotifyAuthTokens, onTokenRefresh: (tokens: SpotifyAuthTokens) => void) {
    this.webAPI = new SpotifyWebAPI(tokens, onTokenRefresh);
  }

  // Getter to access the SpotifyWebAPI instance (needed for UserDataService)
  getApi(): SpotifyWebAPI {
    return this.webAPI;
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
          artists: track.artists.map((a: any) => ({
            name: a.name,
            id: a.id,
            uri: a.uri,
            external_urls: a.external_urls
          })),
          album: track.album.name,
          albumId: track.album.id,
          albumUri: track.album.uri,
          albumArt: track.album.images?.[0]?.url || null,
          releaseDate: track.album.release_date,
          duration: Math.floor(track.duration_ms / 1000),
          position: Math.floor(playback.progress_ms / 1000),
          id: track.id,
          uri: track.uri,
          external_urls: track.external_urls,
          popularity: track.popularity,
          preview_url: track.preview_url,
          track_number: track.track_number,
          disc_number: track.disc_number
        }
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async searchAndPlay(query: string, artist?: string, track?: string, album?: string) {
    try {
      // Search for tracks with retry logic
      const { tracks, retryLevel } = await this.searchWithRetry(query, artist, track, album);
      
      if (tracks.length === 0) {
        return { success: false, message: `No tracks found for: "${query}"` };
      }

      // Play the first result
      const selectedTrack = tracks[0];
      await this.webAPI.playTrack(selectedTrack.uri);
      
      // Customize message based on retry level to clearly explain what happened
      let message = '';
      switch (retryLevel) {
        case 0:
          message = `Playing: ${selectedTrack.name} by ${selectedTrack.artists.map((a: { name: string }) => a.name).join(', ')}`;
          break;
        case 1:
          // Check if we found the exact requested track even though we had to retry without album
          const foundExactTrack = artist && track && 
            selectedTrack.artists.some((a: { name: string }) => a.name.toLowerCase() === artist.toLowerCase()) &&
            selectedTrack.name.toLowerCase() === track.toLowerCase();
          
          if (foundExactTrack) {
            // We found the exact song, just had to search without album (likely due to special characters)
            message = `Playing: ${selectedTrack.name} by ${selectedTrack.artists.map((a: { name: string }) => a.name).join(', ')}`;
          } else {
            // We actually found a different song
            message = `The exact song wasn't found on Spotify, so I'm playing: ${selectedTrack.name} by ${selectedTrack.artists.map((a: { name: string }) => a.name).join(', ')} instead`;
          }
          break;
        case 2:
          message = `The requested song doesn't exist on Spotify, so I found the closest match: ${selectedTrack.name} by ${selectedTrack.artists.map((a: { name: string }) => a.name).join(', ')}`;
          break;
      }
      
      return { 
        success: true, 
        message,
        track: selectedTrack,
        alternatives: tracks.slice(1, 5).map(t => ({
          name: t.name,
          artists: t.artists.map((a: { name: string }) => a.name).join(', '),
          album: t.album.name,
          popularity: t.popularity,
          uri: t.uri
        })), // Return cleaned alternatives
        retryLevel
      };
    } catch (error: any) {
      return { success: false, message: `Search failed: ${error.message}` };
    }
  }

  async queueTrack(query: string, artist?: string, track?: string, album?: string) {
    try {
      // Search for tracks with retry logic
      const { tracks, retryLevel } = await this.searchWithRetry(query, artist, track, album);
      
      if (tracks.length === 0) {
        return { success: false, message: `No tracks found for: "${query}"` };
      }

      // Queue the first result
      const selectedTrack = tracks[0];
      await this.webAPI.addToQueue(selectedTrack.uri);
      
      // Customize message based on retry level to clearly explain what happened
      let message = '';
      switch (retryLevel) {
        case 0:
          message = `Added to queue: ${selectedTrack.name} by ${selectedTrack.artists.map((a: { name: string }) => a.name).join(', ')}`;
          break;
        case 1:
          // Check if we found the exact requested track even though we had to retry without album
          const foundExactTrack = artist && track && 
            selectedTrack.artists.some((a: { name: string }) => a.name.toLowerCase() === artist.toLowerCase()) &&
            selectedTrack.name.toLowerCase() === track.toLowerCase();
          
          if (foundExactTrack) {
            // We found the exact song, just had to search without album (likely due to special characters)
            message = `Added to queue: ${selectedTrack.name} by ${selectedTrack.artists.map((a: { name: string }) => a.name).join(', ')}`;
          } else {
            // We actually found a different song
            message = `The exact song wasn't found on Spotify, so I added to queue: ${selectedTrack.name} by ${selectedTrack.artists.map((a: { name: string }) => a.name).join(', ')} instead`;
          }
          break;
        case 2:
          message = `The requested song doesn't exist on Spotify, so I found the closest match and added to queue: ${selectedTrack.name} by ${selectedTrack.artists.map((a: { name: string }) => a.name).join(', ')}`;
          break;
      }
      
      return { 
        success: true, 
        message,
        track: selectedTrack,
        retryLevel
      };
    } catch (error: any) {
      return { success: false, message: `Queue failed: ${error.message}` };
    }
  }

  async search(query: string) {
    return this.webAPI.search(query);
  }

  async searchWithRetry(query: string, artist?: string, track?: string, album?: string): Promise<{ tracks: SpotifyTrack[], retryLevel: number }> {
    // Attempt 1: Full precision search
    console.log(`[DEBUG] Attempt 1 - Full search: ${query}`);
    console.log(`[DEBUG] Search params - Artist: "${artist}", Track: "${track}", Album: "${album}"`);
    let tracks = await this.webAPI.search(query);
    console.log(`[DEBUG] Attempt 1 found ${tracks.length} tracks`);
    
    if (tracks.length > 0) {
      return { tracks, retryLevel: 0 };
    }
    
    // Attempt 2: Without album
    if (tracks.length === 0 && artist && track) {
      const queryWithoutAlbum = `artist:"${artist}" track:"${track}"`;
      console.log(`[DEBUG] Attempt 2 - Retry without album: ${queryWithoutAlbum}`);
      tracks = await this.webAPI.search(queryWithoutAlbum);
      
      if (tracks.length > 0) {
        return { tracks, retryLevel: 1 };
      }
    }
    
    // Attempt 3: Just track name (YOLO mode)
    if (tracks.length === 0 && track) {
      console.log(`[DEBUG] Attempt 3 - YOLO mode with just track: ${track}`);
      tracks = await this.webAPI.search(track);
      
      if (tracks.length > 0) {
        return { tracks, retryLevel: 2 };
      }
    }
    
    return { tracks: [], retryLevel: -1 };
  }

  async playTrack(uri: string) {
    return this.webAPI.playTrack(uri);
  }
  
  async playTracks(uris: string[]) {
    try {
      const deviceId = await this.webAPI.ensureDeviceId();
      
      // First, try to transfer playback to ensure device is active
      try {
        await this.webAPI.transferPlayback(deviceId, false); // Don't auto-play during transfer
        // Small delay to ensure transfer completes
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (transferError: any) {
        console.log('Transfer playback attempt failed (device might already be active):', transferError.message);
      }
      
      // Now play the tracks
      await this.webAPI.playTracksWithUris(uris, deviceId);
      return { success: true, message: `Started playing ${uris.length} tracks` };
    } catch (error: any) {
      console.error('Failed to play tracks:', error);
      return { success: false, message: error.message || 'Failed to play tracks' };
    }
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
    try {
      // First check if there's an active device
      const devices = await this.webAPI.getDevices();
      const activeDevice = devices.find((d: any) => d.is_active);
      
      if (!activeDevice && devices.length > 0) {
        // No active device, but devices exist - activate the first one
        console.log('[DEBUG] No active device found, activating first available device');
        await this.webAPI.transferPlayback(devices[0].id, false); // Don't start playing immediately
        
        // Small delay to let the device activation take effect
        await new Promise(resolve => setTimeout(resolve, 500));
      } else if (devices.length === 0) {
        throw new Error('No Spotify devices found. Please open Spotify on a device.');
      }
      
      await this.webAPI.addToQueue(uri);
      return { success: true };
    } catch (error: any) {
      logDebugError('Queue operation failed', error);
      
      // Check if it's a "no active device" error
      if (error.response?.status === 404) {
        const errorData = error.response?.data?.error;
        if (errorData?.reason === 'NO_ACTIVE_DEVICE') {
          return { 
            success: false, 
            message: 'No active Spotify device found. Please start playing something on Spotify first.' 
          };
        }
      }
      
      return { 
        success: false, 
        message: error.message || 'Failed to add track to queue' 
      };
    }
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
      const currentDevice = await this.webAPI.getCurrentDevice();
      return { success: true, devices, currentDevice };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
  
  async setDevicePreference(preference: 'auto' | string) {
    try {
      this.webAPI.setDevicePreference(preference);
      return { success: true, message: `Device preference set to: ${preference}` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
  
  async transferPlayback(deviceId: string, play: boolean = false) {
    try {
      await this.webAPI.transferPlayback(deviceId, play);
      return { success: true, message: `Playback transferred to device: ${deviceId}` };
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

  async getQueue() {
    try {
      console.log(`[DEBUG] Getting queue`);
      const queue = await this.webAPI.getQueue();
      return { 
        success: true, 
        queue 
      };
    } catch (error: any) {
      console.log(`[DEBUG] Get queue failed: ${error.message}`);
      return { success: false, message: `Failed to get queue: ${error.message}` };
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

  // Library management methods
  async saveToLibrary(trackIds: string[]) {
    try {
      await this.webAPI.saveTracksToLibrary(trackIds);
      return { 
        success: true, 
        message: `Added ${trackIds.length} track${trackIds.length > 1 ? 's' : ''} to your library` 
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async removeFromLibrary(trackIds: string[]) {
    try {
      await this.webAPI.removeTracksFromLibrary(trackIds);
      return { 
        success: true, 
        message: `Removed ${trackIds.length} track${trackIds.length > 1 ? 's' : ''} from your library` 
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async checkIfSaved(trackIds: string[]) {
    try {
      const savedStatus = await this.webAPI.checkIfTracksSaved(trackIds);
      return { 
        success: true, 
        savedStatus // Array of booleans matching the order of trackIds
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

// All endpoints now use requireValidTokens from middleware/temp-auth.ts

// Basic playback controls using Web API
controlRouter.post('/play', requireValidTokens, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.play(req.body.deviceId);
    
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/pause', requireValidTokens, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.pause();
    
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/next', requireValidTokens, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.nextTrack();
    
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/previous', requireValidTokens, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.previousTrack();
    
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Volume control
controlRouter.post('/volume', requireValidTokens, async (req, res) => {
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

controlRouter.get('/volume', requireValidTokens, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    const volume = await webAPI.getVolume();
    res.json({ volume });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current playback state
controlRouter.get('/current', requireValidTokens, async (req, res) => {
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
        albumArt: playback.item.album.images?.[0]?.url || null,
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
controlRouter.post('/shuffle', requireValidTokens, async (req, res) => {
  const { enabled } = req.body;
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.setShuffle(enabled);
    res.json({ success: true, shuffling: enabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/repeat', requireValidTokens, async (req, res) => {
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
controlRouter.get('/devices', requireValidTokens, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    const devices = await webAPI.getDevices();
    const currentDevice = await webAPI.getCurrentDevice();
    res.json({ devices, currentDevice });
  } catch (error: any) {
    console.error('[DEVICE] Error in /devices endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Transfer playback to a specific device
controlRouter.post('/transfer', requireValidTokens, async (req, res) => {
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

// Set device preference
controlRouter.post('/device-preference', requireValidTokens, async (req, res) => {
  const { preference } = req.body;
  
  if (!preference) {
    return res.status(400).json({ error: 'Device preference is required' });
  }
  
  try {
    const webAPI = getWebAPI(req);
    webAPI.setDevicePreference(preference);
    
    // Log the device preference change
    logger.info(`[DEVICE PREFERENCE] User ${(req as any).userId || 'unknown'} changed device preference to: ${preference}`);
    
    res.json({ success: true, preference });
  } catch (error: any) {
    logger.error(`[DEVICE PREFERENCE] Failed to set device preference for user ${(req as any).userId || 'unknown'}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Play specific track (requires Web API search first)
controlRouter.post('/play-uri', requireValidTokens, async (req, res) => {
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
controlRouter.get('/search', requireValidTokens, async (req, res) => {
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
controlRouter.post('/queue', requireValidTokens, async (req, res) => {
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
controlRouter.post('/seek', requireValidTokens, async (req, res) => {
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

// Clear queue
controlRouter.post('/clear-queue', requireValidTokens, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    await webAPI.clearQueue();
    
    
    res.json({ success: true, message: 'Queue cleared' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get queue
controlRouter.get('/queue', requireValidTokens, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    const queue = await webAPI.getQueue();
    res.json({ success: true, queue });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Shuffle control
controlRouter.post('/shuffle', requireValidTokens, async (req, res) => {
  const { state } = req.body;
  
  if (typeof state !== 'boolean') {
    return res.status(400).json({ error: 'State must be boolean' });
  }
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.setShuffle(state);
    
    
    res.json({ success: true, message: `Shuffle ${state ? 'on' : 'off'}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Repeat control
controlRouter.post('/repeat', requireValidTokens, async (req, res) => {
  const { state } = req.body;
  
  if (!['off', 'track', 'context'].includes(state)) {
    return res.status(400).json({ error: 'State must be off, track, or context' });
  }
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.setRepeat(state);
    
    
    res.json({ success: true, message: `Repeat set to ${state}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Volume control
controlRouter.post('/volume', requireValidTokens, async (req, res) => {
  const { volume } = req.body;
  
  if (typeof volume !== 'number' || volume < 0 || volume > 100) {
    return res.status(400).json({ error: 'Volume must be between 0 and 100' });
  }
  
  try {
    const webAPI = getWebAPI(req);
    await webAPI.setVolume(volume);
    res.json({ success: true, message: `Volume set to ${volume}%` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current track and playback state
controlRouter.get('/current-track', requireValidTokens, async (req, res) => {
  try {
    const webAPI = getWebAPI(req);
    const playback = await webAPI.getCurrentPlayback();
    
    if (!playback || !playback.item) {
      res.json({ 
        success: true, 
        message: 'No track playing',
        track: null,
        isPlaying: false,
        shuffleState: false,
        repeatState: 'off',
        volume: 50
      });
    } else {
      const track = playback.item;
      res.json({ 
        success: true,
        track: {
          name: track.name,
          artist: track.artists.map((a: any) => a.name).join(', '),
          artists: track.artists.map((a: any) => ({
            name: a.name,
            id: a.id,
            uri: a.uri,
            external_urls: a.external_urls
          })),
          album: track.album.name,
          albumId: track.album.id,
          albumUri: track.album.uri,
          albumArt: track.album.images?.[0]?.url || null,
          releaseDate: track.album.release_date,
          duration: track.duration_ms,
          position: playback.progress_ms || 0,
          id: track.id,
          uri: track.uri,
          external_urls: track.external_urls,
          popularity: track.popularity,
          preview_url: track.preview_url,
          track_number: track.track_number,
          disc_number: track.disc_number
        },
        isPlaying: playback.is_playing,
        shuffleState: playback.shuffle_state,
        repeatState: playback.repeat_state,
        volume: playback.device?.volume_percent || 50,
        device: playback.device
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});