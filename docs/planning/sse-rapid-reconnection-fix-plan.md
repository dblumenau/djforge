# SSE Rapid Reconnection Fix - Implementation Plan

## Problem Summary

### Symptoms
- EventSource connections opening and closing within milliseconds (thousands per second)
- Console logs showing rapid cycle: Connect → Connected → Disconnect → Repeat
- Network tab showing ERR_CONNECTION_REFUSED after overwhelming server
- User authentication successful but connections still failing rapidly

### Root Cause
A React hooks circular dependency is causing infinite re-renders and reconnections:

1. `useSSE` hook creates `connect` and `disconnect` callbacks with `[options]` in their dependency arrays
2. Main `useEffect` has `[connect, disconnect]` as dependencies
3. `PlaybackControls.tsx` creates a new options object on every render
4. Chain reaction: render → new options → new callbacks → effect runs → disconnect/reconnect → state update → render (infinite loop)

## Expert Consensus

Four AI models analyzed the issue with unanimous agreement:
- **OpenAI o3**: 8/10 confidence for Solution 1
- **Google Gemini 2.5 Pro**: 9/10 confidence for Solution 1
- **Claude Opus 4**: 9/10 confidence for Solution 1
- **DeepSeek R1**: 9/10 confidence for Solution 1

All models identified this as a classic React hooks dependency issue with a well-established solution pattern.

## Recommended Solution: Refs for Callbacks

