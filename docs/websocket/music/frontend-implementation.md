# Frontend WebSocket Implementation Plan

## Overview
This document covers the frontend implementation for WebSocket integration to receive real-time playback updates and synchronize the UI when the backend triggers Spotify actions.

## Phase 1: WebSocket Infrastructure Setup

### 1.1 Create Music Socket Service
**New File**: `/client/src/services/musicSocket.ts`

```typescript
import { io, Socket } from 'socket.io-client';
import type { MusicServerToClientEvents, MusicClientToServerEvents } from '../types/websocket.types';

// Get WebSocket URL (same as demo socket)
const getWebSocketURL = (): string => {
  if (import.meta.env.VITE_WEBSOCKET_URL) {
    return import.meta.env.VITE_WEBSOCKET_URL;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:4001';
};

const WEBSOCKET_URL = getWebSocketURL();
const NAMESPACE = '/music';

// Get session ID for auth
const getSessionId = (): string | null => {
  return localStorage.getItem('spotify_session_id');
};

// Create music socket instance (singleton)
export const musicSocket: Socket<MusicServerToClientEvents, MusicClientToServerEvents> = io(
  `${WEBSOCKET_URL}${NAMESPACE}`,
  {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    auth: (cb) => {
      const sessionId = getSessionId();
      cb({ sessionId });
    }
  }
);

// Utility functions
export const isMusicSocketConnected = (): boolean => musicSocket.connected;
export const getMusicSocketId = (): string | undefined => musicSocket.id;

// Update auth when session changes
export const updateMusicSocketAuth = (): void => {
  const sessionId = getSessionId();
  musicSocket.auth = { sessionId };
  
  if (musicSocket.connected) {
    musicSocket.disconnect();
    musicSocket.connect();
  }
};
```

### 1.2 Create Music WebSocket Types
**New File**: `/client/src/types/websocket.types.ts`

Add music-specific event types:
```typescript
import { SpotifyTrack } from './spotify.types';

// Events from server to client
export interface MusicServerToClientEvents {
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

// Events from client to server
export interface MusicClientToServerEvents {
  subscribeToPlayback: (callback: (response: { status: string }) => void) => void;
  unsubscribeFromPlayback: (callback: (response: { status: string }) => void) => void;
  requestPlaybackSync: (callback: (response: { playbackState: any }) => void) => void;
}
```

### 1.3 Create useMusicWebSocket Hook
**New File**: `/client/src/hooks/useMusicWebSocket.ts`

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
import { musicSocket, isMusicSocketConnected, updateMusicSocketAuth } from '../services/musicSocket';
import { useToast } from './useToast';

export interface PlaybackUpdate {
  type: 'state' | 'track' | 'queue' | 'volume' | 'device';
  data: any;
  timestamp: number;
}

export interface UseMusicWebSocketReturn {
  connected: boolean;
  lastUpdate: PlaybackUpdate | null;
  subscribeToPlayback: () => void;
  unsubscribeFromPlayback: () => void;
  requestSync: () => void;
}

