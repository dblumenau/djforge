# Phase 2: Frontend WebSocket Integration

## Developer Assignment: Frontend Developer

## Overview
This phase implements the client-side WebSocket integration using Socket.IO client with React and TypeScript. The frontend developer will create a complete demo page with real-time updates, connection management, and user interface, working independently from the backend implementation.

## Prerequisites
- Node.js and npm installed
- Access to `client/` directory
- Understanding of React, TypeScript, and React Hooks
- Familiarity with Socket.IO client concepts
- Backend service running on port 4001 (or configured port)

## Deliverables
1. Socket.IO client singleton instance
2. Custom React hook for WebSocket management
3. Demo page with real-time updates
4. Connection status visualization
5. Message history display with animations

## Step-by-Step Implementation

### Step 1: Install Dependencies
```bash
cd client
npm install socket.io-client
npm install --save-dev @types/node
```

### Step 2: Copy Type Definitions from Backend
**File:** `client/src/types/websocket.types.ts`

Copy the exact types from the backend to ensure consistency:

```typescript
// These types MUST match the backend exactly
// Copy from server/src/types/websocket.types.ts

export interface ServerToClientEvents {
  randomString: (data: { 
    value: string; 
    timestamp: number 
  }) => void;
  connectionStatus: (status: 'connected' | 'disconnected') => void;
  error: (data: { 
    message: string;
    code?: string;
  }) => void;
}

export interface ClientToServerEvents {
  ping: (callback: (response: { 
    status: 'ok'; 
    timestamp: number;
    serverTime: number;
  }) => void) => void;
}
```

### Step 3: Create Socket Service Singleton
**File:** `client/src/services/socket.ts`

```typescript
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../types/websocket.types';

// Determine the WebSocket URL based on environment
const getWebSocketURL = (): string => {
  // Check for environment variable first
  if (import.meta.env.VITE_WEBSOCKET_URL) {
    return import.meta.env.VITE_WEBSOCKET_URL;
  }
  
  // In production, use the same origin
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  
  // In development, default to localhost
  return 'http://localhost:4001';
};

const WEBSOCKET_URL = getWebSocketURL();
const NAMESPACE = '/demo';

// Create typed socket instance (singleton pattern)
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `${WEBSOCKET_URL}${NAMESPACE}`,
  {
    // Don't connect automatically - let the hook manage it
    autoConnect: false,
    
    // Transport options (try WebSocket first, fall back to polling)
    transports: ['websocket', 'polling'],
    
    // Reconnection settings
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    
    // Timeout settings
    timeout: 20000,
    
    // Enable compression
    compress: true
  }
);

// Debug logging in development
if (import.meta.env.DEV) {
  socket.on('connect', () => {
    console.log('[Socket.IO] Connected to server', {
      id: socket.id,
      transport: socket.io.engine.transport.name
    });
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket.IO] Disconnected from server', { reason });
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket.IO] Connection error', {
      message: error.message,
      type: error.type
    });
  });
}

// Export utility functions
export const isSocketConnected = (): boolean => socket.connected;
export const getSocketId = (): string | undefined => socket.id;
export const getTransport = (): string | undefined => {
  return socket.io.engine?.transport?.name;
};
```

### Step 4: Create WebSocket React Hook
**File:** `client/src/hooks/useWebSocket.ts`

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
import { socket, isSocketConnected, getSocketId, getTransport } from '../services/socket';

// Message type for history
export interface WebSocketMessage {
  id: string;
  type: 'randomString' | 'error' | 'ping';
  value: string;
  timestamp: number;
  serverTime?: number;
}

// Connection state
export interface ConnectionInfo {
  connected: boolean;
  socketId?: string;
  transport?: string;
  reconnectAttempt?: number;
  lastError?: string;
}

