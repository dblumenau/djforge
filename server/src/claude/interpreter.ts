import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SpotifyControl } from '../spotify/control';
import { ensureValidToken } from '../spotify/auth';

const execAsync = promisify(exec);

export const claudeRouter = Router();

// Command interpreter endpoint using Claude CLI
claudeRouter.post('/command', ensureValidToken, async (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }

  if (!req.session.spotifyTokens) {
    return res.status(401).json({ error: 'Not authenticated with Spotify' });
  }

  console.log('Processing command:', command);

  try {
    // Use Claude CLI to interpret the command
    const prompt = `You are a Spotify command interpreter. Analyze this command and return ONLY a JSON object with the intent and parameters.
    
    IMPORTANT: Create search queries that match the user's EXACT intent:
    - If they want "obscure" or "rare" tracks, add search terms like "deep cuts", "B-side", or sort by least popular
    - If they specify versions (original, remix, acoustic, live), include those exact terms
    - When they want to EXCLUDE something, use minus sign: "song name -unwanted term"
    - Preserve modifiers: demo, alternate, extended, radio edit, explicit, clean
    - Keep the artist and song names exactly as specified
    
    Possible intents: play, pause, skip, previous, volume, search_and_play, get_current_track, queue_add
    For search_and_play or queue_add, include a "query" parameter.
    For volume, include a "value" parameter (0-100).
    
    Command: "${command}"`;

    const { stdout, stderr } = await execAsync(
      `echo '${prompt.replace(/'/g, "'\\''")}' | claude -p 'Analyze and respond with JSON only' --output-format text`
    );

    if (stderr) {
      console.error('Claude CLI error:', stderr);
      return res.status(500).json({ error: 'Failed to process command' });
    }

    let interpretation;
    try {
      // Extract JSON from Claude's response
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        interpretation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', stdout);
      return res.status(500).json({ error: 'Failed to understand command' });
    }

    console.log('Claude interpretation:', interpretation);

    // Execute the command based on interpretation
    const spotifyControl = new SpotifyControl(
      req.spotifyTokens!,
      (tokens) => { req.spotifyTokens = tokens; }
    );
    let result;

    switch (interpretation.intent) {
      case 'play':
        result = await spotifyControl.play();
        break;
      case 'pause':
        result = await spotifyControl.pause();
        break;
      case 'skip':
      case 'next':
        result = await spotifyControl.skip();
        break;
      case 'previous':
        result = await spotifyControl.previous();
        break;
      case 'volume':
        if (interpretation.value !== undefined) {
          result = await spotifyControl.setVolume(interpretation.value);
        } else {
          result = { success: false, message: 'No volume level specified' };
        }
        break;
      case 'get_current_track':
        result = await spotifyControl.getCurrentTrack();
        break;
      case 'search_and_play':
        if (interpretation.query) {
          result = await spotifyControl.searchAndPlay(interpretation.query);
        } else {
          result = { success: false, message: 'No search query provided' };
        }
        break;
      case 'queue_add':
        if (interpretation.query) {
          result = await spotifyControl.queueTrack(interpretation.query);
        } else {
          result = { success: false, message: 'No search query provided' };
        }
        break;
      default:
        result = { success: false, message: `Unknown command: ${interpretation.intent}` };
    }

    res.json({
      message: result.message || `Command executed: ${interpretation.intent}`,
      interpretation,
      result
    });

  } catch (error) {
    console.error('Command processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process command',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper endpoint for suggestions
claudeRouter.get('/suggestions', (req, res) => {
  res.json({
    suggestions: [
      "Play Shake It Off by Taylor Swift",
      "Play that dancey Taylor Swift song",
      "Play something by The Beatles",
      "Queue some chill jazz",
      "Add Bohemian Rhapsody to queue",
      "Skip this song",
      "Volume to 50",
      "What's playing?",
      "Play some upbeat pop music",
      "Play classic rock hits"
    ]
  });
});