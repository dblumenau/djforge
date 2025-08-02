# CLAUDE.md - Types

This directory contains TypeScript type definitions and interfaces used throughout the server application.

## Type Files

### websocket.types.ts
- **Purpose**: WebSocket/Socket.IO type definitions for real-time communication
- **Key Interfaces**:
  - `ServerToClientEvents` - Events emitted from server to client
    - `randomString`: Periodic random string broadcasts
    - `connectionStatus`: Connection state updates
    - `error`: Error notifications
  - `ClientToServerEvents` - Events emitted from client to server
    - `ping`: Ping request with callback acknowledgment
  - `SocketData` - Per-socket session data
    - `connectionTime`: Connection timestamp
    - `pingCount`: Number of pings from this client
    - `ipAddress`: Client IP address
  - `WebSocketConfig` - Service configuration options
    - `namespace`: Socket.IO namespace (default: '/demo')
    - `corsOrigins`: Allowed CORS origins
    - `maxPingsPerClient`: Rate limiting for pings
    - `maxConnectionsPerIP`: Connection rate limiting
    - `randomStringInterval`: Broadcast interval range
- **Usage**: Ensures type safety across WebSocket service and client communications

### spotify.types.ts
- **Purpose**: Spotify Web API response types and interfaces
- **Key Types**:
  - Track, Artist, Album structures
  - Playback state interfaces
  - User profile types
  - Pagination interfaces
  - Error response formats

### llm.types.ts
- **Purpose**: LLM provider request/response types
- **Includes**:
  - OpenRouter API types
  - Gemini Direct API types
  - Command interpretation interfaces
  - Confidence scoring types

### user.types.ts
- **Purpose**: User-related data structures
- **Covers**:
  - User session data
  - Taste profile structures
  - AI feedback types
  - Conversation history types

### redis.types.ts
- **Purpose**: Redis data structure types
- **Defines**:
  - Cache entry formats
  - Key naming patterns
  - TTL configurations

## Type Safety Best Practices

### Strict Type Checking
- All TypeScript files use strict mode
- No implicit `any` types allowed
- Explicit return types for all functions

### Interface Naming
- Interfaces prefixed with `I` (e.g., `IUserProfile`)
- Type aliases for unions and complex types
- Enum usage for fixed value sets

### Import/Export Patterns
```typescript
// Export individual types
export interface IWebSocketMessage { ... }
export type ConnectionState = 'connected' | 'disconnected';

// Namespace exports for grouped types
export namespace SpotifyAPI {
  export interface Track { ... }
  export interface Artist { ... }
}
```

### Generic Types
- Used for reusable patterns (pagination, API responses)
- Example:
  ```typescript
  interface PaginatedResponse<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
  }
  ```

## Adding New Types

1. Create appropriately named `.ts` file
2. Use clear, descriptive interface names
3. Document complex types with JSDoc comments
4. Export from main `index.ts` barrel file
5. Consider namespace grouping for related types
6. Add to this documentation

## Type Validation

- Runtime validation using Zod for external API responses
- Compile-time checking with TypeScript
- Type guards for runtime type narrowing
- Assertion functions for critical validations