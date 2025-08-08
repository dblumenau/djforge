// IMPORTANT: This must be imported before any other code
import './instrument';

import * as Sentry from '@sentry/node';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import session from 'express-session';
import axios from 'axios';
import { controlRouter } from './spotify/control';
import { claudeRouter } from './claude/interpreter';
import { enhancedClaudeRouter } from './claude/enhanced-interpreter';
import { simpleLLMInterpreterRouter, setRedisClient } from './routes/simple-llm-interpreter';
import { llmInterpreterRouter, setRedisClient as setLLMRedisClient } from './routes/llm-interpreter';
import { sessionManagementRouter, setRedisUtils } from './routes/session-management';
import { modelPreferencesRouter, setRedisClient as setModelPrefsRedisClient } from './routes/model-preferences';
import { waitlistRouter } from './routes/waitlist';
import { llmLogsRouter, setRedisClientForLogs } from './routes/llm-logs';
import { directActionRouter, setRedisClient as setDirectActionRedisClient } from './routes/direct-action';
import { feedbackRouter, setRedisClient as setFeedbackRedisClient } from './routes/feedback';
import songVerificationRouter from './routes/song-verification';
import debugTokenRouter from './routes/debug-token';
import authRouter, { setRedisClient as setAuthRedisClient } from './routes/auth';
import { setRedisClient as setSessionAuthRedisClient } from './middleware/session-auth';
import { createRedisClient, checkRedisHealth } from './config/redis';
import { RedisUtils } from './utils/redis-utils';
import weatherRouter from './routes/weather';
import userDataRouter from './routes/user-data';
import { webPlayerRouter } from './routes/web-player';
import { websocketRouter } from './routes/websocket';
import playlistSearchRouter from './routes/playlist-search';
import playlistDiscoveryRouter, { setRedisClient as setPlaylistDiscoveryRedisClient, setLoggingService as setPlaylistDiscoveryLoggingService } from './routes/playlist-discovery';
import llmTestRouter from './routes/llm-test';
import { overrideConsole, logger } from './utils/logger';
import { setSentryUserContext } from './middleware/sentry-auth';
import { initializeWebSocket, getWebSocketService } from './services/websocket.service';
import { LLMLoggingService } from './services/llm-logging.service';

// Override console methods to use Winston logger
overrideConsole();

// Fallback to file store if Redis is unavailable
const FileStore = require('session-file-store')(session);

dotenv.config({ path: '../.env' });
console.log('🔐 SESSION_SECRET loaded:', process.env.SESSION_SECRET ? 'Yes' : 'No');
console.log('🚀 About to initialize logger...');
logger.info('🚀 Starting Spotify Claude Controller server...');
console.log('✅ Logger initialized, continuing server setup...');

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server for both Express and WebSocket
const httpServer = createServer(app);

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
      
      // Initialize Redis client for LLM logs
      setRedisClientForLogs(redisClient);
      
      // Initialize Redis client for direct actions
      setDirectActionRedisClient(redisClient);
      
      // Initialize Redis client for feedback
      setFeedbackRedisClient(redisClient);
      
      // Initialize Redis client for new auth system
      setAuthRedisClient(redisClient);
      setSessionAuthRedisClient(redisClient);
      
      // Initialize Redis client for playlist discovery
      setPlaylistDiscoveryRedisClient(redisClient);
      
      // Initialize logging service for playlist discovery
      const playlistDiscoveryLoggingService = new LLMLoggingService(redisClient);
      setPlaylistDiscoveryLoggingService(playlistDiscoveryLoggingService);
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'sentry-trace', 'baggage'],
  exposedHeaders: ['set-cookie']
}));

app.use(express.json());
app.use(cookieParser());