export function useMusicWebSocket(
  onPlaybackStateChange?: (data: any) => void,
  onTrackChange?: (data: any) => void,
  onQueueUpdate?: (data: any) => void,
  onCommandExecuted?: (data: any) => void
): UseMusicWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<PlaybackUpdate | null>(null);
  const { showToast } = useToast();
  const hasSubscribed = useRef(false);
  
  // Subscribe to playback updates
  const subscribeToPlayback = useCallback(() => {
    if (musicSocket.connected && !hasSubscribed.current) {
      musicSocket.emit('subscribeToPlayback', (response) => {
        if (response.status === 'ok') {
          hasSubscribed.current = true;
          console.log('[Music WS] Subscribed to playback updates');
        }
      });
    }
  }, []);
  
  // Unsubscribe from playback updates
  const unsubscribeFromPlayback = useCallback(() => {
    if (musicSocket.connected && hasSubscribed.current) {
      musicSocket.emit('unsubscribeFromPlayback', (response) => {
        if (response.status === 'ok') {
          hasSubscribed.current = false;
          console.log('[Music WS] Unsubscribed from playback updates');
        }
      });
    }
  }, []);
  
  // Request immediate sync
  const requestSync = useCallback(() => {
    if (musicSocket.connected) {
      musicSocket.emit('requestPlaybackSync', (response) => {
        if (response.playbackState && onPlaybackStateChange) {
          onPlaybackStateChange(response.playbackState);
        }
      });
    }
  }, [onPlaybackStateChange]);
  
  useEffect(() => {
    // Connection handlers
    const handleConnect = () => {
      setConnected(true);
      subscribeToPlayback();
    };
    
    const handleDisconnect = () => {
      setConnected(false);
      hasSubscribed.current = false;
    };
    
    // Playback event handlers
    const handlePlaybackStateChange = (data: any) => {
      console.log('[Music WS] Playback state changed:', data);
      setLastUpdate({ type: 'state', data, timestamp: Date.now() });
      if (onPlaybackStateChange) {
        onPlaybackStateChange(data);
      }
    };
    
    const handleTrackChange = (data: any) => {
      console.log('[Music WS] Track changed:', data);
      setLastUpdate({ type: 'track', data, timestamp: Date.now() });
      
      // Show toast for AI discoveries
      if (data.source === 'ai' && data.isAIDiscovery) {
        showToast(`AI playing: ${data.current.name}`, 'info');
      }
      
      if (onTrackChange) {
        onTrackChange(data);
      }
    };
    
    const handleQueueUpdate = (data: any) => {
      console.log('[Music WS] Queue updated:', data);
      setLastUpdate({ type: 'queue', data, timestamp: Date.now() });
      
      // Show toast for queue updates
      if (data.action === 'added' && data.source === 'ai') {
        showToast(`Added ${data.totalItems} tracks to queue`, 'success');
      }
      
      if (onQueueUpdate) {
        onQueueUpdate(data);
      }
    };
    
    const handleCommandExecuted = (data: any) => {
      console.log('[Music WS] Command executed:', data);
      
      // Show toast for failed commands
      if (!data.success && data.error) {
        showToast(`Command failed: ${data.error}`, 'error');
      }
      
      if (onCommandExecuted) {
        onCommandExecuted(data);
      }
    };
    
    // Register event listeners
    musicSocket.on('connect', handleConnect);
    musicSocket.on('disconnect', handleDisconnect);
    musicSocket.on('playbackStateChanged', handlePlaybackStateChange);
    musicSocket.on('trackChanged', handleTrackChange);
    musicSocket.on('queueUpdated', handleQueueUpdate);
    musicSocket.on('commandExecuted', handleCommandExecuted);
    
    // Connect if not connected
    if (!musicSocket.connected) {
      const sessionId = localStorage.getItem('spotify_session_id');
      if (sessionId) {
        updateMusicSocketAuth();
        musicSocket.connect();
      }
    }
    
    // Cleanup
    return () => {
      unsubscribeFromPlayback();
      musicSocket.off('connect', handleConnect);
      musicSocket.off('disconnect', handleDisconnect);
      musicSocket.off('playbackStateChanged', handlePlaybackStateChange);
      musicSocket.off('trackChanged', handleTrackChange);
      musicSocket.off('queueUpdated', handleQueueUpdate);
      musicSocket.off('commandExecuted', handleCommandExecuted);
    };
  }, [onPlaybackStateChange, onTrackChange, onQueueUpdate, onCommandExecuted]);
  
  return {
    connected,
    lastUpdate,
    subscribeToPlayback,
    unsubscribeFromPlayback,
    requestSync
  };
}
```

## Phase 2: Component Integration

### 2.1 Update PlaybackControls Component
**File**: `/client/src/components/PlaybackControls.tsx`

Integrate WebSocket for real-time updates:

```typescript
import { useMusicWebSocket } from '../hooks/useMusicWebSocket';

