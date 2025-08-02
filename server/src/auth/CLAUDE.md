# CLAUDE.md - Authentication Services

This directory contains authentication-related services for session management, Spotify OAuth, and WebSocket authentication.

## Service Files

### spotify-auth.service.ts
- **Primary Purpose**: Spotify OAuth authentication and token management
- **Key Features**:
  - OAuth 2.0 authorization code flow
  - Automatic token refresh with race condition prevention
  - Session creation and management
  - User profile retrieval
- **OAuth Endpoints**:
  - `/auth/login` - Initiates OAuth flow
  - `/auth/callback` - Handles OAuth callback
  - `/auth/refresh` - Refreshes access tokens
  - `/auth/logout` - Clears session

### session-manager.ts
- **Primary Purpose**: Redis-backed session management
- **Key Features**:
  - Creates and validates user sessions
  - Stores sessions in Redis with no expiration (permanent sessions)
  - Manages session lifecycle (create, get, delete)
  - Provides session validation for API endpoints
- **Session Structure**:
  ```typescript
  {
    id: string;              // Unique session ID
    userId: string;          // Spotify user ID
    accessToken: string;     // Spotify access token
    refreshToken: string;    // Spotify refresh token
    expiresAt: number;       // Token expiration timestamp
    createdAt: number;       // Session creation timestamp
  }
  ```
- **Redis Keys**:
  - `session:{sessionId}` - Individual session data
  - `user:{userId}:sessions` - Set of session IDs per user

### session-storage-strategy.ts
- **Primary Purpose**: Abstraction layer for session storage
- **Key Features**:
  - Strategy pattern for different storage backends
  - Redis storage with automatic fallback
  - In-memory storage for development/testing
  - Consistent interface regardless of backend

### websocket-auth.ts
- **Primary Purpose**: WebSocket connection authentication
- **Key Features**:
  - Validates session tokens for Socket.IO connections
  - Integrates with SessionManager for Redis validation
  - Extracts session ID from socket handshake (auth object or query params)
  - Returns authenticated user information for valid sessions
- **Authentication Flow**:
  1. Client connects to WebSocket with session ID in auth object
  2. WebSocketAuth extracts session ID from handshake
  3. Session is validated against Redis
  4. If valid, user info is attached to socket data
  5. If invalid, connection is rejected with error
- **Methods**:
  - `validateSession(sessionId)` - Validates session and returns user info
  - `extractSessionId(socket)` - Extracts session ID from socket handshake
- **Security Notes**:
  - Sessions are permanent (no expiry) as long as they exist in Redis
  - Invalid or missing sessions result in connection rejection
  - User ID is tracked for per-user connection limits

## Authentication Patterns

### Session-Based Authentication
- All API endpoints use session-based authentication
- Sessions stored in Redis for scalability
- Session ID sent as Bearer token in Authorization header
- Middleware validates session before processing requests

### WebSocket Authentication
- WebSocket connections require valid session ID
- Session validated during connection handshake
- Authenticated connections tracked per user
- Supports both auth object and query parameter methods

### Token Management
- Spotify access tokens auto-refresh when expired
- Refresh tokens are reusable (not single-use)
- Token refresh has built-in race condition prevention
- Tokens stored encrypted in Redis sessions

## Security Considerations

### Session Security
- Session IDs are cryptographically random UUIDs
- Sessions stored server-side in Redis
- No sensitive data in client-side storage
- HTTPS required in production

### Rate Limiting
- WebSocket connections limited per IP (10 max)
- WebSocket connections tracked per user
- API endpoints have request rate limits
- Failed auth attempts are logged

### CORS Configuration
- Strict CORS policies for API endpoints
- WebSocket CORS configured for allowed origins
- Credentials required for cross-origin requests

## Error Handling

### Common Auth Errors
- `401 Unauthorized` - Invalid or missing session
- `403 Forbidden` - Valid session but insufficient permissions
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Redis connection issues

### WebSocket Auth Errors
- `Authentication required` - No session ID provided
- `Invalid session` - Session not found or invalid
- `Too many connections` - Connection limit exceeded

## Testing Authentication

### Manual Testing
1. Login flow: `/auth/login`
2. Check session: `/auth/status`
3. Test WebSocket: Connect to `/demo` namespace with session ID
4. Logout: `/auth/logout`

### Automated Testing
- Unit tests for session manager
- Integration tests for OAuth flow
- WebSocket connection tests with mock sessions
- Rate limiting tests

## Redis Dependency

All authentication services depend on Redis for:
- Session storage and validation
- User-to-session mapping
- Connection tracking
- Rate limiting counters

If Redis is unavailable:
- New logins will fail
- Existing sessions cannot be validated
- WebSocket connections will be rejected (unless in dev mode without auth)
- File-based fallback only for development