// Track server readiness
let isServerReady = false;

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
        maxAge: 2592000000, // 30 days (same as Redis TTL)
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site in production
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? '.fly.dev' : undefined // Share across subdomains
      },
      name: 'spotify_session'
    }));

    // Add Sentry user context middleware (after session, before routes)
    app.use(setSentryUserContext);

    // Initialize WebSocket service with Redis client for authentication
    const webSocketService = initializeWebSocket(httpServer, allowedOrigins, redisClient);

    // New auth system (Phase 2 implementation)
    app.use('/api/auth', authRouter);
    app.use('/api/control', controlRouter);
    app.use('/api/web-player', webPlayerRouter);
    
    // Use flexible LLM interpreter by default (production-ready) 
    app.use('/api/llm/simple', simpleLLMInterpreterRouter);
    // Keep schema-based interpreter available at /api/llm
    app.use('/api/llm', llmInterpreterRouter);
    // Keep legacy endpoints for backwards compatibility
    app.use('/api/claude', simpleLLMInterpreterRouter);
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
    
    // Weather route
    app.use('/api/weather', weatherRouter);
    // User data endpoints
    app.use('/api/user-data', userDataRouter);
    // LLM logs endpoints
    app.use(llmLogsRouter);
    // Direct action endpoints (for bypassing LLM)
    app.use('/api/direct', directActionRouter);
    // AI feedback endpoints
    app.use('/api/feedback', feedbackRouter);
    // Song verification endpoint
    app.use('/api/songs', songVerificationRouter);
    // Debug token endpoint
    app.use('/api/debug', debugTokenRouter);
    // WebSocket health and stats endpoints
    app.use('/api/websocket', websocketRouter);
    // Playlist search endpoints
    app.use('/api/playlist-search', playlistSearchRouter);
    // LLM-powered playlist discovery endpoints
    app.use('/api/playlist-discovery', playlistDiscoveryRouter);
    // LLM test endpoints
    app.use('/api/llm/test', llmTestRouter);


    // IMPORTANT: The Sentry error handler must be registered before any other error middleware and after all controllers
    Sentry.setupExpressErrorHandler(app);

    // Optional fallthrough error handler
    app.use(function onError(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
      // The error id is attached to `res.sentry` to be returned
      // and optionally displayed to the user for support.
      console.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
        sentryId: (res as any).sentry
      });
    });

    // Determine client URL based on environment
    const clientUrl = process.env.CLIENT_URL || 'http://127.0.0.1:5173';

    // Redirect old callback to new auth callback endpoint
    app.get('/callback', (req, res) => {
      // Forward all query params to the new auth callback
      const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
      res.redirect(`/api/auth/callback?${queryString}`);
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
      // Return 503 if server is not ready yet
      if (!isServerReady) {
        return res.status(503).json({
          status: 'starting',
          timestamp: new Date().toISOString(),
          message: 'Server is starting up'
        });
      }

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

    // WebSocket health check endpoint
    app.get('/api/websocket/health', (req, res) => {
      const wsService = getWebSocketService();
      if (!wsService) {
        return res.status(503).json({ 
          status: 'unhealthy', 
          message: 'WebSocket service not initialized' 
        });
      }

      res.json({
        status: 'healthy',
        connections: wsService.getConnectionCount(),
        connectionsByIP: Object.fromEntries(wsService.getConnectionsByIP()),
        timestamp: Date.now()
      });
    });

    // Start the server
    // Listen on all interfaces to ensure both localhost and 127.0.0.1 work
    const host = '0.0.0.0';
    const port = typeof PORT === 'string' ? parseInt(PORT) : PORT;
    const server = httpServer.listen(port, host, () => {
      const displayHost = process.env.NODE_ENV === 'production' ? host : 'localhost';
      console.log(`🎵 Spotify Controller server running on http://${displayHost}:${port}`);
      console.log(`🤖 Ready to receive commands!`);
      console.log(`📦 Session storage: ${redisClient ? 'Redis' : 'File-based'}`);
      console.log(`🔌 WebSocket service available at ws://${displayHost}:${port}/demo`);
      
      // Mark server as ready after a short delay to ensure full initialization
      setTimeout(() => {
        isServerReady = true;
        console.log(`✅ Server is fully ready to accept requests`);
      }, 100);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📡 Received SIGTERM, shutting down gracefully');
  
  const wsService = getWebSocketService();
  if (wsService) {
    wsService.shutdown();
    console.log('✅ WebSocket service shut down');
  }
  
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
  
  const wsService = getWebSocketService();
  if (wsService) {
    wsService.shutdown();
    console.log('✅ WebSocket service shut down');
  }
  
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