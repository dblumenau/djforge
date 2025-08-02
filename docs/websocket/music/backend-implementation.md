# Backend WebSocket Implementation Plan

## Overview
This document covers the backend implementation for WebSocket integration to enable real-time communication between the server and client when Spotify actions are triggered through LLM commands or direct controls.

## Phase 1: WebSocket Infrastructure Setup

### 1.1 Extend WebSocket Types
**File**: `/server/src/types/websocket.types.ts`

Add new interfaces for music namespace events:
```typescript
// Add to ServerToClientEvents
interface ServerToClientEvents {
  // Existing events...
  
  // Music namespace events
  playbackStateChanged: (data: {
    isPlaying: boolean;
    track: SpotifyTrack | null;
    position: number;
    duration: number;
    device: string;
    shuffleState: boolean;
    repeatState: 'off' | 'track' | 'context';
    volume: number;
    timestamp: number;
  }) => void;
  
  trackChanged: (data: {
    previous: SpotifyTrack | null;
    current: SpotifyTrack;
    source: 'user' | 'ai' | 'auto';
    reasoning?: string;
    isAIDiscovery?: boolean;
    timestamp: number;
  }) => void;
  
  queueUpdated: (data: {
    action: 'added' | 'removed' | 'cleared';
    tracks?: SpotifyTrack[];
    trackUris?: string[];
    totalItems: number;
    source: 'user' | 'ai';
    timestamp: number;
  }) => void;
  
  volumeChanged: (data: {
    volume: number;
    device: string;
    timestamp: number;
  }) => void;
  
  commandExecuted: (data: {
    command: string;
    intent: string;
    success: boolean;
    confidence: number;
    result?: any;
    error?: string;
    timestamp: number;
  }) => void;
  
  deviceChanged: (data: {
    previousDevice: string | null;
    currentDevice: string;
    timestamp: number;
  }) => void;
}

// Add to ClientToServerEvents
interface ClientToServerEvents {
  // Existing events...
  
  // Music namespace events
  subscribeToPlayback: (callback: (response: { status: string }) => void) => void;
  unsubscribeFromPlayback: (callback: (response: { status: string }) => void) => void;
  requestPlaybackSync: (callback: (response: { playbackState: any }) => void) => void;
}
```

### 1.2 Create Music WebSocket Service
**New File**: `/server/src/services/musicWebSocket.service.ts`

```typescript
import { Server as SocketIOServer, Namespace } from 'socket.io';
import { WebSocketAuth } from '../auth/websocket-auth';
import winston from 'winston';

export class MusicWebSocketService {
  private namespace: Namespace;
  private wsAuth: WebSocketAuth | null;
  private logger: winston.Logger;
  private userSubscriptions: Map<string, Set<string>>; // userId -> socketIds
  
  constructor(io: SocketIOServer, redisClient?: any) {
    this.namespace = io.of('/music');
    this.userSubscriptions = new Map();
    // Initialize auth and logger
    // Set up namespace middleware and handlers
  }
  
  // Emit playback state change to specific user
  public emitPlaybackStateChange(userId: string, data: any): void {
    const sockets = this.userSubscriptions.get(userId);
    if (sockets) {
      sockets.forEach(socketId => {
        this.namespace.to(socketId).emit('playbackStateChanged', data);
      });
    }
  }
  
  // Emit track change to specific user
  public emitTrackChange(userId: string, data: any): void {
    // Implementation
  }
  
  // Emit queue update to specific user
  public emitQueueUpdate(userId: string, data: any): void {
    // Implementation
  }
  
  // Emit command execution result
  public emitCommandExecuted(userId: string, data: any): void {
    // Implementation
  }
}
```

### 1.3 Extend Main WebSocket Service
**File**: `/server/src/services/websocket.service.ts`

