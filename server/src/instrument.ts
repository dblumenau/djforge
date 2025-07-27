import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

Sentry.init({
  dsn: process.env.SENTRY_DSN_SERVER || "https://18505a4fbecc87e3b465673e827b4cae@o4509741045579776.ingest.de.sentry.io/4509741295009872",
  environment: process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE || 'spotify-claude-controller@dev',
  integrations: [
    nodeProfilingIntegration(),
    // HTTP integration is automatically added
    Sentry.httpIntegration({
      // Enable distributed tracing
      instrumenter: 'sentry',
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
    console.log('🔍 Sentry beforeSend called:', {
      eventId: event.event_id,
      message: event.message,
      exception: event.exception?.values?.[0]?.value,
      environment: event.environment,
      release: event.release,
    });
    
    // Log what we're returning
    console.log('🔍 Sentry: Sending event to Sentry');
    
    // Don't send certain errors in development
    if (process.env.NODE_ENV === 'development') {
      const error = hint.originalException;
      // Skip ECONNREFUSED errors (common in dev when services aren't running)
      if (error && typeof error === 'object' && 'message' in error && 
          typeof error.message === 'string' && error.message.includes('ECONNREFUSED')) {
        console.log('🔍 Sentry: Skipping ECONNREFUSED error');
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