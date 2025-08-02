# CLAUDE.md - React Hooks

This directory contains custom React hooks that encapsulate reusable logic for the Spotify Claude Controller client application.

## Hook Files

### useWebSocket.ts
- **Purpose**: WebSocket connection management and real-time communication
- **Features**:
  - Automatic connection lifecycle management
  - Message history tracking (limited to 50 messages)
  - Connection status monitoring
  - Ping/pong latency measurement
  - Reconnection handling with attempt tracking
  - TypeScript-first with full type safety
- **Return Interface**:
  ```typescript
  {
    connectionInfo: {
      connected: boolean;
      socketId?: string;
      transport?: string;
      reconnectAttempt?: number;
      lastError?: string;
    };
    messages: WebSocketMessage[];
    sendPing: () => void;
    clearMessages: () => void;
    connect: () => void;
    disconnect: () => void;
  }
  ```
- **Events Handled**:
  - `connect` - Connection established
  - `disconnect` - Connection lost
  - `randomString` - Server broadcast received
  - `connectionStatus` - Status updates
  - `error` - Error notifications
- **Usage Example**:
  ```typescript
  const { connectionInfo, messages, sendPing } = useWebSocket();
  ```

### useSpotifyAuth.ts
- **Purpose**: Spotify authentication and token management
- **Features**:
  - JWT token storage and retrieval
  - Automatic token refresh with race condition prevention
  - User profile management
  - Logout functionality
- **Token Refresh Lock**: Prevents multiple simultaneous refresh attempts

### useToast.ts
- **Purpose**: Toast notification system
- **Features**:
  - Success, error, and info notifications
  - Auto-dismiss functionality
  - Queue management for multiple toasts
  - Customizable duration

### useDebounce.ts
- **Purpose**: Debounce values for performance optimization
- **Common Use Cases**:
  - Search input debouncing
  - API call throttling
  - Resize event handling

### useLocalStorage.ts
- **Purpose**: Persistent state management in browser storage
- **Features**:
  - Type-safe storage operations
  - JSON serialization/deserialization
  - Default value support
  - Storage event synchronization

### useMediaQuery.ts
- **Purpose**: Responsive design breakpoint detection
- **Breakpoints**:
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px

### useKeyboardShortcuts.ts
- **Purpose**: Global keyboard shortcut handling
- **Shortcuts**:
  - `Space` - Play/pause
  - `Cmd/Ctrl + K` - Focus search
  - `Escape` - Close modals
  - Arrow keys - Navigation

## Hook Patterns

### State Management
- Use `useState` for local component state
- Use `useReducer` for complex state logic
- Use context for cross-component state

### Side Effects
- `useEffect` for subscriptions and cleanup
- `useLayoutEffect` for DOM measurements
- `useMemo` for expensive computations
- `useCallback` for stable function references

### Error Handling
```typescript
const [error, setError] = useState<Error | null>(null);
const [loading, setLoading] = useState(false);

const fetchData = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    // Async operation
  } catch (err) {
    setError(err as Error);
  } finally {
    setLoading(false);
  }
}, []);
```

### WebSocket Integration Pattern
The `useWebSocket` hook demonstrates best practices for real-time communication:
1. **Singleton Socket**: Uses a single socket instance from `/services/socket.ts`
2. **Automatic Lifecycle**: Connects on mount, disconnects on unmount
3. **Event Cleanup**: Properly removes all listeners to prevent memory leaks
4. **Message History**: Maintains limited history for performance
5. **Connection State**: Tracks detailed connection information

## Testing Hooks

### Test Utilities
- Use `@testing-library/react-hooks` for hook testing
- Mock external dependencies (Socket.IO, localStorage)
- Test state changes and side effects

### Example Test
```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useWebSocket } from './useWebSocket';

test('connects on mount', () => {
  const { result } = renderHook(() => useWebSocket());
  expect(result.current.connectionInfo.connected).toBe(false);
  
  // Wait for connection
  act(() => {
    // Trigger connection event
  });
  
  expect(result.current.connectionInfo.connected).toBe(true);
});
```

## Adding New Hooks

1. Create a new TypeScript file in this directory
2. Use descriptive hook name starting with `use`
3. Define clear TypeScript interfaces for parameters and return values
4. Handle cleanup in useEffect return functions
5. Add comprehensive error handling
6. Document usage patterns and examples
7. Add unit tests for the hook
8. Update this documentation

## Performance Considerations

### Memoization
- Memoize expensive computations with `useMemo`
- Stabilize callbacks with `useCallback`
- Avoid creating new objects/arrays in render

### Dependencies
- List all dependencies in effect arrays
- Use ESLint rules to catch missing dependencies
- Consider using `useRef` for values that shouldn't trigger re-renders

### WebSocket Performance
- Limit message history to prevent memory issues
- Use throttling/debouncing for high-frequency events
- Clean up event listeners to prevent memory leaks
- Consider using separate namespaces for different features