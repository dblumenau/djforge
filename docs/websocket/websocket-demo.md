# WebSocket Implementation Plan with Socket.IO

## Overview
Implement a WebSocket solution using Socket.IO v4 for real-time bidirectional communication. This MVP will be authentication-free to avoid the SSE issues previously encountered, with a dedicated demo page showing real-time updates.

## Technology Stack
- **Socket.IO v4** - Industry standard for WebSocket with fallback support
- **TypeScript** - Full type safety across client and server
- **React Hook** - Clean integration pattern for React components
- **Express Integration** - Attach to existing HTTP server

## Implementation Steps

### 1. Backend Implementation (server/)

#### 1.1 Install Dependencies
```bash
cd server && npm install socket.io @socket.io/redis-adapter
```

#### 1.2 Create Type Definitions (`server/src/types/websocket.types.ts`)
```typescript
export interface ServerToClientEvents {
  randomString: (data: { value: string; timestamp: number }) => void;
  connectionStatus: (status: 'connected' | 'disconnected') => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  ping: (callback: (response: { status: 'ok'; timestamp: number }) => void) => void;
}

export interface SocketData {
  connectionTime: number;
  pingCount: number;
}
```

#### 1.3 Create WebSocket Service (`server/src/services/websocket.service.ts`)
- Initialize Socket.IO with proper TypeScript types
- Use `/demo` namespace for isolation
- Implement connection rate limiting by IP
- Random string generator (10 chars, alphanumeric)
- Emit every 5-15 seconds (random interval)
- Log all events to console with winston logger
- Proper cleanup on disconnect

#### 1.4 Integrate with Express (modify `server/src/server.ts`)
- Initialize WebSocket service after session setup
- Pass the HTTP server instance (critical!)
- Configure CORS to match existing allowedOrigins array
- Add health check endpoint at `/api/websocket/health`

### 2. Frontend Implementation (client/)

#### 2.1 Install Dependencies
```bash
cd client && npm install socket.io-client
```

#### 2.2 Create Singleton Socket Instance (`client/src/services/socket.ts`)
```typescript
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../../server/src/types/websocket.types';

const URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:4001';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(`${URL}/demo`, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

#### 2.3 Create WebSocket Hook (`client/src/hooks/useWebSocket.ts`)
- Connect/disconnect lifecycle management
- Event listener registration with cleanup
- Connection status tracking
- Message history state management
- Prevent multiple connections (singleton pattern)

#### 2.4 Create Demo Page (`client/src/pages/WebSocketDemo.tsx`)
- Centered box with glassmorphism effect matching existing design
- Connection status indicator (green/red dot)
- Scrollable message history with timestamps
- Show reconnection attempts if disconnected
- "Ping Server" button for testing
- Smooth animations for new messages

#### 2.5 Add Route (modify `client/src/App.tsx`)
- Add route at `/websocket-demo`
- No auth checks required
- Place within AppLayout for consistent navigation

### 3. Best Practices Implementation

#### 3.1 Security (Even Without Auth)
- Rate limiting: Max 10 connections per IP per minute
- Input validation on all client events
- Disconnect clients exceeding 100 pings
- Use `/demo` namespace to isolate from future features

#### 3.2 Performance Optimizations
- Single shared interval timer for all clients (not per-client)
- Connection pooling on client (singleton pattern)
- Skip polling transport if WebSocket works
- Batch messages if scaling beyond MVP

#### 3.3 Error Handling
- Graceful degradation if WebSocket unavailable
- Clear error messages in UI
- Automatic reconnection with exponential backoff
- Log all errors with context

#### 3.4 Development Experience
- Full TypeScript types shared between client/server
- Structured logging with winston
- Environment-based configuration
- Clear console output for debugging

### 4. Testing Strategy

#### 4.1 Backend Tests (`server/src/services/__tests__/websocket.service.test.ts`)
- Integration test with real Socket.IO client
- Test connection/disconnection
- Test random string emission
- Test ping/pong with acknowledgment
- Test rate limiting

#### 4.2 Frontend Tests
- Component testing for WebSocketDemo
- Test connection status updates
- Test message display

### 5. File Structure
```
server/
  src/
    services/
      websocket.service.ts       # Main WebSocket service
      __tests__/
        websocket.service.test.ts
    types/
      websocket.types.ts         # Shared type definitions
      
client/
  src/
    services/
      socket.ts                  # Singleton socket instance
    hooks/
      useWebSocket.ts           # React hook for WebSocket
    pages/
      WebSocketDemo.tsx         # Demo page component
    types/
      websocket.types.ts        # Import from server types
```

### 6. Future Considerations (Post-MVP)
- Add Redis adapter for horizontal scaling
- Implement authentication once patterns established
- Add rooms for user-specific channels
- Consider message persistence
- Add metrics collection

## Key Points from Expert Feedback Incorporated:
✅ Server instance management - Pass HTTP server to Socket.IO  
✅ CORS configuration - Separate Socket.IO CORS config  
✅ Memory leak prevention - Cleanup on disconnect  
✅ React singleton pattern - Prevent multiple connections  
✅ Namespace isolation - Use `/demo` namespace  
✅ Rate limiting - Even without auth  
✅ TypeScript best practices - Full type safety  
✅ Testing strategy - Integration and unit tests  
✅ Error boundaries - Graceful error handling  
✅ Monitoring - Health check endpoint  

This plan avoids the SSE authentication loops by starting fresh with Socket.IO, provides a clean MVP implementation, and sets up patterns for future scaling.