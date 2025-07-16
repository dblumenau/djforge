import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import axios from 'axios';
import { authRouter } from './spotify/auth';
import { controlRouter } from './spotify/control';
import { claudeRouter } from './claude/interpreter';
import { enhancedClaudeRouter } from './claude/enhanced-interpreter';
import { simpleLLMInterpreterRouter, setRedisClient } from './routes/simple-llm-interpreter';
import { llmInterpreterRouter, setRedisClient as setLLMRedisClient } from './routes/llm-interpreter';
import { sessionManagementRouter, setRedisUtils } from './routes/session-management';
import { modelPreferencesRouter, setRedisClient as setModelPrefsRedisClient } from './routes/model-preferences';
import { waitlistRouter } from './routes/waitlist';
import { createRedisClient, checkRedisHealth } from './config/redis';
import { RedisUtils } from './utils/redis-utils';

// Fallback to file store if Redis is unavailable
const FileStore = require('session-file-store')(session);

dotenv.config({ path: '../.env' });
console.log('🔐 JWT_SECRET loaded:', process.env.JWT_SECRET ? 'Yes' : 'No');
console.log('🔐 SESSION_SECRET loaded:', process.env.SESSION_SECRET ? 'Yes' : 'No');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Redis client
let redisClient: any = null;
let sessionStore: any = null;
let redisUtils: RedisUtils | null = null;

async function initializeSessionStore() {
  try {
    // Try to connect to Redis
    redisClient = await createRedisClient();
    await redisClient.connect();
    
    // Check if Redis is healthy
    const isHealthy = await checkRedisHealth(redisClient);
    if (isHealthy) {
      console.log('✅ Using Redis for session storage');
      // For connect-redis v9, we need to import it differently
      const { RedisStore } = require('connect-redis');
      sessionStore = new RedisStore({
        client: redisClient,
        prefix: 'djforge:sess:',
        ttl: 86400 * 30, // 30 days in seconds
      });
      
      // Create Redis utils for session management
      redisUtils = new RedisUtils(redisClient);
      setRedisUtils(redisUtils);
      
      // Initialize conversation manager for LLM interpreter
      setRedisClient(redisClient);
      
      // Initialize Redis client for model preferences
      setModelPrefsRedisClient(redisClient);
      
      // Initialize Redis client for LLM interpreter
      setLLMRedisClient(redisClient);
    } else {
      throw new Error('Redis health check failed');
    }
  } catch (error) {
    console.warn('⚠️  Redis unavailable, falling back to file-based sessions:', error instanceof Error ? error.message : 'Unknown error');
    
    // Fallback to file-based sessions
    sessionStore = new FileStore({
      path: './sessions', // Use relative path from working directory
      ttl: 86400 * 30, // 30 days
      retries: 5,
      reapInterval: 3600 // Clean up expired sessions every hour
    });
    
    // Clean up Redis client if it was created
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch {
        // Ignore cleanup errors
      }
      redisClient = null;
    }
  }
}

// CORS must be configured before session middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://djforge-client.fly.dev'
];

// Add any additional origins from environment variable
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
}));

app.use(express.json());