// Hook return type
export interface UseWebSocketReturn {
  connectionInfo: ConnectionInfo;
  messages: WebSocketMessage[];
  sendPing: () => void;
  clearMessages: () => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  // Connection state
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    connected: false
  });

  // Message history (limited to last 50 messages)
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  
  // Track if we've connected in this component lifecycle
  const hasConnected = useRef(false);
  
  // Message ID counter
  const messageIdCounter = useRef(0);

  // Generate unique message ID
  const generateMessageId = (): string => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  };

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!socket.connected && !hasConnected.current) {
      console.log('[useWebSocket] Connecting to WebSocket...');
      socket.connect();
      hasConnected.current = true;
    }
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socket.connected) {
      console.log('[useWebSocket] Disconnecting from WebSocket...');
      socket.disconnect();
      hasConnected.current = false;
    }
  }, []);

  // Send ping to server
  const sendPing = useCallback(() => {
    if (!socket.connected) {
      console.warn('[useWebSocket] Cannot send ping - not connected');
      return;
    }

    const startTime = Date.now();
    
    socket.emit('ping', (response) => {
      const latency = Date.now() - startTime;
      
      console.log('[useWebSocket] Ping response received', {
        latency: `${latency}ms`,
        serverTime: new Date(response.serverTime).toISOString()
      });

      // Add ping response to messages
      setMessages(prev => {
        const newMessage: WebSocketMessage = {
          id: generateMessageId(),
          type: 'ping',
          value: `Pong! Latency: ${latency}ms`,
          timestamp: Date.now(),
          serverTime: response.serverTime
        };
        
        // Keep only last 50 messages
        const updated = [...prev, newMessage];
        return updated.slice(-50);
      });
    });
  }, []);

  // Clear message history
  const clearMessages = useCallback(() => {
    setMessages([]);
    messageIdCounter.current = 0;
  }, []);

  // Set up event listeners
  useEffect(() => {
    // Connection event handlers
    const handleConnect = () => {
      setConnectionInfo({
        connected: true,
        socketId: getSocketId(),
        transport: getTransport()
      });
    };

    const handleDisconnect = (reason: string) => {
      setConnectionInfo(prev => ({
        ...prev,
        connected: false,
        lastError: reason
      }));
    };

    const handleConnectError = (error: Error) => {
      console.error('[useWebSocket] Connection error:', error);
      setConnectionInfo(prev => ({
        ...prev,
        connected: false,
        lastError: error.message
      }));
    };

    // Reconnection attempt tracking
    const handleReconnectAttempt = (attemptNumber: number) => {
      console.log(`[useWebSocket] Reconnection attempt ${attemptNumber}`);
      setConnectionInfo(prev => ({
        ...prev,
        reconnectAttempt: attemptNumber
      }));
    };

    const handleReconnect = () => {
      console.log('[useWebSocket] Reconnected successfully');
      setConnectionInfo({
        connected: true,
        socketId: getSocketId(),
        transport: getTransport()
      });
    };

    // Message event handlers
    const handleRandomString = (data: { value: string; timestamp: number }) => {
      console.log('[useWebSocket] Random string received:', data.value);
      
      setMessages(prev => {
        const newMessage: WebSocketMessage = {
          id: generateMessageId(),
          type: 'randomString',
          value: data.value,
          timestamp: data.timestamp
        };
        
        // Keep only last 50 messages
        const updated = [...prev, newMessage];
        return updated.slice(-50);
      });
    };

    const handleConnectionStatus = (status: 'connected' | 'disconnected') => {
      console.log('[useWebSocket] Connection status:', status);
      
      if (status === 'connected') {
        setConnectionInfo({
          connected: true,
          socketId: getSocketId(),
          transport: getTransport()
        });
      } else {
        setConnectionInfo(prev => ({
          ...prev,
          connected: false
        }));
      }
    };

    const handleError = (data: { message: string; code?: string }) => {
      console.error('[useWebSocket] Server error:', data);
      
      setMessages(prev => {
        const newMessage: WebSocketMessage = {
          id: generateMessageId(),
          type: 'error',
          value: data.message,
          timestamp: Date.now()
        };
        
        // Keep only last 50 messages
        const updated = [...prev, newMessage];
        return updated.slice(-50);
      });
    };

    // Register all event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.io.on('reconnect', handleReconnect);
    socket.on('randomString', handleRandomString);
    socket.on('connectionStatus', handleConnectionStatus);
    socket.on('error', handleError);

    // Cleanup function
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.io.off('reconnect', handleReconnect);
      socket.off('randomString', handleRandomString);
      socket.off('connectionStatus', handleConnectionStatus);
      socket.off('error', handleError);
    };
  }, []); // Empty dependency array - set up once

  // Auto-connect on mount (optional - can be controlled by component)
  useEffect(() => {
    connect();
    
    // Cleanup: disconnect on unmount
    return () => {
      if (socket.connected) {
        disconnect();
      }
    };
  }, [connect, disconnect]);

  return {
    connectionInfo,
    messages,
    sendPing,
    clearMessages,
    connect,
    disconnect
  };
}
```

### Step 5: Create Demo Page Component
**File:** `client/src/pages/WebSocketDemo.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';