### Why This Solution
- **Canonical Pattern**: Industry-standard approach (see Kent C. Dodds' useEventCallback pattern)
- **No Breaking Changes**: Fix is entirely internal to the `useSSE` hook
- **Minimal Risk**: ~30 minute implementation
- **Battle-Tested**: Used by major libraries like SWR, React Query, and others
- **Encapsulated**: Consumers don't need to change their code or worry about memoization

## Implementation Details

### Step 1: Update useSSE.ts Hook

```typescript
// File: /client/src/hooks/useSSE.ts

export function useSSE(options: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<PlaybackEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // NEW: Store callbacks in refs to keep them stable
  const onEventRef = useRef(options.onEvent);
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  const onErrorRef = useRef(options.onError);
  
  // NEW: Update refs when callbacks change (without triggering reconnection)
  useEffect(() => {
    onEventRef.current = options.onEvent;
    onConnectRef.current = options.onConnect;
    onDisconnectRef.current = options.onDisconnect;
    onErrorRef.current = options.onError;
  }, [options.onEvent, options.onConnect, options.onDisconnect, options.onError]);
  
  // CRITICAL: Make connect stable with empty dependency array
  const connect = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    const jwtToken = localStorage.getItem('spotify_jwt');
    if (!jwtToken) {
      console.warn('[SSE] No JWT token found, skipping connection');
      return;
    }
    
    console.log('[SSE] Connecting to event stream...');
    
    const url = `${apiEndpoint('/api/events')}?token=${encodeURIComponent(jwtToken)}`;
    const eventSource = new EventSource(url);
    
    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
      setIsConnected(true);
      // Use ref instead of direct callback
      onConnectRef.current?.();
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as PlaybackEvent;
        console.log('[SSE] Event received:', data.type, data);
        setLastEvent(data);
        // Use ref instead of direct callback
        onEventRef.current?.(data);
      } catch (error) {
        console.error('[SSE] Failed to parse event:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      setIsConnected(false);
      // Use refs for callbacks
      onErrorRef.current?.(new Error('SSE connection failed'));
      onDisconnectRef.current?.();
      
      // Let EventSource handle reconnection automatically
      console.log('[SSE] EventSource will handle reconnection automatically');
    };
    
    // Handle SSE error events from server
    eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.error('[SSE] Server error:', data);
        
        // Handle specific error codes
        if (data.code === 'NO_TOKEN' || data.code === 'INVALID_TOKEN' || 
            data.code === 'NO_USER_ID' || data.code === 'TOKEN_ERROR') {
          console.error('[SSE] Authentication error, closing connection permanently');
          
          // Close the connection to stop automatic reconnection
          eventSource.close();
          eventSourceRef.current = null;
          
          // Clear the stored JWT if it's invalid
          if (data.code === 'INVALID_TOKEN' || data.code === 'TOKEN_ERROR') {
            localStorage.removeItem('spotify_jwt');
          }
        }
      } catch (e) {
        // Not a JSON error event, ignore
      }
    });
    
    eventSourceRef.current = eventSource;
  }, []); // EMPTY ARRAY - This is the key fix!
  
  // CRITICAL: Make disconnect stable with empty dependency array
  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting...');
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setIsConnected(false);
    onDisconnectRef.current?.();
  }, []); // EMPTY ARRAY - This is the key fix!
  
  // Connect on mount and handle cleanup
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]); // Now these are stable references
  
  // Reconnect if JWT token changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'spotify_jwt') {
        console.log('[SSE] JWT token changed, reconnecting...');
        disconnect();
        connect();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [connect, disconnect]);
  
  return {
    isConnected,
    lastEvent,
    reconnect: connect,
    disconnect
  };
}
```

### Step 2: Add Documentation Comment

Add this comment at the top of the hook to explain the pattern:

```typescript
/**
 * useSSE - Server-Sent Events hook with stable connection management
 * 
 * IMPORTANT: This hook uses the "refs for callbacks" pattern to prevent
 * circular dependencies and infinite reconnection loops. Callbacks are
 * stored in refs and updated via useEffect without triggering reconnections.
 * 
 * DO NOT "simplify" by adding options to the connect/disconnect dependencies.
 * This will reintroduce the infinite reconnection bug.
 * 
 * Pattern reference: https://epicreact.dev/the-latest-ref-pattern-in-react/
 */
```

### Step 3: Remove Server-Side Workarounds

The server-side changes we made (timeout delays, extra headers, etc.) can be reverted as they were attempting to fix a client-side issue:

```typescript
// File: /server/src/server.ts
// Revert to simpler SSE implementation without workarounds
```

## Testing Plan

### Unit Tests
```typescript
describe('useSSE', () => {
  it('should connect only once on mount', () => {
    // Verify EventSource is created once
  });
  
  it('should update callbacks without reconnecting', () => {
    // Change options and verify no new EventSource created
  });
  
  it('should properly cleanup on unmount', () => {
    // Verify EventSource.close() is called
  });
  
  it('should reconnect on token change', () => {
    // Simulate localStorage change and verify reconnection
  });
});
```

### Manual Testing
1. Open browser DevTools Network tab
2. Navigate to the app
3. Verify only ONE EventSource connection is established
4. Interact with the app (play/pause/skip)
5. Verify connection remains stable
6. Check console for no rapid connect/disconnect messages

### Performance Verification
- Monitor server logs - should see ONE connection per user
- Check browser performance - no memory leaks from multiple EventSource instances
- Verify CPU usage is normal (not spiking from rapid reconnections)

## Rollback Plan

If issues arise, the fix can be reverted by:
1. Removing the refs implementation
2. Reverting to the previous hook code
3. No consumer code changes needed (API unchanged)

## Long-Term Recommendations

1. **Add ESLint Rule**: Create custom rule to warn about unstable dependencies in SSE/WebSocket hooks
2. **Future Refactor**: Consider migrating to explicit callback props (Solution 3) in a major version
3. **Documentation**: Add this pattern to team's React best practices guide
4. **Monitoring**: Add metrics to track SSE connection stability in production

## Timeline

- **Implementation**: 30 minutes
- **Testing**: 1 hour
- **Code Review**: 30 minutes
- **Total**: ~2 hours

## Risk Assessment

- **Risk Level**: LOW
- **Rollback Effort**: Minimal (5 minutes)
- **User Impact**: Positive (fixes connection storm)
- **Performance Impact**: Positive (reduces server load)

## Success Criteria

1. No more rapid reconnection logs in console
2. Single stable EventSource connection per user
3. All existing functionality continues to work
4. No breaking changes for consumers

## Notes for Implementation

- The key insight is that SSE connections should NOT restart when callback logic changes
- Only reconnect on actual connection-level changes (URL, auth token)
- This pattern is used by many production React libraries
- Document the pattern well to prevent future "fixes" that break it

---

*This plan is based on expert consensus from multiple AI models and established React patterns. The solution has been validated against industry best practices.*