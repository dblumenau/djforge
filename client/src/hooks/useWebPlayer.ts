import { useEffect, useState } from 'react';
import { webPlayerService, PlayerState } from '../services/webPlayer.service';

interface UseWebPlayerReturn {
  playerState: PlayerState;
  isReady: boolean;
  error: string | null;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  activateElement: () => Promise<void>;
  transferPlayback: () => Promise<void>;
  getCurrentPosition: () => number;
}

export function useWebPlayer(
  onDeviceReady?: (deviceId: string) => void
): UseWebPlayerReturn {
  const [playerState, setPlayerState] = useState<PlayerState>(webPlayerService.getState());
  const [isReady, setIsReady] = useState(webPlayerService.isReady());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize the web player service
    webPlayerService.initialize().catch(err => {
      console.error('Failed to initialize web player:', err);
      setError('Failed to initialize web player');
    });

    // Subscribe to state changes
    const unsubscribeState = webPlayerService.onStateChange((state) => {
      setPlayerState(state);
      setIsReady(webPlayerService.isReady());
    });

    // Subscribe to device ready events
    const unsubscribeDevice = webPlayerService.onDeviceReady((deviceId) => {
      if (onDeviceReady) {
        onDeviceReady(deviceId);
      }
    });

    // Subscribe to errors
    const unsubscribeError = webPlayerService.onError((err) => {
      setError(err);
    });

    // Cleanup
    return () => {
      unsubscribeState();
      unsubscribeDevice();
      unsubscribeError();
    };
  }, [onDeviceReady]);

  // Control methods
  const play = async () => {
    try {
      await webPlayerService.play();
      setError(null);
    } catch (err) {
      setError('Failed to play');
      throw err;
    }
  };

  const pause = async () => {
    try {
      await webPlayerService.pause();
      setError(null);
    } catch (err) {
      setError('Failed to pause');
      throw err;
    }
  };

  const togglePlayPause = async () => {
    try {
      await webPlayerService.togglePlayPause();
      setError(null);
    } catch (err) {
      setError('Failed to toggle playback');
      throw err;
    }
  };

  const nextTrack = async () => {
    try {
      await webPlayerService.nextTrack();
      setError(null);
    } catch (err) {
      setError('Failed to skip to next track');
      throw err;
    }
  };

  const previousTrack = async () => {
    try {
      await webPlayerService.previousTrack();
      setError(null);
    } catch (err) {
      setError('Failed to skip to previous track');
      throw err;
    }
  };

  const seek = async (positionMs: number) => {
    try {
      await webPlayerService.seek(positionMs);
      setError(null);
    } catch (err) {
      setError('Failed to seek');
      throw err;
    }
  };

  const setVolume = async (volume: number) => {
    try {
      await webPlayerService.setVolume(volume);
      setError(null);
    } catch (err) {
      setError('Failed to set volume');
      throw err;
    }
  };

  const activateElement = async () => {
    try {
      await webPlayerService.activateElement();
      setError(null);
    } catch (err) {
      setError('Failed to activate player for mobile');
      throw err;
    }
  };

  const transferPlayback = async () => {
    try {
      await webPlayerService.transferPlayback();
      setError(null);
    } catch (err) {
      setError('Failed to transfer playback');
      throw err;
    }
  };

  const getCurrentPosition = () => {
    return webPlayerService.getCurrentPosition();
  };

  return {
    playerState,
    isReady,
    error,
    play,
    pause,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    activateElement,
    transferPlayback,
    getCurrentPosition
  };
}