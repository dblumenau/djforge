import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { interpretCommand } from './simple-llm-interpreter';
import { ConversationManager, getConversationManager } from '../services/ConversationManager';
import { ConversationEntry } from '../utils/redisConversation';

export const llmTestRouter = Router();

// Initialize conversation manager when Redis is available
let conversationManager: ConversationManager | null = null;

export function setRedisClientForTest(client: any) {
  if (client) {
    conversationManager = getConversationManager(client);
    console.log('✅ Test endpoint ConversationManager initialized with Redis');
  }
}

// Test conversation storage interface
interface TestConversation {
  conversationHistory: Array<{
    command: string;
    interpretation: any;
    response: any;
    timestamp: number;
  }>;
  userId: string;
  model: string;
  seriesId: string;
  lastUpdated: number;
}

interface TestSeriesInfo {
  seriesId: string;
  turnCount: number;
  lastUpdated: number;
  model: string;
}

// Validate seriesId to ensure it's safe for file system
function validateSeriesId(seriesId: string): boolean {
  // Allow alphanumeric, underscore, and hyphen only
  return /^[a-zA-Z0-9_-]+$/.test(seriesId);
}

// Generate file path for a test series
function getConversationFilePath(seriesId: string): string {
  return `/tmp/llm-test-${seriesId}.json`;
}

// Helper function to load conversation from file
async function loadConversation(seriesId: string): Promise<TestConversation> {
  try {
    const filePath = getConversationFilePath(seriesId);
    const data = await fs.readFile(filePath, 'utf-8');
    const conversation = JSON.parse(data);
    
    // Ensure seriesId is set (for backwards compatibility)
    if (!conversation.seriesId) {
      conversation.seriesId = seriesId;
    }
    
    return conversation;
  } catch (error) {
    // File doesn't exist or is invalid, return empty conversation
    return {
      conversationHistory: [],
      userId: 'test-user',
      model: 'gpt-5-nano',
      seriesId: seriesId,
      lastUpdated: Date.now()
    };
  }
}

