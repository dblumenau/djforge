import { useEffect, useState, useCallback, useRef } from 'react';
import { musicSocket, updateMusicSocketAuth } from '../services/musicSocket';
import { toast } from 'sonner';

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
  const [connected, setConnected] = useState(musicSocket.connected);
  const [lastUpdate, setLastUpdate] = useState<PlaybackUpdate | null>(null);
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
        toast.info(`AI playing: ${data.current.name}`);
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
        toast.success(`Added ${data.totalItems} tracks to queue`);
      }
      
      if (onQueueUpdate) {
        onQueueUpdate(data);
      }
    };
    
    const handleCommandExecuted = (data: any) => {
      console.log('[Music WS] Command executed:', data);
      
      // Show toast for failed commands
      if (!data.success && data.error) {
        toast.error(`Command failed: ${data.error}`);
      }
      
      if (onCommandExecuted) {
        onCommandExecuted(data);
      }
    };
    
    const handleVolumeChanged = (data: any) => {
      console.log('[Music WS] Volume changed:', data);
      setLastUpdate({ type: 'volume', data, timestamp: Date.now() });
    };
    
    const handleDeviceChanged = (data: any) => {
      console.log('[Music WS] Device changed:', data);
      setLastUpdate({ type: 'device', data, timestamp: Date.now() });
      toast.info(`Switched to ${data.currentDevice}`);
    };
    
    // Register event listeners
    musicSocket.on('connect', handleConnect);
    musicSocket.on('disconnect', handleDisconnect);
    musicSocket.on('playbackStateChanged', handlePlaybackStateChange);
    musicSocket.on('trackChanged', handleTrackChange);
    musicSocket.on('queueUpdated', handleQueueUpdate);
    musicSocket.on('commandExecuted', handleCommandExecuted);
    musicSocket.on('volumeChanged', handleVolumeChanged);
    musicSocket.on('deviceChanged', handleDeviceChanged);
    
    // Connect if not connected
    if (!musicSocket.connected) {
      const sessionId = localStorage.getItem('spotify_session_id');
      if (sessionId) {
        updateMusicSocketAuth();
        musicSocket.connect();
      }
    } else {
      // Socket already connected, update state and subscribe
      setConnected(true);
      subscribeToPlayback();
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
      musicSocket.off('volumeChanged', handleVolumeChanged);
      musicSocket.off('deviceChanged', handleDeviceChanged);
    };
  }, [onPlaybackStateChange, onTrackChange, onQueueUpdate, onCommandExecuted, subscribeToPlayback, unsubscribeFromPlayback]);
  
  return {
    connected,
    lastUpdate,
    subscribeToPlayback,
    unsubscribeFromPlayback,
    requestSync
  };
}