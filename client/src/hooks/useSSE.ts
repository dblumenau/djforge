import { useEffect, useRef, useState, useCallback } from 'react';
import { apiEndpoint } from '../config/api';

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

export interface PlaybackEvent {
  type: 'playback:started' | 'playback:queued' | 'playback:paused' | 
        'playback:resumed' | 'playback:skipped' | 'playback:previous' |
        'playback:volume' | 'playback:shuffle' | 'playback:repeat' |
        'playback:cleared' | 'playback:state_changed' | 'connected';
  timestamp: number;
  userId?: string;
  data?: {
    track?: string;
    artist?: string;
    action?: string;
    volume?: number;
    state?: boolean;
    mode?: string;
  };
}

interface UseSSEOptions {
  onEvent?: (event: PlaybackEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export function useSSE(options: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<PlaybackEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // Store callbacks in refs to keep them stable
  const onEventRef = useRef(options.onEvent);
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  const onErrorRef = useRef(options.onError);
  
  // Update refs when callbacks change (without triggering reconnection)
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
    
    // Create new EventSource with auth token in URL
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
      // We'll only intervene if we get an auth error
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
  }, [connect, disconnect]);
  
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