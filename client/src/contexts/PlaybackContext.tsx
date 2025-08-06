import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { webPlayerService } from '../services/webPlayer.service';

export type DevicePreference = 'auto' | 'desktop' | 'web-player' | string;

interface PlaybackContextType {
  devicePreference: DevicePreference;
  setDevicePreference: (preference: DevicePreference) => void;
  showWebPlayer: boolean;
  webPlayerReady: boolean;
  webPlayerDeviceId: string | null;
  initializeWebPlayer: () => Promise<void>;
  disconnectWebPlayer: () => Promise<void>;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export const PlaybackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize with localStorage value immediately to prevent race condition
  const [devicePreference, setDevicePreferenceState] = useState<DevicePreference>(() => {
    const saved = localStorage.getItem('spotifyDevicePreference');
    return (saved as DevicePreference) || 'auto';
  });
  const [webPlayerReady, setWebPlayerReady] = useState(false);
  const [webPlayerDeviceId, setWebPlayerDeviceId] = useState<string | null>(null);
  const [webPlayerInitialized, setWebPlayerInitialized] = useState(false);

  // Derived state
  const showWebPlayer = devicePreference === 'web-player';

  // Listen for storage events (changes from other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'spotifyDevicePreference' && e.newValue) {
        setDevicePreferenceState(e.newValue as DevicePreference);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Listen for custom devicePreferenceChanged events
  useEffect(() => {
    const handleDevicePreferenceChanged = (e: CustomEvent) => {
      if (e.detail && typeof e.detail === 'string') {
        setDevicePreferenceState(e.detail as DevicePreference);
      }
    };

    window.addEventListener('devicePreferenceChanged', handleDevicePreferenceChanged as EventListener);
    
    return () => {
      window.removeEventListener('devicePreferenceChanged', handleDevicePreferenceChanged as EventListener);
    };
  }, []);

  // Set up web player event listeners
  useEffect(() => {
    let unsubscribeDeviceReady: (() => void) | null = null;
    let unsubscribeError: (() => void) | null = null;

    if (webPlayerInitialized) {
      // Listen for device ready events
      unsubscribeDeviceReady = webPlayerService.onDeviceReady((deviceId: string) => {
        setWebPlayerDeviceId(deviceId);
        setWebPlayerReady(true);
      });

      // Listen for error events
      unsubscribeError = webPlayerService.onError((error: string) => {
        console.error('[PlaybackContext] Web Player error:', error);
        // Could dispatch to ErrorContext here if needed
      });

      // Check if already ready
      if (webPlayerService.isReady()) {
        const deviceId = webPlayerService.getDeviceId();
        setWebPlayerDeviceId(deviceId);
        setWebPlayerReady(true);
      }
    }

    return () => {
      if (unsubscribeDeviceReady) unsubscribeDeviceReady();
      if (unsubscribeError) unsubscribeError();
    };
  }, [webPlayerInitialized]);

  // Initialize web player when needed
  useEffect(() => {
    if (showWebPlayer && !webPlayerInitialized) {
      initializeWebPlayer();
    }
  }, [showWebPlayer, webPlayerInitialized]);

  const setDevicePreference = (preference: DevicePreference) => {
    setDevicePreferenceState(preference);
    localStorage.setItem('spotifyDevicePreference', preference);
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('devicePreferenceChanged', { 
      detail: preference 
    }));
  };

  const initializeWebPlayer = async () => {
    if (webPlayerInitialized) return;
    
    try {
      setWebPlayerInitialized(true);
      await webPlayerService.initialize();
    } catch (error) {
      console.error('[PlaybackContext] Failed to initialize web player:', error);
      setWebPlayerInitialized(false);
      setWebPlayerReady(false);
      setWebPlayerDeviceId(null);
    }
  };

  const disconnectWebPlayer = async () => {
    try {
      await webPlayerService.disconnect();
      setWebPlayerReady(false);
      setWebPlayerDeviceId(null);
      setWebPlayerInitialized(false);
    } catch (error) {
      console.error('[PlaybackContext] Failed to disconnect web player:', error);
    }
  };

  return (
    <PlaybackContext.Provider 
      value={{ 
        devicePreference,
        setDevicePreference,
        showWebPlayer,
        webPlayerReady,
        webPlayerDeviceId,
        initializeWebPlayer,
        disconnectWebPlayer
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};

export const usePlayback = () => {
  const context = useContext(PlaybackContext);
  if (context === undefined) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
};