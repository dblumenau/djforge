import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

Sentry.init({
  dsn: process.env.SENTRY_DSN_SERVER || "https://6c213e177c0499ba964211308733917c@o4509741045579776.ingest.de.sentry.io/4509741047611472",
  environment: process.env.NODE_ENV || 'development',
  integrations: [
    nodeProfilingIntegration(),
    // HTTP integration is automatically added
    Sentry.httpIntegration({
      tracing: true,
    }),
    // Express integration will be added automatically when setupExpressErrorHandler is called
  ],
  // Tracing
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0, // 20% in production, 100% in development
  // Set sampling rate for profiling
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5, // 10% in production, 50% in development
  
  // Setting this option to true will send default PII data to Sentry
  sendDefaultPii: true,
  
  // Additional options
  beforeSend(event, hint) {
    // Don't send certain errors in development
    if (process.env.NODE_ENV === 'development') {
      const error = hint.originalException;
      // Skip ECONNREFUSED errors (common in dev when services aren't running)
      if (error?.message?.includes('ECONNREFUSED')) {
        return null;
      }
    }
    
    // Add server-specific context
    if (event.contexts) {
      event.contexts.app = {
        ...event.contexts.app,
        app_memory: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        uptime: process.uptime(),
      };
    }
    
    return event;
  },
  
  // Integrations configuration
  ignoreErrors: [
    // Ignore specific errors that are expected
    'TokenExpiredError', // We handle token refresh
    'SpotifyWebApiError: No active device found', // Common when Spotify isn't playing
  ],
  
  // Server name to help identify which server instance
  serverName: process.env.FLY_REGION || 'local',
});

// Profiling is enabled automatically with the nodeProfilingIntegration
console.log(`🔍 Sentry initialized for ${process.env.NODE_ENV || 'development'} environment`);