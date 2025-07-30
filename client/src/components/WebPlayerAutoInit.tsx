import React, { useEffect, useState } from 'react';
import { webPlayerService } from '../services/webPlayer.service';

export const WebPlayerAutoInit: React.FC = () => {
  const [devicePreference, setDevicePreference] = useState<string>('auto');
  // const [initStatus, setInitStatus] = useState<string>('Not started');
  // const [deviceId, setDeviceId] = useState<string | null>(null);
  // const [lastError, setLastError] = useState<string | null>(null);

  // Track device preference changes
  useEffect(() => {
    const checkDevicePreference = () => {
      const savedPreference = localStorage.getItem('spotifyDevicePreference') || 'auto';
      setDevicePreference(savedPreference);
    };
    
    // Check initially
    checkDevicePreference();
    
    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'spotifyDevicePreference') {
        checkDevicePreference();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    // Listen for errors
    const unsubscribeError = webPlayerService.onError((error) => {
      console.error('[WebPlayerAutoInit] Web Player error:', error);
      // setLastError(error);
    });
    const initWebPlayer = async () => {
      try {
        console.log('[WebPlayerAutoInit] Starting automatic initialization...');
        // setInitStatus('Starting initialization...');
        
        // Check if already initialized
        if (webPlayerService.isReady()) {
          console.log('[WebPlayerAutoInit] Already initialized');
          // setInitStatus('Already initialized');
          // setDeviceId(webPlayerService.getDeviceId());
          return;
        }

        // Initialize the web player
        // setInitStatus('Initializing web player...');
        await webPlayerService.initialize();
        console.log('[WebPlayerAutoInit] Initialization complete');
        // setInitStatus('Initialization complete, waiting for device ready...');

        // Mobile activation is now handled in MobileMenu component

        // Wait for device to be ready before checking preference
        const unsubscribe = webPlayerService.onDeviceReady(async (deviceId) => {
          console.log('[WebPlayerAutoInit] Device ready:', deviceId);
          // setInitStatus('Device ready!');
          // setDeviceId(deviceId);
          
          // Check if Web SDK is the preferred device
          const devicePreference = localStorage.getItem('spotifyDevicePreference');
          if (devicePreference === 'web-player') {
            console.log('[WebPlayerAutoInit] Web player is preferred device, transferring playback...');
            // setInitStatus('Transferring playback to web player...');
            try {
              await webPlayerService.transferPlayback();
              console.log('[WebPlayerAutoInit] Playback transferred to web player');
              // setInitStatus('Playback transferred successfully!');
            } catch (err) {
              console.log('[WebPlayerAutoInit] Could not transfer playback (might not be playing)');
              // setInitStatus('Ready (no active playback to transfer)');
            }
          } else {
            // setInitStatus('Web player ready');
          }
          
          // Unsubscribe after handling
          unsubscribe();
        });
      } catch (err) {
        console.error('[WebPlayerAutoInit] Failed to initialize:', err);
        // const errorMessage = err instanceof Error ? err.message : 'Failed to initialize';
        // setInitStatus(`Error: ${errorMessage}`);
      }
    };

    const timer = setTimeout(initWebPlayer, 1000);

    return () => {
      clearTimeout(timer);
      unsubscribeError();
    };
  }, [devicePreference]);

  // Activation UI is now handled in MobileMenu for better UX integration
  // No popup needed here anymore

  // TEMPORARY: Show debug info
  // const currentPref = localStorage.getItem('spotifyDevicePreference');
  
  // return (
  //   <div className="fixed bottom-20 right-4 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg z-50 max-w-sm">
  //     <h3 className="text-white font-semibold mb-2">Web Player Debug</h3>
  //     <div className="text-sm text-gray-300 space-y-1">
  //       <p>Status: {initStatus}</p>
  //       <p>Device ID: {deviceId || 'Not available'}</p>
  //       <p>Is Ready: {webPlayerService.isReady() ? 'Yes' : 'No'}</p>
  //       <p className="text-yellow-400">Device Preference: {currentPref || 'not set'}</p>
  //       {lastError && (
  //         <p className="text-red-400">Error: {lastError}</p>
  //       )}
  //     </div>
  //     {currentPref === 'web-player' && (
  //       <p className="text-green-400 mt-2 text-xs">✓ Web player UI should be visible!</p>
  //     )}
  //   </div>
  // );
  
  return null;
};

export default WebPlayerAutoInit;