Add music namespace initialization:
```typescript
import { MusicWebSocketService } from './musicWebSocket.service';

export class WebSocketService {
  // Existing code...
  private musicService: MusicWebSocketService | null = null;
  
  constructor(httpServer: HTTPServer, corsOrigins?: string[], redisClient?: any) {
    // Existing initialization...
    
    // Initialize music WebSocket service
    this.musicService = new MusicWebSocketService(this.io, redisClient);
  }
  
  // Getter for music service
  public getMusicService(): MusicWebSocketService | null {
    return this.musicService;
  }
}
```

## Phase 2: Integration Points

### 2.1 LLM Command Handler Integration
**File**: `/server/src/routes/simple-llm-interpreter.ts`

Add WebSocket emissions after successful Spotify actions:

```typescript
import { getWebSocketService } from '../services/websocket.service';

// After successful play action
if (interpretation.intent === 'play_specific_song') {
  const result = await spotifyControl.play(/* params */);
  
  if (result.success) {
    // Emit WebSocket event
    const wsService = getWebSocketService();
    const musicService = wsService?.getMusicService();
    
    if (musicService && userId) {
      // Get current playback state
      const playbackState = await spotifyControl.getCurrentPlayback();
      
      musicService.emitTrackChange(userId, {
        previous: previousTrack,
        current: playbackState.track,
        source: 'ai',
        reasoning: interpretation.aiReasoning,
        isAIDiscovery: interpretation.isAIDiscovery,
        timestamp: Date.now()
      });
      
      musicService.emitPlaybackStateChange(userId, {
        ...playbackState,
        timestamp: Date.now()
      });
    }
  }
}

// After queue operations
if (interpretation.intent === 'queue_multiple_songs') {
  const tracks = await spotifyControl.queueMultiple(/* params */);
  
  if (tracks.length > 0) {
    const musicService = getWebSocketService()?.getMusicService();
    
    if (musicService && userId) {
      musicService.emitQueueUpdate(userId, {
        action: 'added',
        tracks: tracks,
        totalItems: tracks.length,
        source: 'ai',
        timestamp: Date.now()
      });
    }
  }
}

// Emit command execution status
const musicService = getWebSocketService()?.getMusicService();
if (musicService && userId) {
  musicService.emitCommandExecuted(userId, {
    command: command,
    intent: interpretation.intent,
    success: result.success,
    confidence: interpretation.confidence,
    result: result.data,
    error: result.error,
    timestamp: Date.now()
  });
}
```

### 2.2 Control Routes Integration
**File**: `/server/src/routes/control.ts`

Add WebSocket emissions for direct control actions:

```typescript
// In play/pause endpoints
router.post('/play', requireValidTokens, async (req, res) => {
  const result = await spotifyControl.play();
  
  if (result.success) {
    const musicService = getWebSocketService()?.getMusicService();
    if (musicService && req.userId) {
      const playbackState = await spotifyControl.getCurrentPlayback();
      musicService.emitPlaybackStateChange(req.userId, {
        ...playbackState,
        timestamp: Date.now()
      });
    }
  }
  
  res.json(result);
});

// In skip endpoint
router.post('/next', requireValidTokens, async (req, res) => {
  const previousTrack = await spotifyControl.getCurrentTrack();
  const result = await spotifyControl.skip();
  
  if (result.success) {
    const musicService = getWebSocketService()?.getMusicService();
    if (musicService && req.userId) {
      const currentTrack = await spotifyControl.getCurrentTrack();
      
      musicService.emitTrackChange(req.userId, {
        previous: previousTrack,
        current: currentTrack,
        source: 'user',
        timestamp: Date.now()
      });
    }
  }
  
  res.json(result);
});

// In volume endpoint
router.post('/volume', requireValidTokens, async (req, res) => {
  const { volume } = req.body;
  const result = await spotifyControl.setVolume(volume);
  
  if (result.success) {
    const musicService = getWebSocketService()?.getMusicService();
    if (musicService && req.userId) {
      musicService.emitVolumeChanged(req.userId, {
        volume: volume,
        device: result.device,
        timestamp: Date.now()
      });
    }
  }
  
  res.json(result);
});
```

