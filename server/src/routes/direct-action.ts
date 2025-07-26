import { Router } from 'express';
import { SpotifyControl } from '../spotify/control';
import { ensureValidToken } from '../spotify/auth';
import { ConversationManager, getConversationManager } from '../services/ConversationManager';

export const directActionRouter = Router();

// Shared conversation manager instance
let conversationManager: ConversationManager;

export function setRedisClient(client: any) {
  conversationManager = getConversationManager(client);
  console.log('✅ Direct action ConversationManager initialized');
}

// Direct play/queue endpoint for songs with known URIs
directActionRouter.post('/song', ensureValidToken, async (req, res) => {
  const { uri, action, name, artists } = req.body;
  
  // Validate input
  if (!uri || !action || !['play', 'queue'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request. Required: uri, action (play/queue)'
    });
  }

  try {
    const userId = conversationManager?.getUserIdFromRequest(req);
    console.log(`Processing direct ${action} for song: ${name} by ${artists}`);
    console.log(`User ID: ${userId}`);
    console.log(`Spotify URI: ${uri}`);

    // Get tokens from request (ensureValidToken middleware adds this)
    const tokens = req.spotifyTokens;
    if (!tokens) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated with Spotify'
      });
    }

    const spotifyControl = new SpotifyControl(
      tokens,
      (newTokens) => { req.spotifyTokens = newTokens; }
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

    // Update dialog state in Redis if successful
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

  } catch (error) {
    console.error('Direct action error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});