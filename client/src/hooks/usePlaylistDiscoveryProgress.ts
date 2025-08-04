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
      // New distribution that better reflects actual work time:
      // - Searching: 0-5% (very fast, ~1-2 seconds)
      // - Analyzing: 5-15% (fast LLM selection, ~1-2 seconds)
      // - Fetching: 15-35% (moderate speed, ~3-5 seconds)
      // - Summarizing: 35-90% (bulk of the work, 10-30+ seconds)
      // - Complete: 100%
      
      let calculatedProgress = 0;
      
      switch (data.phase) {
        case 'searching':
          // Searching phase: 0-5%
          calculatedProgress = Math.min(5, data.progress || 0);
          break;
        case 'analyzing':
          // Analyzing phase: 5-15% (10% of progress)
          calculatedProgress = 5 + Math.min(10, data.progress || 0);
          break;
        case 'fetching':
          // Fetching phase: 15-35% (20% of progress)
          if (data.itemNumber && data.totalItems) {
            const phaseProgress = (data.itemNumber / data.totalItems) * 20;
            calculatedProgress = 15 + phaseProgress;
          } else {
            calculatedProgress = 15 + Math.min(20, data.progress || 0);
          }
          break;
        case 'summarizing':
          // Summarizing phase: 35-90% (55% of progress - the bulk of the work)
          if (data.itemNumber && data.totalItems) {
            // Check if we're in the finalizing step
            if (data.metadata?.finalizing) {
              // Show 90-95% for finalizing
              calculatedProgress = 90;
            } else {
              // Normal summarizing progress (35-90%)
              const phaseProgress = (data.itemNumber / data.totalItems) * 55;
              calculatedProgress = 35 + phaseProgress;
            }
          } else {
            calculatedProgress = 35 + Math.min(55, data.progress || 0);
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