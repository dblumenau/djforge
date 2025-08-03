import { useState, useEffect } from 'react';
import { musicSocket } from '../services/socket';

interface PlaylistDiscoveryProgress {
  step: string;
  phase: 'idle' | 'searching' | 'analyzing' | 'fetching' | 'summarizing' | 'complete';
  progress: number;
  itemNumber?: number;
  totalItems?: number;
  metadata?: any;
}

export default function usePlaylistDiscoveryProgress(sessionId: string): PlaylistDiscoveryProgress {
  const [currentProgress, setCurrentProgress] = useState<PlaylistDiscoveryProgress>({
    phase: 'idle',
    step: '',
    progress: 0
  });

  useEffect(() => {
    // Ensure music socket is connected for progress updates
    if (!musicSocket.connected) {
      console.log('[PlaylistDiscoveryProgress] Connecting to music socket...');
      musicSocket.connect();
    } else {
      console.log('[PlaylistDiscoveryProgress] Music socket already connected');
    }

    const handleProgressUpdate = (data: any) => {
      console.log('[PlaylistDiscoveryProgress] Received update:', data);
      
      if (data.sessionId !== sessionId) {
        console.log('[PlaylistDiscoveryProgress] Ignoring update for different session:', data.sessionId, 'vs', sessionId);
        return;
      }

      // Calculate progress percentage based on phase and item numbers
      let calculatedProgress = 0;
      
      switch (data.phase) {
        case 'searching':
          calculatedProgress = Math.min(20, data.progress || 0);
          break;
        case 'analyzing':
          calculatedProgress = 20 + Math.min(20, data.progress || 0);
          break;
        case 'fetching':
          if (data.itemNumber && data.totalItems) {
            const phaseProgress = (data.itemNumber / data.totalItems) * 30;
            calculatedProgress = 40 + phaseProgress;
          } else {
            calculatedProgress = 40 + Math.min(30, data.progress || 0);
          }
          break;
        case 'summarizing':
          if (data.itemNumber && data.totalItems) {
            const phaseProgress = (data.itemNumber / data.totalItems) * 25;
            calculatedProgress = 70 + phaseProgress;
          } else {
            calculatedProgress = 70 + Math.min(25, data.progress || 0);
          }
          break;
        case 'complete':
          calculatedProgress = 100;
          break;
        default:
          calculatedProgress = data.progress || 0;
      }

      setCurrentProgress({
        step: data.step || '',
        phase: data.phase || 'idle',
        progress: Math.round(calculatedProgress),
        itemNumber: data.itemNumber,
        totalItems: data.totalItems,
        metadata: data.metadata
      });
    };

    console.log('[PlaylistDiscoveryProgress] Registering event listener for sessionId:', sessionId);
    musicSocket.on('playlistDiscoveryProgress', handleProgressUpdate);

    // Also listen for any event to debug
    const handleAnyEvent = (...args: any[]) => {
      console.log('[PlaylistDiscoveryProgress] Music socket received event:', args);
    };
    musicSocket.onAny(handleAnyEvent);

    return () => {
      console.log('[PlaylistDiscoveryProgress] Cleaning up event listeners');
      musicSocket.off('playlistDiscoveryProgress', handleProgressUpdate);
      musicSocket.offAny(handleAnyEvent);
      // Note: We don't disconnect here since other components may be using the music socket
    };
  }, [sessionId]);

  return currentProgress;
}