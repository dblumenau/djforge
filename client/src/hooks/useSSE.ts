import { useState, useCallback, useRef, useEffect } from 'react';
import { apiEndpoint } from '../config/api';
import { authService } from '../services/auth.service';

// Global connection manager to prevent multiple simultaneous connections
class SSEConnectionManager {
  private isConnecting = false;
  private activeConnection: EventSource | null = null;
  
  canConnect(): boolean {
    return !this.isConnecting && !this.activeConnection;
  }
  
  setConnecting(connecting: boolean) {
    this.isConnecting = connecting;
  }
  
  setConnection(connection: EventSource | null) {
    this.activeConnection = connection;
  }
  
  disconnect() {
    if (this.activeConnection) {
      this.activeConnection.close();
      this.activeConnection = null;
    }
    this.isConnecting = false;
  }
}

const globalSSEManager = new SSEConnectionManager();

export interface PlaybackEvent {
  type: 'playback_update' | 'queue_update' | 'device_update' | 'connected' | 'error';
  data?: {
    isPlaying?: boolean;
    track?: {
      name: string;
      artist: string;
      album: string;
      duration: number;
      position: number;
      id?: string;
    };
    devices?: any[];
    queue?: any[];
    volume?: number;
    shuffleState?: boolean;
    repeatState?: string;
  };
  timestamp: number;
  error?: string;
  code?: string;
}

interface UseSSEOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onEvent?: (event: PlaybackEvent) => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
}

export function useSSE(options: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<PlaybackEvent | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  // Store callbacks in refs to avoid recreating functions
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  const onEventRef = useRef(options.onEvent);
  const onErrorRef = useRef(options.onError);
  
  // Update refs when options change
  onConnectRef.current = options.onConnect;
  onDisconnectRef.current = options.onDisconnect;
  onEventRef.current = options.onEvent;
  onErrorRef.current = options.onError;

  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting from event stream');
    
    globalSSEManager.disconnect();
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionError(null);
    reconnectAttemptsRef.current = 0;
    
    onDisconnectRef.current?.();
  }, []);

  const connect = useCallback(() => {
    // Use global manager to prevent multiple connections
    if (!globalSSEManager.canConnect()) {
      console.log('[SSE] Connection blocked - already connecting or connected globally');
      return;
    }

    // Don't connect if already connected locally
    if (eventSourceRef.current || isConnected) {
      console.log('[SSE] Already connected or connecting locally');
      return;
    }

    const sessionId = authService.getSessionId();
    if (!sessionId) {
      console.error('[SSE] No session ID available for SSE connection');
      setConnectionError('No session available');
      onErrorRef.current?.(new Error('No session available'));
      return;
    }

    console.log('[SSE] Connecting to event stream with session:', sessionId);
    globalSSEManager.setConnecting(true);
    
    try {
      const eventSourceUrl = `${apiEndpoint('/api/events')}?sessionId=${encodeURIComponent(sessionId)}`;
      const eventSource = new EventSource(eventSourceUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Connection opened');
        globalSSEManager.setConnecting(false);
        globalSSEManager.setConnection(eventSource);
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        onConnectRef.current?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Received event:', data.type);
          
          setLastEvent(data);
          onEventRef.current?.(data);
        } catch (error) {
          console.error('[SSE] Failed to parse event data:', error, event.data);
        }
      };

      eventSource.addEventListener('error', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          console.error('[SSE] Received error event:', data);
          setConnectionError(data.error || 'SSE error event');
          onErrorRef.current?.(new Error(data.error || 'SSE error event'));
          
          // Close connection on auth errors
          if (data.code === 'NO_SESSION' || data.code === 'INVALID_SESSION') {
            disconnect();
            return;
          }
        } catch (parseError) {
          console.error('[SSE] Failed to parse error event:', parseError);
        }
      });

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        globalSSEManager.disconnect(); // Reset global state on error
        setIsConnected(false);
        setConnectionError('Connection failed');
        
        // Conservative reconnection with safe throttling
        if (options.autoReconnect !== false && reconnectAttemptsRef.current < 3) {
          const baseDelay = 10000; // Start with 10 seconds
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), 60000); // Cap at 60s
          console.log(`[SSE] Safe reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/3)`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            eventSourceRef.current = null;
            
            // Extra safety check before reconnecting
            if (globalSSEManager.canConnect()) {
              connect();
            } else {
              console.log('[SSE] Reconnect blocked - another connection active');
            }
          }, delay);
        } else {
          console.log('[SSE] Max reconnection attempts reached (3) - SSE disabled to prevent spam');
          console.log('[SSE] If you want to retry, refresh the page');
          onErrorRef.current?.(new Error('SSE connection failed'));
        }
      };

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      setConnectionError('Failed to create connection');
      onErrorRef.current?.(error as Error);
    }
  }, [isConnected, options.autoReconnect, disconnect]);

  // SSE DISABLED - auto-connect turned off
  useEffect(() => {
    console.log('[SSE] Auto-connect disabled - SSE turned off');
    
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    lastEvent,
    connectionError,
    connect,
    disconnect,
    reconnect: connect
  };
}