import { useEffect, useState, useCallback, useRef } from 'react';
import { socket, getSocketId, getTransport } from '../services/socket';

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