export default function WebSocketDemo() {
  const { connectionInfo, messages, sendPing, clearMessages, connect, disconnect } = useWebSocket();
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  // Get message color based on type
  const getMessageColor = (type: string): string => {
    switch (type) {
      case 'randomString':
        return 'text-blue-400';
      case 'ping':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">
            WebSocket Demo
          </h1>
          <p className="text-gray-400">
            Real-time bidirectional communication with Socket.IO
          </p>
        </div>

        {/* Connection Status Card */}
        <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 mb-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Connection Status</h2>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connectionInfo.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={`text-sm font-medium ${connectionInfo.connected ? 'text-green-400' : 'text-red-400'}`}>
                {connectionInfo.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Socket ID:</span>
              <p className="text-white font-mono text-xs truncate">
                {connectionInfo.socketId || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Transport:</span>
              <p className="text-white">
                {connectionInfo.transport || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Messages:</span>
              <p className="text-white">{messages.length}</p>
            </div>
            <div>
              <span className="text-gray-500">Reconnect:</span>
              <p className="text-white">
                {connectionInfo.reconnectAttempt ? `Attempt ${connectionInfo.reconnectAttempt}` : 'N/A'}
              </p>
            </div>
          </div>

          {connectionInfo.lastError && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
              <p className="text-red-400 text-sm">
                Error: {connectionInfo.lastError}
              </p>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 mb-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">Controls</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={sendPing}
              disabled={!connectionInfo.connected}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
            >
              Send Ping
            </button>
            <button
              onClick={clearMessages}
              disabled={messages.length === 0}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
            >
              Clear Messages
            </button>
            <button
              onClick={() => connectionInfo.connected ? disconnect() : connect()}
              className={`px-4 py-2 ${
                connectionInfo.connected 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white rounded-lg transition-colors duration-200`}
            >
              {connectionInfo.connected ? 'Disconnect' : 'Connect'}
            </button>
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
          </div>
        </div>

        {/* Messages Display */}
        <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Message History</h2>
            <span className="text-sm text-gray-400">
              Last 50 messages
            </span>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No messages yet. Waiting for data...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className="flex items-start gap-3 p-2 rounded hover:bg-gray-800/30 transition-all duration-300 animate-fadeIn"
                    style={{
                      animationDelay: `${index * 0.05}s`
                    }}
                  >
                    <span className="text-gray-600 text-xs whitespace-nowrap">
                      {formatTimestamp(message.timestamp)}
                    </span>
                    <span className={`flex-1 break-all ${getMessageColor(message.type)}`}>
                      {message.type === 'randomString' && '📨 '}
                      {message.type === 'ping' && '🏓 '}
                      {message.type === 'error' && '❌ '}
                      {message.value}
                    </span>
                    <span className="text-gray-600 text-xs">
                      {message.type}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>WebSocket endpoint: {import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:4001'}/demo</p>
          <p>Random strings are broadcast every 5-15 seconds to all connected clients</p>
        </div>
      </div>

      {/* Add fade-in animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
```

### Step 6: Add Route to App
**Modify:** `client/src/App.tsx`

Add the WebSocket demo route to your router configuration:

```typescript
import WebSocketDemo from './pages/WebSocketDemo';

// In your routes configuration, add:
{
  path: '/websocket-demo',
  element: <WebSocketDemo />
}

// Or if using older React Router:
<Route path="/websocket-demo" element={<WebSocketDemo />} />
```

### Step 7: Add Navigation Link
**Modify:** Your navigation component to include a link to the demo

```typescript
// In your navigation menu/sidebar, add:
<Link to="/websocket-demo" className="...">
  WebSocket Demo
</Link>
```

### Step 8: Environment Configuration (Optional)
**File:** `client/.env` or `client/.env.local`

```bash
# Optional: Override WebSocket URL for different environments
VITE_WEBSOCKET_URL=http://localhost:4001

# For production, you might use:
# VITE_WEBSOCKET_URL=https://api.yourdomain.com
```

## Testing the Frontend Implementation

### Manual Testing Steps

1. **Start the Backend:**
   ```bash
   cd server && npm run dev
   ```
   Verify it's running by checking: http://localhost:4001/api/websocket/health

2. **Start the Frontend:**
   ```bash
   cd client && npm run dev
   ```

3. **Navigate to Demo Page:**
   - Open browser to http://localhost:5173/websocket-demo
   - You should see the connection status turn green
   - Random strings should appear every 5-15 seconds

4. **Test Interactions:**
   - Click "Send Ping" - should see latency response
   - Click "Clear Messages" - should clear history
   - Click "Disconnect" then "Connect" - should reconnect
   - Open multiple browser tabs - all should receive same messages

### Expected Behavior

✅ **On Page Load:**
- Automatically connects to WebSocket server
- Shows green "Connected" status
- Displays Socket ID and transport type

✅ **Message Reception:**
- Random strings appear with timestamps
- Messages have smooth fade-in animation
- Auto-scroll keeps latest message visible
- Maximum 50 messages maintained

✅ **Ping Functionality:**
- Shows round-trip latency
- Adds ping response to message history

✅ **Disconnection Handling:**
- Status changes to red "Disconnected"
- Shows reconnection attempts
- Automatically reconnects when server available

✅ **Multiple Clients:**
- All clients receive same random strings
- Each client has unique Socket ID
- Messages synchronized across tabs

## Validation Checklist

✅ **Dependencies**
- [ ] socket.io-client installed
- [ ] date-fns installed (for timestamp formatting)

✅ **Type Safety**
- [ ] Types match backend definitions exactly
- [ ] No TypeScript errors
- [ ] Proper type imports

✅ **Socket Management**
- [ ] Singleton socket instance created
- [ ] Auto-connect disabled by default
- [ ] Proper namespace (/demo) configured

✅ **Hook Functionality**
- [ ] Connection lifecycle managed
- [ ] Event listeners registered and cleaned up
- [ ] Message history maintained (max 50)
- [ ] Prevents multiple connections

✅ **UI Components**
- [ ] Connection status indicator works
- [ ] Messages display with animations
- [ ] Control buttons function correctly
- [ ] Auto-scroll toggle works

✅ **Error Handling**
- [ ] Connection errors displayed
- [ ] Reconnection attempts shown
- [ ] Graceful degradation

✅ **Performance**
- [ ] No memory leaks
- [ ] Event listeners cleaned up
- [ ] Message limit enforced

## Common Issues and Solutions

### Issue: "Cannot connect to WebSocket server"
**Solution:** 
- Ensure backend is running on port 4001
- Check CORS configuration matches frontend URL
- Verify firewall isn't blocking WebSocket connections

### Issue: Messages not appearing
**Solution:**
- Open browser console and check for errors
- Verify namespace is `/demo` (not `/` or empty)
- Check that event names match backend exactly

### Issue: Multiple connection attempts
**Solution:**
- Ensure only one instance of useWebSocket hook active
- Check that React StrictMode isn't causing double-mounting
- Verify singleton pattern in socket.ts

### Issue: TypeScript errors
**Solution:**
- Ensure types are copied exactly from backend
- Install @types/node if needed
- Check import paths are correct

## Notes for Testing Team

The frontend WebSocket integration provides:

1. **Demo Page URL:** http://localhost:5173/websocket-demo
2. **Expected Events:**
   - Random strings every 5-15 seconds
   - Ping responses with latency measurement
   - Connection status updates
3. **Browser Compatibility:**
   - Chrome/Edge: Full WebSocket support
   - Firefox: Full WebSocket support
   - Safari: May need to allow insecure WebSocket in development
4. **Performance Metrics:**
   - Should handle 50+ messages without lag
   - Reconnection within 5 seconds
   - Memory usage stable over time

The implementation is framework-agnostic regarding the backend - it only requires the WebSocket server to be running on the configured port.