// Initialize and start server
async function initializeAndStart() {
  try {
    // Initialize session store first
    await initializeSessionStore();
    
    // Configure session middleware BEFORE routes
    app.use(session({
      secret: process.env.SESSION_SECRET || 'spotify-claude-secret',
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // true in production for HTTPS
        httpOnly: true,
        maxAge: 86400000 * 30, // 30 days
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site in production
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? '.fly.dev' : undefined // Share across subdomains
      },
      name: 'spotify_session'
    }));

    // NOW add routes (after session middleware)
    app.use('/api/auth', authRouter);
    app.use('/api/control', controlRouter);
    
    // Use flexible LLM interpreter by default (production-ready)
    app.use('/api/claude', simpleLLMInterpreterRouter);
    // Keep schema-based interpreter available at /api/claude-schema
    app.use('/api/claude-schema', llmInterpreterRouter);
    // Keep enhanced interpreter available at /api/claude-enhanced
    app.use('/api/claude-enhanced', enhancedClaudeRouter);
    // Keep original interpreter available at /api/claude-basic
    app.use('/api/claude-basic', claudeRouter);

    // Session management endpoints
    app.use('/api/sessions', sessionManagementRouter);
    // Model preferences endpoints
    app.use('/api/preferences', modelPreferencesRouter);
    // Waitlist endpoints
    app.use('/api/waitlist', waitlistRouter);

    // Determine client URL based on environment
    const clientUrl = process.env.CLIENT_URL || 'http://127.0.0.1:5173';

    // Handle callback at root level (Spotify redirects here)
    app.get('/callback', async (req, res) => {
  // Import the callback handler logic
  const { code, error, state } = req.query;
  
  if (error) {
    return res.redirect(`${clientUrl}/?error=${error}`);
  }
  
  if (!code || typeof code !== 'string') {
    return res.redirect(`${clientUrl}/?error=no_code`);
  }
  
  // Try to get codeVerifier from state parameter first (production)
  let codeVerifier = req.session.codeVerifier;
  
  if (state && typeof state === 'string') {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      if (stateData.codeVerifier) {
        codeVerifier = stateData.codeVerifier;
        console.log('Code verifier extracted from state parameter');
      }
    } catch (e) {
      console.error('Failed to parse state parameter:', e);
    }
  }
  
  if (!codeVerifier) {
    return res.redirect(`${clientUrl}/?error=no_verifier`);
  }
  
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        code_verifier: codeVerifier
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    // Get user info from Spotify
    const { SpotifyWebAPI } = require('./spotify/api');
    const spotifyApi = new SpotifyWebAPI(
      response.data,
      () => {} // No token refresh callback needed for this one-time call
    );
    
    let spotifyUserId: string;
    try {
      const userInfo = await spotifyApi.getCurrentUser();
      spotifyUserId = userInfo.id;
      console.log('Spotify user ID retrieved:', spotifyUserId);
    } catch (error) {
      console.error('Failed to get user info from Spotify:', error);
      return res.redirect(`${clientUrl}/?error=user_info_failed`);
    }
    
    // Generate JWT token with Spotify tokens and user ID
    const { generateJWT } = require('./utils/jwt');
    const jwtToken = generateJWT(response.data, spotifyUserId);
    
    delete req.session.codeVerifier;
    
    console.log('Auth successful, JWT generated with user ID');
    
    // Redirect with JWT token for all environments
    res.redirect(`${clientUrl}/callback?success=true&token=${encodeURIComponent(jwtToken)}`);
  } catch (error) {
    console.error('Token exchange error:', error);
    res.redirect(`${clientUrl}/?error=token_exchange_failed`);
  }
});

    // Temporary endpoint to clear Redis (REMOVE AFTER USE)
    app.post('/api/admin/clear-redis', async (req, res) => {
      // Simple protection - check for a secret header
      if (req.headers['x-admin-key'] !== 'temporary-clear-key-2024') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!redisClient) {
        return res.status(500).json({ error: 'Redis not available' });
      }
      
      try {
        const keys = await redisClient.keys('*');
        console.log(`Clearing ${keys.length} Redis keys...`);
        
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
        
        res.json({ 
          success: true, 
          message: `Cleared ${keys.length} keys from Redis`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error clearing Redis:', error);
        res.status(500).json({ error: 'Failed to clear Redis' });
      }
    });

    // Temporary endpoint to check Redis contents (REMOVE AFTER USE)
    app.get('/api/admin/redis-debug/:userId', async (req, res) => {
      // Simple protection - check for a secret header
      if (req.headers['x-admin-key'] !== 'temporary-clear-key-2024') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!redisClient) {
        return res.status(500).json({ error: 'Redis not available' });
      }
      
      try {
        const { userId } = req.params;
        const conversationKey = `djforge:conv:${userId}`;
        const stateKey = `djforge:state:${userId}`;
        const prefsKey = `user:${userId}:model_preference`;
        
        const [conversationData, stateData, prefsData] = await Promise.all([
          redisClient.lRange(conversationKey, 0, -1),
          redisClient.get(stateKey),
          redisClient.get(prefsKey)
        ]);
        
        res.json({ 
          userId,
          keys: {
            conversation: conversationKey,
            state: stateKey,
            preferences: prefsKey
          },
          data: {
            conversationEntries: conversationData.length,
            conversation: conversationData.map((entry: string) => {
              try {
                return JSON.parse(entry);
              } catch {
                return entry;
              }
            }),
            state: stateData ? JSON.parse(stateData) : null,
            preferences: prefsData
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error checking Redis:', error);
        res.status(500).json({ error: 'Failed to check Redis' });
      }
    });

    // Health check with Redis status (inside initializeAndStart)
    app.get('/api/health', async (req, res) => {
      const health: any = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        sessionStore: redisClient ? 'redis' : 'file',
      };
      
      // Check Redis health if available
      if (redisClient) {
        try {
          health.redis = await checkRedisHealth(redisClient) ? 'healthy' : 'unhealthy';
        } catch {
          health.redis = 'error';
        }
      }
      
      res.json(health);
    });

    // Start the server
    // Listen on all interfaces to ensure both localhost and 127.0.0.1 work
    const host = '0.0.0.0';
    const port = typeof PORT === 'string' ? parseInt(PORT) : PORT;
    app.listen(port, host, () => {
      const displayHost = process.env.NODE_ENV === 'production' ? host : 'localhost';
      console.log(`🎵 Spotify Controller server running on http://${displayHost}:${port}`);
      console.log(`🤖 Ready to receive commands!`);
      console.log(`📦 Session storage: ${redisClient ? 'Redis' : 'File-based'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📡 Received SIGTERM, shutting down gracefully');
  
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error);
    }
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📡 Received SIGINT, shutting down gracefully');
  
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error);
    }
  }
  
  process.exit(0);
});

// Export app for testing
export { app };

// Call the initialization function
initializeAndStart();