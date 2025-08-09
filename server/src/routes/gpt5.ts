import { Router } from 'express';
import OpenAI from 'openai';
import { requireValidTokens } from '../middleware/session-auth';
import { ResponseHandler } from '../llm/gpt5/handlers/response-handler';
import { StreamHandler } from '../llm/gpt5/handlers/stream-handler';
import { SessionManager } from '../llm/gpt5/core/session-manager';
import { buildTools } from '../llm/gpt5/tools/definitions';
import { FunctionContext } from '../llm/gpt5/tools/functions';
import { ResponseCreateParams } from 'openai/resources/responses/responses';
import { SpotifyAuthTokens } from '../types';
// Helper to get user ID from session
function getUserIdFromRequest(req: any): string | null {
  return req.userId || null; // Provided by requireValidTokens middleware
}

export const gpt5Router = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize session manager
const sessionManager = new SessionManager();

// Initialize handlers
const responseHandler = new ResponseHandler({});
const streamHandler = new StreamHandler({});

/**
 * Health check endpoint
 */
gpt5Router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'gpt5',
    hasApiKey: !!process.env.OPENAI_API_KEY,
    availableModels: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano']
  });
});

/**
 * Main GPT-5 command endpoint with Spotify integration
 */
gpt5Router.post('/command', requireValidTokens, async (req: any, res) => {
  try {
    const { 
      command, 
      model = 'gpt-5-nano',
      stream = false,
      useTools = true,
      temperature = 0.7,
      maxTokens = 1000
    } = req.body;

    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Command is required'
      });
    }

    // Get user ID and session
    const userId = getUserIdFromRequest(req) || 'anonymous';
    const sessionId = `gpt5_${userId}`;
    
    // Load or create session
    const session = await sessionManager.loadSession(sessionId);

    // Create function context with Spotify tokens
    const functionContext: FunctionContext = {
      spotifyTokens: req.tokens as SpotifyAuthTokens,
      userId
    };

    // Build tools if enabled
    const tools = useTools ? buildTools() : undefined;

    // Prepare request parameters
    const params: ResponseCreateParams = {
      model,
      input: command,
      instructions: `You are DJ Forge Assistant, integrated with Spotify. You can control Spotify playback, search for songs, and provide music recommendations.
      
When a user asks you to play a specific song, use the play_specific_song function to search for and play it on Spotify.
When a user rejects a song or asks for alternatives, use the provide_music_alternatives function.

Always be helpful and conversational while fulfilling the user's music requests.`,
      tools,
      temperature,
      max_output_tokens: maxTokens,
      store: true, // Always store for session continuity
      previous_response_id: session.lastResponseId || undefined
    };

    // Handle streaming vs standard response
    if (stream) {
      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      // Handle streaming with function support
      await streamHandler.handleStreamingResponseWithContext(
        openai,
        params,
        Date.now(),
        command,
        session,
        () => sessionManager.saveSession(sessionId, session),
        functionContext,
        (chunk: string) => {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
      );

      // End the stream
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Handle standard response with function support
      const response = await responseHandler.handleStandardResponseWithContext(
        openai,
        params,
        Date.now(),
        command,
        session,
        () => sessionManager.saveSession(sessionId, session),
        functionContext
      );

      // Return the response
      res.json({
        success: true,
        response: response.output,
        model: response.model,
        usage: response.usage,
        sessionId,
        hadFunctionCall: response.hadFunctionCall || false
      });
    }
  } catch (error) {
    console.error('GPT-5 command error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get session history
 */
gpt5Router.get('/history', requireValidTokens, async (req: any, res) => {
  try {
    const userId = getUserIdFromRequest(req) || 'anonymous';
    const sessionId = `gpt5_${userId}`;
    
    const session = await sessionManager.loadSession(sessionId);
    
    res.json({
      success: true,
      history: session.conversationHistory || [],
      sessionId
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clear session
 */
gpt5Router.post('/clear', requireValidTokens, async (req: any, res) => {
  try {
    const userId = getUserIdFromRequest(req) || 'anonymous';
    const sessionId = `gpt5_${userId}`;
    
    await sessionManager.clearSession(sessionId);
    
    res.json({
      success: true,
      message: 'Session cleared',
      sessionId
    });
  } catch (error) {
    console.error('Clear session error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});