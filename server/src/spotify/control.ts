import { Router } from 'express';
import { AppleScriptController } from './applescript';
import { SpotifyWebAPI } from './api';
import { SpotifyAuthTokens } from '../types';

export const controlRouter = Router();

const appleScript = new AppleScriptController();

// SpotifyControl class for use by interpreter
export class SpotifyControl {
  private appleScript: AppleScriptController;
  private webAPI?: SpotifyWebAPI;

  constructor(tokens?: SpotifyAuthTokens) {
    this.appleScript = new AppleScriptController();
    if (tokens) {
      this.webAPI = new SpotifyWebAPI(tokens, () => {});
    }
  }

  async play() {
    try {
      await this.appleScript.play();
      return { success: true, message: 'Playing' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async pause() {
    try {
      await this.appleScript.pause();
      return { success: true, message: 'Paused' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async skip() {
    try {
      await this.appleScript.nextTrack();
      return { success: true, message: 'Skipped to next track' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async previous() {
    try {
      await this.appleScript.previousTrack();
      return { success: true, message: 'Went to previous track' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async setVolume(level: number) {
    try {
      await this.appleScript.setVolume(level);
      return { success: true, message: `Volume set to ${level}` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async getCurrentTrack() {
    try {
      const track = await this.appleScript.getCurrentTrack();
      return { 
        success: true, 
        message: track ? `Now playing: ${track.name} by ${track.artist}` : 'No track playing',
        track 
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async searchAndPlay(query: string) {
    if (!this.webAPI) {
      return { success: false, message: 'Not authenticated with Spotify Web API' };
    }

    try {
      // Search for tracks
      const tracks = await this.webAPI.search(query);
      
      if (tracks.length === 0) {
        return { success: false, message: `No tracks found for: "${query}"` };
      }

      // Play the first result
      const track = tracks[0];
      await this.appleScript.playTrack(track.uri);
      
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
    if (!this.webAPI) {
      return { success: false, message: 'Not authenticated with Spotify Web API' };
    }

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
}

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session.spotifyTokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Basic playback controls using AppleScript
controlRouter.post('/play', async (req, res) => {
  try {
    await appleScript.play();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/pause', async (req, res) => {
  try {
    await appleScript.pause();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/next', async (req, res) => {
  try {
    await appleScript.nextTrack();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/previous', async (req, res) => {
  try {
    await appleScript.previousTrack();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Volume control
controlRouter.post('/volume', async (req, res) => {
  const { volume } = req.body;
  
  if (typeof volume !== 'number' || volume < 0 || volume > 100) {
    return res.status(400).json({ error: 'Volume must be between 0 and 100' });
  }
  
  try {
    await appleScript.setVolume(volume);
    res.json({ success: true, volume });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.get('/volume', async (req, res) => {
  try {
    const volume = await appleScript.getVolume();
    res.json({ volume });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current playback state
controlRouter.get('/current', async (req, res) => {
  try {
    const [track, state, isRunning] = await Promise.all([
      appleScript.getCurrentTrack(),
      appleScript.getPlayerState(),
      appleScript.isSpotifyRunning()
    ]);
    
    res.json({
      isRunning,
      state,
      track
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Shuffle and repeat controls
controlRouter.post('/shuffle', async (req, res) => {
  const { enabled } = req.body;
  
  try {
    await appleScript.setShuffling(enabled);
    res.json({ success: true, shuffling: enabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

controlRouter.post('/repeat', async (req, res) => {
  const { enabled } = req.body;
  
  try {
    await appleScript.setRepeating(enabled);
    res.json({ success: true, repeating: enabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Launch Spotify if not running
controlRouter.post('/launch', async (req, res) => {
  try {
    const isRunning = await appleScript.isSpotifyRunning();
    if (!isRunning) {
      await appleScript.launchSpotify();
      res.json({ success: true, message: 'Spotify launched' });
    } else {
      res.json({ success: true, message: 'Spotify already running' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Play specific track (requires Web API search first)
controlRouter.post('/play-uri', requireAuth, async (req, res) => {
  const { uri } = req.body;
  
  if (!uri || typeof uri !== 'string') {
    return res.status(400).json({ error: 'Spotify URI required' });
  }
  
  try {
    await appleScript.playTrack(uri);
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
    if (!req.session.spotifyTokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const webAPI = new SpotifyWebAPI(
      req.session.spotifyTokens,
      (tokens) => { req.session.spotifyTokens = tokens; }
    );
    
    const tracks = await webAPI.search(q);
    res.json({ tracks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});