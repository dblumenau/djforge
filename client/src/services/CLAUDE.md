# CLAUDE.md - Client Services

This directory contains service modules that handle external communications, API interactions, and shared functionality for the React application.

## Service Files

### socket.ts
- **Primary Purpose**: Socket.IO client configuration and management
- **Key Features**:
  - **Authentication**: Automatically sends session ID from localStorage
  - Singleton socket instance for entire application
  - Namespace-based connection to `/demo` endpoint
  - Automatic reconnection with exponential backoff
  - Transport fallback (WebSocket → Polling)
  - TypeScript types for all events
- **Authentication Flow**:
  1. Retrieves session ID from `localStorage.getItem('spotify_session_id')`
  2. Sends session ID in auth object during connection handshake
  3. Server validates session via Redis
  4. Connection rejected if session invalid or missing
- **Configuration**:
  - Auto-connect disabled (managed by hooks)
  - 5 reconnection attempts max
  - 1-5 second reconnection delay
  - 20 second connection timeout
- **Exported Functions**:
  - `socket` - The Socket.IO instance
  - `isSocketConnected()` - Check connection status
  - `getSocketId()` - Get current socket ID
  - `getTransport()` - Get current transport type
  - `updateSocketAuth()` - Update auth and reconnect with new session

### auth.service.ts
- **Primary Purpose**: Authentication and session management
- **Key Features**:
  - Login/logout functionality
  - Session token storage in localStorage
  - User profile management
  - Token refresh handling
  - Authentication state checking
- **LocalStorage Keys**:
  - `spotify_session_id` - Current session ID
  - `spotify_user` - Cached user profile
- **API Endpoints**:
  - `/auth/login` - Initiate OAuth flow
  - `/auth/logout` - Clear session
  - `/auth/status` - Check auth status
  - `/auth/refresh` - Refresh tokens

### spotify-client.ts
- **Primary Purpose**: Spotify API client wrapper
- **Key Features**:
  - Authenticated API requests
  - Automatic token refresh on 401
  - Error handling and retry logic
  - TypeScript interfaces for responses
- **Common Methods**:
  - `getCurrentPlayback()` - Get playback state
  - `searchTracks()` - Search Spotify catalog
  - `play()`, `pause()`, `skip()` - Playback control
  - `getUserProfile()` - Get user data

### spotifyWebApi.service.ts
- **Primary Purpose**: Spotify Web API SDK integration
- **Key Features**:
  - Web Playback SDK initialization
  - Player device management
  - Playback state synchronization
  - Volume and track control
- **SDK Events**:
  - `ready` - Player ready with device ID
  - `player_state_changed` - Track/playback updates
  - `initialization_error` - Setup failures
  - `authentication_error` - Token issues

### webPlayer.service.ts
- **Primary Purpose**: Web Playback SDK wrapper
- **Key Features**:
  - Browser-based Spotify player
  - Device registration and activation
  - Playback state management
  - Error recovery and reconnection
- **Requirements**:
  - Premium Spotify account
  - Supported browser (Chrome, Firefox, Edge)
  - Valid access token with `streaming` scope

## Service Patterns

### Singleton Pattern
- Socket.IO client uses singleton pattern
- Single WebSocket connection for entire app
- Shared across all components via hooks

### Authentication Headers
```typescript
const headers = {
  'Authorization': `Bearer ${sessionId}`,
  'Content-Type': 'application/json'
};
```

### Error Handling
```typescript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    if (response.status === 401) {
      // Trigger token refresh
      await refreshToken();
      // Retry request
    }
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
} catch (error) {
  console.error('Service error:', error);
  throw error;
}
```

### WebSocket Authentication
```typescript
// Automatic auth in socket.ts
auth: (cb) => {
  const sessionId = getSessionId();
  cb({ sessionId });
}

// Manual update when session changes
export const updateSocketAuth = (): void => {
  const sessionId = getSessionId();
  socket.auth = { sessionId };
  
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
};
```

## Environment Configuration

### Development
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001';
const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:4001';
```

### Production
```typescript
const API_URL = window.location.origin;
const WS_URL = window.location.origin;
```

## Testing Services

### Mocking Socket.IO
```typescript
jest.mock('../services/socket', () => ({
  socket: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connected: false
  },
  isSocketConnected: jest.fn(() => false),
  updateSocketAuth: jest.fn()
}));
```

### Mocking API Calls
```typescript
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockData)
  })
);
```

## Security Considerations

### Session Management
- Session IDs stored in localStorage
- Cleared on logout
- Validated server-side for every request
- WebSocket connections require valid session

### CORS
- Configured origins for API and WebSocket
- Credentials included for cross-origin requests

### Token Security
- Access tokens never stored in localStorage
- Only session ID stored client-side
- Tokens managed server-side in Redis
- Automatic refresh before expiration

## Performance Optimization

### Connection Management
- Single WebSocket connection shared app-wide
- Automatic reconnection with backoff
- Connection state tracked in hooks
- Cleanup on component unmount

### Request Caching
- Response caching where appropriate
- Debounced search requests
- Batched API calls when possible

### Error Recovery
- Automatic retry with exponential backoff
- Graceful degradation on service failure
- User-friendly error messages