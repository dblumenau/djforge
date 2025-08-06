import { Router } from 'express';
import { SpotifyControl } from '../spotify/control';
import { SpotifyWebAPI } from '../spotify/api';
import { requireValidTokens } from '../middleware/session-auth';
import { ConversationManager, getConversationManager } from '../services/ConversationManager';
import { UserDataService } from '../services/UserDataService';
import { getWebSocketService } from '../services/websocket.service';

export const directActionRouter = Router();

// Shared conversation manager instance
let conversationManager: ConversationManager;
let redisClient: any;

export function setRedisClient(client: any) {
  redisClient = client;
  conversationManager = getConversationManager(client);
  console.log('✅ Direct action ConversationManager initialized');
}

// Helper to get user data service with SpotifyWebAPI
function getUserDataService(userId: string, spotifyWebAPI: any, redisClient: any) {
  return new UserDataService(redisClient, spotifyWebAPI, userId);
}

// Helper function to emit WebSocket events for direct actions
async function emitDirectActionWebSocketEvents(
  userId: string, 
  action: string, 
  success: boolean, 
  result: any,
  spotifyControl: SpotifyControl
): Promise<void> {
  const wsService = getWebSocketService();
  const musicService = wsService?.getMusicService();
  
  if (!musicService || !userId) {
    return;
  }

  try {
    // Don't emit command execution for direct actions to avoid chat messages
    // Only emit the specific playback state changes below

    // If action was successful, emit appropriate events
    if (success) {
      if (action === 'play' || action === 'queue') {
        // Get current track information
        const currentPlayback = await spotifyControl.getCurrentTrack();
        
        if (action === 'play' && currentPlayback.success && currentPlayback.track) {
          musicService.emitTrackChange(userId, {
            previous: null,
            current: currentPlayback.track,
            source: 'user',
            timestamp: Date.now()
          });
        }
        
        if (action === 'queue' && result.track) {
          musicService.emitQueueUpdate(userId, {
            action: 'added',
            tracks: [result.track],
            totalItems: 1,
            source: 'user',
            timestamp: Date.now()
          });
        }
        
        // Get full playback state for play actions
        if (action === 'play') {
          const playbackState = await spotifyControl.getApi().getCurrentPlayback();
          if (playbackState) {
            musicService.emitPlaybackStateChange(userId, {
              isPlaying: playbackState.is_playing || false,
              track: playbackState.item,
              position: Math.floor((playbackState.progress_ms || 0) / 1000),
              duration: Math.floor((playbackState.item?.duration_ms || 0) / 1000),
              device: playbackState.device?.name || 'Unknown',
              shuffleState: playbackState.shuffle_state || false,
              repeatState: playbackState.repeat_state || 'off',
              volume: playbackState.device?.volume_percent || 0,
              timestamp: Date.now()
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to emit direct action WebSocket events:', error);
    // Don't throw - WebSocket failures shouldn't break the main response
  }
}

// Direct play/queue endpoint for songs with known URIs
directActionRouter.post('/song', requireValidTokens, async (req: any, res) => {
  const { uri, action, name, artists } = req.body;
  
  // Validate input
  if (!uri || !action || !['play', 'queue'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request. Required: uri, action (play/queue)'
    });
  }

  try {
    const userId = req.userId; // Provided by requireValidTokens middleware
    console.log(`Processing direct ${action} for song: ${name} by ${artists}`);
    console.log(`User ID: ${userId}`);
    console.log(`Spotify URI: ${uri}`);

    // Get tokens from request (requireValidTokens middleware adds this)
    const tokens = req.tokens;
    if (!tokens) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated with Spotify'
      });
    }

    const spotifyControl = new SpotifyControl(
      tokens,
      (newTokens) => { req.tokens = newTokens; }
    );
    
    let response: string;
    let success = false;

    try {
      if (action === 'play') {
        // Play the track directly using the URI
        await spotifyControl.playTrack(uri);
        success = true;
        response = `Playing: ${name} by ${artists}`;
      } else {
        // Queue the track
        const queueResult = await spotifyControl.queueTrackByUri(uri);
        success = queueResult.success;
        response = queueResult.success 
          ? `Added to queue: ${name} by ${artists}`
          : queueResult.message || 'Failed to add track to queue';
      }
    } catch (error: any) {
      success = false;
      response = error.message || `Failed to ${action} track`;
    }

    // Update dialog state in Redis if successful (but don't add to conversation)
    if (success && conversationManager && userId) {
      const dialogState: any = {
        mode: 'music',
        last_action: `${action}_direct`,
        last_track: name,
        last_artist: artists,
        timestamp: Date.now()
      };
      await conversationManager.updateDialogState(userId, dialogState);
    }

    res.json({
      success,
      response,
      action,
      track: { name, artists, uri }
    });

    // Emit WebSocket events for direct actions
    if (userId) {
      emitDirectActionWebSocketEvents(
        userId, 
        action, 
        success, 
        { track: { name, artists, uri }, message: response }, 
        spotifyControl
      ).catch(error => {
        console.error('WebSocket emission failed for direct action:', error);
      });
    }

  } catch (error) {
    console.error('Direct action error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Direct play endpoint for playlists with known playlist IDs
directActionRouter.post('/playlist', requireValidTokens, async (req: any, res) => {
  const { playlistId, action = 'play' } = req.body;
  
  if (!playlistId) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request. Required: playlistId'
    });
  }

  try {
    const userId = req.userId;
    const uri = `spotify:playlist:${playlistId}`;
    
    console.log(`Processing direct ${action} for playlist: ${playlistId}`);
    console.log(`User ID: ${userId}`);
    console.log(`Spotify URI: ${uri}`);

    const tokens = req.tokens;
    if (!tokens) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated with Spotify'
      });
    }

    const spotifyControl = new SpotifyControl(
      tokens,
      (newTokens) => { req.tokens = newTokens; }
    );
    
    let response: string = 'Invalid action';
    let success = false;

    if (action === 'play') {
      const result = await spotifyControl.playPlaylist(uri);
      success = result.success;
      response = result.success 
        ? `Playing playlist`
        : result.message || 'Failed to play playlist';
    }

    res.json({
      success,
      response,
      action,
      playlistId
    });

    if (userId) {
      emitDirectActionWebSocketEvents(
        userId, 
        action, 
        success, 
        { playlistId, message: response }, 
        spotifyControl
      ).catch(error => {
        console.error('WebSocket emission failed for playlist action:', error);
      });
    }

  } catch (error) {
    console.error('Playlist direct action error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Direct play endpoint for playlists with known URIs (legacy endpoint)
directActionRouter.post('/playlist-uri', requireValidTokens, async (req: any, res) => {
  const { uri, action = 'play', name } = req.body;
  
  // Validate input
  if (!uri || !action || !['play', 'queue'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request. Required: uri, action (play/queue)'
    });
  }

  try {
    const userId = req.userId; // Provided by requireValidTokens middleware
    console.log(`Processing direct ${action} for playlist: ${name || 'Unknown'}`);
    console.log(`User ID: ${userId}`);
    console.log(`Spotify URI: ${uri}`);

    // Get tokens from request (requireValidTokens middleware adds this)
    const tokens = req.tokens;
    if (!tokens) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated with Spotify'
      });
    }

    const spotifyControl = new SpotifyControl(
      tokens,
      (newTokens) => { req.tokens = newTokens; }
    );
    
    let response: string = 'Invalid action';
    let success = false;

    try {
      if (action === 'play') {
        // Play the playlist directly using the URI
        const playResult = await spotifyControl.playPlaylist(uri);
        success = playResult.success;
        response = playResult.success 
          ? `Playing playlist: ${name || 'Unknown playlist'}` 
          : playResult.message || 'Failed to play playlist';
      } else if (action === 'queue') {
        // Extract playlist ID from URI (format: spotify:playlist:ID)
        const playlistId = uri.split(':').pop();
        const queueResult = await spotifyControl.queuePlaylist(playlistId);
        success = queueResult.success;
        response = queueResult.success 
          ? queueResult.message || `Queued tracks from playlist: ${name || 'Unknown playlist'}`
          : queueResult.message || 'Failed to queue playlist';
      }
    } catch (error: any) {
      success = false;
      response = error.message || `Failed to ${action} playlist`;
    }

    // Update dialog state in Redis if successful (but don't add to conversation)
    if (success && conversationManager && userId) {
      const dialogState: any = {
        mode: 'music',
        last_action: `${action}_playlist_direct`,
        last_playlist: name || 'Unknown playlist',
        timestamp: Date.now()
      };
      await conversationManager.updateDialogState(userId, dialogState);
    }

    res.json({
      success,
      response,
      action,
      playlist: { name: name || 'Unknown playlist', uri }
    });

    // Emit WebSocket events for direct actions
    if (userId) {
      emitDirectActionWebSocketEvents(
        userId, 
        action, 
        success, 
        { playlist: { name: name || 'Unknown playlist', uri }, message: response }, 
        spotifyControl
      ).catch(error => {
        console.error('WebSocket emission failed for playlist direct action:', error);
      });
    }

  } catch (error) {
    console.error('Direct playlist action error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Start playback with user's content (for empty player state)
directActionRouter.post('/start-playback', requireValidTokens, async (req: any, res) => {
  try {
    const userId = req.userId; // Provided by requireValidTokens middleware
    const { playType = 'recent' } = req.body; // 'recent' or 'top'
    
    console.log(`Starting playback for user ${userId} with ${playType} tracks`);

    // Get tokens from request
    const tokens = req.tokens;
    if (!tokens) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated with Spotify'
      });
    }

    const spotifyControl = new SpotifyControl(
      tokens,
      (newTokens) => { req.tokens = newTokens; }
    );

    // Get user data service instance with SpotifyWebAPI
    const spotifyWebAPI = new SpotifyWebAPI(tokens, (newTokens) => { req.tokens = newTokens; });
    const userDataService = getUserDataService(userId, spotifyWebAPI, redisClient);
    
    let trackUris: string[] = [];
    
    if (playType === 'recent') {
      // Get recently played tracks
      const recentTracks = await userDataService.getRecentlyPlayed();
      if (recentTracks && recentTracks.length > 0) {
        // Get unique track URIs (remove duplicates)
        const uniqueUris = new Set<string>();
        recentTracks.forEach(item => {
          if (item.track && item.track.uri) {
            uniqueUris.add(item.track.uri);
          }
        });
        trackUris = Array.from(uniqueUris).slice(0, 20); // Limit to 20 tracks
      }
    } else if (playType === 'top') {
      // Get top tracks
      const topTracks = await userDataService.getTopTracks('short_term');
      if (topTracks && topTracks.length > 0) {
        trackUris = topTracks.map(track => track.uri).slice(0, 20);
      }
    }

    if (trackUris.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No tracks found to play. Please play something from Spotify first.'
      });
    }

    // For web player, we might need to handle this differently
    // Try to get current playback state first
    const currentPlayback = await spotifyWebAPI.getCurrentPlayback();
    
    let result;
    if (!currentPlayback || !currentPlayback.is_playing) {
      // No active playback, we need to start fresh
      // Play the first track, then queue the rest
      try {
        const firstTrackUri = trackUris[0];
        const remainingTracks = trackUris.slice(1);
        
        // Play the first track
        await spotifyControl.playTrack(firstTrackUri);
        
        // Queue the remaining tracks
        for (const uri of remainingTracks) {
          await spotifyWebAPI.addToQueue(uri);
        }
        
        result = { 
          success: true, 
          message: `Started playing ${trackUris.length} tracks` 
        };
      } catch (playError: any) {
        console.log('Track-by-track queueing failed (404 - no active playback), falling back to batch play method');
        // Fall back to original method
        result = await spotifyControl.playTracks(trackUris);
      }
    } else {
      // There's active playback, use the batch method
      result = await spotifyControl.playTracks(trackUris);
    }
    
    if (result.success) {
      // Don't add to conversation history for direct actions
      // Just update dialog state if needed
      if (conversationManager && userId) {
        const dialogState: any = {
          mode: 'music',
          last_action: 'start_playback_direct',
          timestamp: Date.now()
        };
        await conversationManager.updateDialogState(userId, dialogState);
      }

      const responseData = {
        success: true,
        message: `Started playing your ${playType === 'recent' ? 'recently played' : 'top'} tracks`,
        trackCount: trackUris.length
      };
      
      res.json(responseData);
      
      // Emit WebSocket events for start-playback
      emitDirectActionWebSocketEvents(
        userId, 
        'play', 
        true, 
        responseData, 
        spotifyControl
      ).catch(error => {
        console.error('WebSocket emission failed for start-playback:', error);
      });
      
      return;
    } else {
      return res.status(500).json({
        success: false,
        error: result.message || 'Failed to start playback'
      });
    }
  } catch (error: any) {
    console.error('Error in start-playback:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to start playback'
    });
  }
});