const PlaybackControls: React.FC<PlaybackControlsProps> = ({ ... }) => {
  // Existing state...
  const [wsConnected, setWsConnected] = useState(false);
  const [lastWsUpdate, setLastWsUpdate] = useState<number>(0);
  
  // WebSocket integration
  const handleWsPlaybackChange = useCallback((data: any) => {
    console.log('[PlaybackControls] WS update received:', data);
    
    // Update state from WebSocket
    setPlaybackState({
      isPlaying: data.isPlaying,
      track: data.track,
      shuffleState: data.shuffleState,
      repeatState: data.repeatState,
      volume: data.volume
    });
    
    if (data.track) {
      setLocalPosition(data.position);
      setVolume(data.volume);
      setLastFetchTime(Date.now());
      setLastWsUpdate(Date.now());
    }
    
    // Clear track changing flag
    setIsTrackChanging(false);
  }, []);
  
  const handleWsTrackChange = useCallback((data: any) => {
    console.log('[PlaybackControls] Track changed via WS:', data);
    
    // Trigger fade animation
    setIsTrackChanging(true);
    
    // Update previous track ref
    if (data.previous) {
      previousTrackNameRef.current = data.previous.name;
    }
    
    // Request full state sync after track change
    requestSync();
  }, []);
  
  const { connected, requestSync } = useMusicWebSocket(
    handleWsPlaybackChange,
    handleWsTrackChange
  );
  
  useEffect(() => {
    setWsConnected(connected);
  }, [connected]);
  
  // Modified polling logic - reduce frequency when WS connected
  const calculateNextPollTime = (track: PlaybackState['track'], isPlaying: boolean): number => {
    // If WebSocket is connected, poll less frequently
    if (wsConnected) {
      if (!track || !isPlaying) {
        return 120000; // 2 minutes when idle with WS
      }
      
      const timeRemaining = track.duration - localPosition;
      if (timeRemaining <= 5000) {
        return Math.max(timeRemaining - 2000, 1000); // Still poll near track end
      }
      
      return 60000; // 1 minute heartbeat with WS
    }
    
    // Original polling logic when WS not connected
    // ... existing logic ...
  };
  
  // Add WebSocket indicator to UI
  return (
    <div className="...">
      {/* Add real-time indicator */}
      {wsConnected && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-500">Live</span>
        </div>
      )}
      
      {/* Rest of the component... */}
    </div>
  );
};
```

### 2.2 Update MainApp Component
**File**: `/client/src/components/MainApp.tsx`

Add WebSocket for command execution feedback:

```typescript
import { useMusicWebSocket } from '../hooks/useMusicWebSocket';

function MainApp() {
  // Existing state...
  const [wsConnected, setWsConnected] = useState(false);
  
  // Handle command execution via WebSocket
  const handleWsCommandExecuted = useCallback((data: any) => {
    console.log('[MainApp] Command executed via WS:', data);
    
    // Update command history with real-time feedback
    if (data.success) {
      // Find and update the pending command
      setHistory(prev => prev.map(item => {
        if (item.command === data.command && item.status === 'pending') {
          return {
            ...item,
            status: 'completed',
            confidence: data.confidence,
            result: data.result
          };
        }
        return item;
      }));
    }
  }, []);
  
  // Handle queue updates
  const handleWsQueueUpdate = useCallback((data: any) => {
    if (data.action === 'added' && data.tracks) {
      // Show notification about queue update
      const trackNames = data.tracks.slice(0, 3).map(t => t.name).join(', ');
      const more = data.tracks.length > 3 ? ` and ${data.tracks.length - 3} more` : '';
      showToast(`Queued: ${trackNames}${more}`, 'success');
    }
  }, [showToast]);
  
  const { connected } = useMusicWebSocket(
    null, // No need for playback state here
    null, // Track changes handled by PlaybackControls
    handleWsQueueUpdate,
    handleWsCommandExecuted
  );
  
  useEffect(() => {
    setWsConnected(connected);
  }, [connected]);
  
  // Add connection status to UI
  return (
    <div className="...">
      {/* Show WebSocket status in header or status bar */}
      {wsConnected && (
        <div className="fixed bottom-4 right-4 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs">
          Real-time updates active
        </div>
      )}
      
      {/* Rest of the component... */}
    </div>
  );
}
```

### 2.3 Create Real-time Activity Component
**New File**: `/client/src/components/RealtimeActivity.tsx`

Optional component to show live activity feed:

```typescript
import React, { useState, useEffect } from 'react';
import { useMusicWebSocket } from '../hooks/useMusicWebSocket';

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  source: 'user' | 'ai' | 'auto';
}