// Helper function to save conversation to file
async function saveConversation(seriesId: string, conversation: TestConversation): Promise<void> {
  const filePath = getConversationFilePath(seriesId);
  conversation.seriesId = seriesId;
  conversation.lastUpdated = Date.now();
  await fs.writeFile(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
}

// List all test series files
async function listAllTestSeries(): Promise<TestSeriesInfo[]> {
  try {
    const files = await fs.readdir('/tmp');
    const testFiles = files.filter(file => file.startsWith('llm-test-') && file.endsWith('.json'));
    
    const seriesInfos: TestSeriesInfo[] = [];
    
    for (const file of testFiles) {
      try {
        const filePath = path.join('/tmp', file);
        const data = await fs.readFile(filePath, 'utf-8');
        const conversation: TestConversation = JSON.parse(data);
        
        // Extract seriesId from filename
        const seriesId = file.replace('llm-test-', '').replace('.json', '');
        
        seriesInfos.push({
          seriesId,
          turnCount: conversation.conversationHistory.length,
          lastUpdated: conversation.lastUpdated || 0,
          model: conversation.model || 'unknown'
        });
      } catch (error) {
        // Skip invalid files
        console.warn(`Skipping invalid test series file: ${file}`);
      }
    }
    
    // Sort by last updated (most recent first)
    return seriesInfos.sort((a, b) => b.lastUpdated - a.lastUpdated);
  } catch (error) {
    console.error('Error listing test series:', error);
    return [];
  }
}

// Generate response based on interpretation
function generateResponse(interpretation: any): any {
  const intent = interpretation.intent;

  switch (intent) {
    case 'chat':
    case 'ask_question':
      return {
        success: true,
        message: interpretation.responseMessage || interpretation.message || "I provided a response.",
        conversational: true
      };

    case 'clarification_mode':
      return {
        success: true,
        message: interpretation.responseMessage || "What direction would you like to go? Feel free to be more specific about what you're looking for.",
        conversational: true,
        clarificationOptions: interpretation.options || [],
        currentContext: interpretation.currentContext,
        uiType: interpretation.uiType || 'clarification_buttons'
      };

    case 'play_specific_song':
      const playTrack = interpretation.track || 'Unknown track';
      const playArtist = interpretation.artist || 'Unknown artist';
      return {
        success: true,
        message: `I'll play "${playTrack}" by ${playArtist}`,
        track: {
          name: playTrack,
          artist: playArtist,
          uri: `spotify:track:test-${Date.now()}`
        }
      };

    case 'queue_specific_song':
      const queueTrack = interpretation.track || 'Unknown track';
      const queueArtist = interpretation.artist || 'Unknown artist';
      return {
        success: true,
        message: `I'll queue "${queueTrack}" by ${queueArtist}`,
        track: {
          name: queueTrack,
          artist: queueArtist,
          uri: `spotify:track:test-${Date.now()}`
        }
      };

    case 'queue_multiple_songs':
      const songs = interpretation.songs || [];
      return {
        success: true,
        message: `I'll queue ${songs.length} songs`,
        queuedSongs: songs.map((song: any, index: number) => ({
          name: song.track || `Song ${index + 1}`,
          artists: song.artist || 'Unknown artist',
          success: true,
          uri: `spotify:track:test-${Date.now()}-${index}`
        }))
      };

    case 'play_playlist':
      const playlistName = interpretation.query || 'a playlist';
      return {
        success: true,
        message: `I'll play ${playlistName}`,
        playlist: {
          name: playlistName,
          uri: `spotify:playlist:test-${Date.now()}`
        }
      };

    case 'queue_playlist':
      const queuePlaylistName = interpretation.query || 'a playlist';
      return {
        success: true,
        message: `I'll queue ${queuePlaylistName}`,
        playlist: {
          name: queuePlaylistName,
          uri: `spotify:playlist:test-${Date.now()}`
        }
      };

    case 'pause':
      return {
        success: true,
        message: "I'll pause the music"
      };

    case 'play':
    case 'resume':
      return {
        success: true,
        message: "I'll resume playback"
      };

    case 'skip':
    case 'next':
      return {
        success: true,
        message: "I'll skip to the next track"
      };

    case 'previous':
    case 'back':
      return {
        success: true,
        message: "I'll go back to the previous track"
      };

    case 'set_volume':
      const volume = interpretation.volume_level || interpretation.volume || interpretation.value || 50;
      return {
        success: true,
        message: `I'll set the volume to ${volume}%`
      };

    case 'set_shuffle':
      const shuffleEnabled = interpretation.enabled !== undefined ? interpretation.enabled : true;
      return {
        success: true,
        message: `I'll ${shuffleEnabled ? 'enable' : 'disable'} shuffle`
      };

    case 'set_repeat':
      const repeatEnabled = interpretation.enabled !== undefined ? interpretation.enabled : true;
      return {
        success: true,
        message: `I'll ${repeatEnabled ? 'enable' : 'disable'} repeat`
      };

    case 'get_current_track':
    case 'get_playback_info':
      return {
        success: true,
        message: "🎵 Currently playing:\n\n🎤 Test Song\n👤 Test Artist\n💿 Test Album\n\n⏱️ 1:30 / 3:45",
        track: {
          name: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          position: 90,
          duration: 225
        }
      };

    case 'unknown':
      return {
        success: false,
        message: interpretation.error || "I couldn't understand that command"
      };

    default:
      return {
        success: true,
        message: `I performed the requested action: ${intent}`
      };
  }
}

// GET / - List all active test series
llmTestRouter.get('/', async (req, res) => {
  try {
    const testSeries = await listAllTestSeries();

    res.json({
      success: true,
      testSeries,
      count: testSeries.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error listing test series:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to list test series',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /:seriesId - Send a command and get interpretation for specific series
llmTestRouter.post('/:seriesId', async (req, res) => {
  const { seriesId } = req.params;
  const { command, model } = req.body;

  // Validate seriesId
  if (!validateSeriesId(seriesId)) {
    return res.status(400).json({ 
      error: 'Invalid series ID. Use only alphanumeric characters, underscores, and hyphens.' 
    });
  }

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ 
      error: 'Command is required and must be a string' 
    });
  }

  if (command.length > 500) {
    return res.status(400).json({ 
      error: 'Command is too long (max 500 characters)' 
    });
  }

  try {
    // Load existing conversation for this series
    const conversation = await loadConversation(seriesId);
    
    // Use provided model or default
    const requestModel = model || 'gpt-5-nano';
    conversation.model = requestModel;
    
    // Store conversation history in Redis if available
    const sessionId = `llm-test-session-${seriesId}`;
    if (conversationManager && conversation.conversationHistory.length > 0) {
      // Clear existing history for this session
      await conversationManager.clearConversationHistory(sessionId);
      
      // Add each previous conversation entry to Redis
      for (const entry of conversation.conversationHistory) {
        const redisEntry: ConversationEntry = {
          command: entry.command,
          interpretation: entry.interpretation,
          response: entry.response,
          timestamp: entry.timestamp
        };
        await conversationManager.addConversationEntry(sessionId, redisEntry);
      }
      console.log(`📝 Loaded ${conversation.conversationHistory.length} entries into Redis for session ${sessionId}`);
    }

    // Call the actual interpretCommand function
    const interpretation = await interpretCommand(
      command,
      conversation.userId,
      requestModel,
      '', // Empty music context for test
      sessionId
    );

    // Generate response based on interpretation
    const response = generateResponse(interpretation);

    // Add to conversation history
    const conversationEntry = {
      command,
      interpretation,
      response,
      timestamp: Date.now()
    };

    conversation.conversationHistory.push(conversationEntry);

    // Save updated conversation
    await saveConversation(seriesId, conversation);
    
    // Also save to Redis for next request
    if (conversationManager) {
      const redisEntry: ConversationEntry = {
        command,
        interpretation,
        response,
        timestamp: conversationEntry.timestamp
      };
      await conversationManager.addConversationEntry(sessionId, redisEntry);
      console.log(`✅ Saved new entry to Redis for session ${sessionId}`);
    }

    // Return interpretation and response
    res.json({
      success: true,
      interpretation,
      response,
      model: requestModel,
      seriesId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('LLM test error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorModel = (error as any)?.model || model || 'unknown';
    
    res.status(500).json({
      success: false,
      error: `LLM interpretation failed: ${errorMessage}`,
      model: errorModel,
      seriesId,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /:seriesId - Clear specific test series
llmTestRouter.delete('/:seriesId', async (req, res) => {
  const { seriesId } = req.params;

  // Validate seriesId
  if (!validateSeriesId(seriesId)) {
    return res.status(400).json({ 
      error: 'Invalid series ID. Use only alphanumeric characters, underscores, and hyphens.' 
    });
  }

  try {
    // Create empty conversation
    const emptyConversation: TestConversation = {
      conversationHistory: [],
      userId: 'test-user',
      model: 'gpt-5-nano',
      seriesId: seriesId,
      lastUpdated: Date.now()
    };

    // Save empty conversation (or delete file)
    await saveConversation(seriesId, emptyConversation);
    
    // Also clear Redis history
    const sessionId = `llm-test-session-${seriesId}`;
    if (conversationManager) {
      await conversationManager.clearConversationHistory(sessionId);
      console.log(`🗑️ Cleared Redis history for session ${sessionId}`);
    }

    res.json({
      success: true,
      message: `Test series '${seriesId}' cleared`,
      seriesId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error clearing conversation:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation history',
      seriesId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /:seriesId - View specific test series conversation history
llmTestRouter.get('/:seriesId', async (req, res) => {
  const { seriesId } = req.params;

  // Validate seriesId
  if (!validateSeriesId(seriesId)) {
    return res.status(400).json({ 
      error: 'Invalid series ID. Use only alphanumeric characters, underscores, and hyphens.' 
    });
  }

  try {
    const conversation = await loadConversation(seriesId);

    res.json({
      success: true,
      conversation: {
        seriesId: conversation.seriesId,
        userId: conversation.userId,
        model: conversation.model,
        lastUpdated: conversation.lastUpdated,
        historyCount: conversation.conversationHistory.length,
        history: conversation.conversationHistory.map(entry => ({
          command: entry.command,
          intent: entry.interpretation?.intent,
          confidence: entry.interpretation?.confidence,
          response: entry.response?.message || 'No message',
          success: entry.response?.success,
          timestamp: entry.timestamp,
          formattedTime: new Date(entry.timestamp).toISOString()
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching conversation:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation history',
      seriesId,
      timestamp: new Date().toISOString()
    });
  }
});

export default llmTestRouter;