### 2.3 Add WebSocket Health Endpoint
**File**: `/server/src/routes/websocket.ts` (new file)

```typescript
import { Router } from 'express';
import { getWebSocketService } from '../services/websocket.service';

export const websocketRouter = Router();

// Health check for music WebSocket
websocketRouter.get('/health/music', (req, res) => {
  const wsService = getWebSocketService();
  const musicService = wsService?.getMusicService();
  
  if (!musicService) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Music WebSocket service not initialized'
    });
  }
  
  res.json({
    status: 'healthy',
    connections: musicService.getConnectionCount(),
    subscriptions: musicService.getSubscriptionCount(),
    uptime: process.uptime()
  });
});
```

## Phase 3: Authentication & Security

### 3.1 Session Validation
Ensure all music namespace connections are authenticated:
- Validate session ID from handshake auth
- Check Redis for valid session
- Track user-to-socket mappings
- Clean up on disconnect

### 3.2 Rate Limiting
Implement rate limiting for music namespace:
- Max events per user per minute
- Throttle high-frequency updates
- Queue events if necessary

## Phase 4: Error Handling & Recovery

### 4.1 Graceful Degradation
- If WebSocket unavailable, system continues with polling
- Log WebSocket failures for monitoring
- Automatic reconnection attempts

### 4.2 Event Buffering
- Buffer events if user temporarily disconnected
- Replay missed events on reconnection (with limit)
- Clear old buffers periodically

## Testing Requirements

### Unit Tests
1. Test event emission functions
2. Test authentication middleware
3. Test rate limiting
4. Test error scenarios

### Integration Tests
1. Test LLM command → WebSocket event flow
2. Test direct control → WebSocket event flow
3. Test multi-user isolation
4. Test reconnection scenarios

### Load Tests
1. Test with 100+ concurrent connections
2. Test event throughput
3. Test memory usage under load

## Monitoring & Logging

### Metrics to Track
- Active connections count
- Events emitted per minute
- Failed authentication attempts
- Average event latency
- Memory usage

### Logging
- Log all connection/disconnection events
- Log authentication failures
- Log event emission with user context
- Log errors with full stack traces

## Deployment Considerations

### Environment Variables
```bash
# Add to .env
WEBSOCKET_MUSIC_ENABLED=true
WEBSOCKET_MUSIC_MAX_CONNECTIONS_PER_USER=5
WEBSOCKET_MUSIC_EVENT_RATE_LIMIT=100
WEBSOCKET_MUSIC_BUFFER_SIZE=50
```

### Redis Keys
```
music:ws:user:{userId}:sockets - Set of socket IDs for user
music:ws:socket:{socketId}:user - User ID for socket
music:ws:user:{userId}:buffer - Event buffer for disconnected user
music:ws:stats:connections - Current connection count
music:ws:stats:events - Event emission stats
```

## Success Criteria

1. ✅ WebSocket events emit within 100ms of Spotify action
2. ✅ All authenticated users can connect to music namespace
3. ✅ Events are user-isolated (no cross-user leakage)
4. ✅ System gracefully handles WebSocket failures
5. ✅ No increase in server memory usage > 10%
6. ✅ Load test passes with 100+ concurrent users

## Timeline

- **Day 1**: Implement basic infrastructure (1.1, 1.2, 1.3)
- **Day 2**: Add integration points (2.1, 2.2, 2.3)
- **Day 3**: Implement auth & security (3.1, 3.2)
- **Day 4**: Add error handling & testing
- **Day 5**: Deploy and monitor

## Notes for Frontend Team

The backend will emit the following events that frontend should listen for:
- `playbackStateChanged` - Full playback state update
- `trackChanged` - Track transition with metadata
- `queueUpdated` - Queue modifications
- `volumeChanged` - Volume adjustments
- `commandExecuted` - Command execution results
- `deviceChanged` - Active device changes

All events include timestamps for synchronization and source attribution (user/ai/auto).