export function RealtimeActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const maxActivities = 10;
  
  const handleUpdate = (type: string, data: any) => {
    const activity: Activity = {
      id: `${type}-${Date.now()}`,
      type,
      message: formatActivityMessage(type, data),
      timestamp: data.timestamp,
      source: data.source || 'auto'
    };
    
    setActivities(prev => [activity, ...prev].slice(0, maxActivities));
  };
  
  const { connected } = useMusicWebSocket(
    (data) => handleUpdate('playback', data),
    (data) => handleUpdate('track', data),
    (data) => handleUpdate('queue', data),
    (data) => handleUpdate('command', data)
  );
  
  if (!connected || activities.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed bottom-20 left-4 w-80 bg-zinc-900/95 backdrop-blur rounded-lg p-4 space-y-2">
      <div className="text-xs text-gray-500 mb-2">Live Activity</div>
      {activities.map(activity => (
        <div
          key={activity.id}
          className="text-sm text-gray-300 animate-slideIn"
        >
          <span className="text-gray-500">
            {new Date(activity.timestamp).toLocaleTimeString()}
          </span>
          {' • '}
          <span className={
            activity.source === 'ai' ? 'text-blue-400' : 
            activity.source === 'user' ? 'text-green-400' : 
            'text-gray-400'
          }>
            {activity.message}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatActivityMessage(type: string, data: any): string {
  switch (type) {
    case 'track':
      return `Now playing: ${data.current?.name || 'Unknown'}`;
    case 'queue':
      return `Queue ${data.action}: ${data.totalItems} tracks`;
    case 'command':
      return `Command: ${data.intent} (${Math.round(data.confidence * 100)}%)`;
    default:
      return `${type} update`;
  }
}
```

## Phase 3: Enhanced Features

### 3.1 Multi-Tab Synchronization
Synchronize playback across multiple browser tabs:

```typescript
// In useMusicWebSocket hook
useEffect(() => {
  // Broadcast to other tabs via BroadcastChannel
  const channel = new BroadcastChannel('spotify-playback');
  
  const handleWsUpdate = (data: any) => {
    // Send to other tabs
    channel.postMessage({
      type: 'playback-update',
      data
    });
  };
  
  // Listen for updates from other tabs
  channel.onmessage = (event) => {
    if (event.data.type === 'playback-update') {
      // Update local state
    }
  };
  
  return () => channel.close();
}, []);
```

### 3.2 Offline Queue
Buffer commands when WebSocket disconnected:

```typescript
// In MainApp
const commandQueue = useRef<any[]>([]);

const handleCommand = async (command: string) => {
  if (!wsConnected) {
    // Queue command for when connection returns
    commandQueue.current.push({
      command,
      timestamp: Date.now()
    });
  }
  
  // Process normally...
};

// When WebSocket reconnects
useEffect(() => {
  if (wsConnected && commandQueue.current.length > 0) {
    // Process queued commands
    commandQueue.current.forEach(cmd => {
      // Send to server
    });
    commandQueue.current = [];
  }
}, [wsConnected]);
```

### 3.3 Visual Feedback
Add visual indicators for real-time updates:

```typescript
// Pulse animation when receiving updates
.pulse-on-update {
  animation: pulse 0.5s ease-out;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

// In component
const [isPulsing, setIsPulsing] = useState(false);

useEffect(() => {
  if (lastWsUpdate) {
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 500);
  }
}, [lastWsUpdate]);
```

## Phase 4: Performance Optimization

### 4.1 Debounce High-Frequency Updates
Prevent UI thrashing from rapid updates:

```typescript
import { debounce } from 'lodash';

const debouncedStateUpdate = useMemo(
  () => debounce((data: any) => {
    setPlaybackState(data);
  }, 100),
  []
);
```

### 4.2 Memory Management
Clean up old activity logs and messages:

```typescript
// Limit stored activities
const MAX_ACTIVITIES = 50;

// Periodic cleanup
useEffect(() => {
  const cleanup = setInterval(() => {
    setActivities(prev => prev.slice(0, MAX_ACTIVITIES));
  }, 60000); // Every minute
  
  return () => clearInterval(cleanup);
}, []);
```

### 4.3 Connection Management
Optimize reconnection strategy:

```typescript
// Exponential backoff for reconnection
let reconnectDelay = 1000;
const maxDelay = 30000;

musicSocket.on('disconnect', () => {
  setTimeout(() => {
    musicSocket.connect();
    reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
  }, reconnectDelay);
});

musicSocket.on('connect', () => {
  reconnectDelay = 1000; // Reset on successful connection
});
```

## Testing Requirements

### Unit Tests
1. Test hook initialization
2. Test event handler callbacks
3. Test state updates from WebSocket
4. Test reconnection logic

### Integration Tests
1. Test WebSocket connection flow
2. Test event reception and UI updates
3. Test multi-tab synchronization
4. Test offline queue functionality

### E2E Tests
1. Test complete flow: Command → WebSocket → UI update
2. Test disconnection and reconnection
3. Test concurrent updates from multiple sources
4. Test performance with rapid updates

## Monitoring & Analytics

### Metrics to Track
- WebSocket connection success rate
- Average latency of updates
- Number of missed events
- Reconnection frequency
- UI update performance

### User Analytics
```typescript
// Track WebSocket usage
const trackWebSocketMetrics = () => {
  // Track connection status
  analytics.track('websocket_status', {
    connected: wsConnected,
    latency: lastLatency,
    missedEvents: missedEventCount
  });
};
```

## UI/UX Considerations

### Visual Indicators
1. **Connection Status**: Green dot for connected, red for disconnected
2. **Real-time Badge**: "Live" indicator when receiving updates
3. **Update Animation**: Subtle pulse or glow on data change
4. **Latency Indicator**: Show if updates are delayed

### User Notifications
1. **Connection Lost**: Subtle notification, don't interrupt
2. **Reconnected**: Brief success message
3. **AI Actions**: Toast notifications for AI-triggered events
4. **Queue Updates**: Show what was added/removed

### Graceful Degradation
1. Continue polling if WebSocket fails
2. Queue user commands during disconnection
3. Sync state when connection restored
4. No loss of functionality without WebSocket

## Success Criteria

1. ✅ UI updates within 200ms of server event
2. ✅ Smooth animations for all state changes
3. ✅ No UI freezing or stuttering
4. ✅ Graceful fallback to polling
5. ✅ Multi-tab synchronization works
6. ✅ Memory usage stays constant over time
7. ✅ Works on mobile browsers

## Timeline

- **Day 1**: Implement basic infrastructure (1.1, 1.2, 1.3)
- **Day 2**: Integrate with PlaybackControls (2.1)
- **Day 3**: Integrate with MainApp (2.2, 2.3)
- **Day 4**: Add enhanced features (3.1, 3.2, 3.3)
- **Day 5**: Optimize and test (4.1, 4.2, 4.3)

## Notes for Backend Team

The frontend expects the following from the backend:
- Authentication via session ID in handshake
- User-specific event delivery (no broadcast to all)
- Timestamps on all events for synchronization
- Source attribution (user/ai/auto) for context
- Graceful handling of subscription/unsubscription
- Event buffering for temporarily disconnected clients

## Dependencies

- `socket.io-client`: ^4.5.0 (already installed)
- No additional dependencies required
- Uses existing hooks and services architecture