import * as Sentry from "@sentry/react";
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

// Initialize Sentry
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "https://cf410304d6c0e9f558cf1a1df9d31789@o4509741045579776.ingest.de.sentry.io/4509741102727248",
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE || 'spotify-claude-controller@dev',
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration({
      // Enable navigation instrumentation
      enableInp: true,
      enableLongTask: true,
      // Configure fetch instrumentation carefully
      instrumentPageLoad: true,
      instrumentNavigation: true,
      // Don't add sentry-trace headers to requests by default
      shouldCreateSpanForRequest: (url) => {
        // Only create spans for your API requests
        const urlString = typeof url === 'string' ? url : String(url);
        return urlString.includes('127.0.0.1:4001') || urlString.includes('localhost:4001');
      },
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    })
  ],
  // Tracing
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.2 : 1.0, // 20% in production, 100% in development
  // IMPORTANT: Only add trace headers to your own backend
  tracePropagationTargets: [
    /^http:\/\/localhost:4001/,
    /^http:\/\/127\.0\.0\.1:4001/,
    /^https:\/\/api\.djforge\.fly\.dev/
  ],
  // Session Replay
  replaysSessionSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0.5, // 10% in production, 50% in development
  replaysOnErrorSampleRate: 1.0, // Always capture replay on errors
  // Logs
  enableLogs: true,
  // Additional options
  beforeSend(event, hint) {
    // Filter out specific errors if needed
    if (event.exception) {
      const error = hint.originalException;
      // Don't send network errors in development
      if (import.meta.env.MODE === 'development' && 
          error && typeof error === 'object' && 'message' in error && 
          typeof error.message === 'string' && error.message.includes('Network request failed')) {
        return null;
      }
      // Don't send health check errors
      if (error && typeof error === 'object' && 'message' in error && 
          typeof error.message === 'string' && error.message.includes('/api/health')) {
        return null;
      }
    }
    return event;
  },
});

// Register service worker for PWA support (only in production)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Sentry.ErrorBoundary 
    fallback={({ error, resetError }) => (
      <div style={{ 
        padding: '2rem', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#fff'
      }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Oops! Something went wrong</h1>
        <p style={{ marginBottom: '1rem', color: '#aaa' }}>An error occurred while loading the application.</p>
        <details style={{ marginBottom: '1rem', maxWidth: '600px', width: '100%' }}>
          <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Error details</summary>
          <pre style={{ 
            backgroundColor: '#2a2a2a', 
            padding: '1rem', 
            borderRadius: '0.5rem',
            overflow: 'auto',
            fontSize: '0.875rem'
          }}>{error instanceof Error ? error.toString() : String(error)}</pre>
        </details>
        <button 
          onClick={resetError}
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#1DB954',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Try again
        </button>
      </div>
    )}
    showDialog
  >
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </Sentry.ErrorBoundary>
)