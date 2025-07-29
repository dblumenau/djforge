import React, { useEffect, useState } from 'react';
import { webPlayerService } from '../services/webPlayer.service';
import { isMobileDevice } from '../utils/deviceDetection';

export const WebPlayerAutoInit: React.FC = () => {
  const [needsActivation, setNeedsActivation] = useState(false);

  useEffect(() => {
    const initWebPlayer = async () => {
      try {
        console.log('[WebPlayerAutoInit] Starting automatic initialization...');
        
        // Check if already initialized
        if (webPlayerService.isReady()) {
          console.log('[WebPlayerAutoInit] Already initialized');
          return;
        }

        // Initialize the web player
        await webPlayerService.initialize();
        console.log('[WebPlayerAutoInit] Initialization complete');

        // Check if mobile and needs activation
        if (isMobileDevice()) {
          setNeedsActivation(true);
        }

        // Wait for device to be ready before checking preference
        const unsubscribe = webPlayerService.onDeviceReady(async (deviceId) => {
          console.log('[WebPlayerAutoInit] Device ready:', deviceId);
          
          // Check if Web SDK is the preferred device
          const devicePreference = localStorage.getItem('spotifyDevicePreference');
          if (devicePreference === 'web-player') {
            console.log('[WebPlayerAutoInit] Web player is preferred device, transferring playback...');
            try {
              await webPlayerService.transferPlayback();
              console.log('[WebPlayerAutoInit] Playback transferred to web player');
            } catch (err) {
              console.log('[WebPlayerAutoInit] Could not transfer playback (might not be playing)');
            }
          }
          
          // Unsubscribe after handling
          unsubscribe();
        });
      } catch (err) {
        console.error('[WebPlayerAutoInit] Failed to initialize:', err);
      }
    };

    // Initialize after a short delay to ensure auth is ready
    const timer = setTimeout(initWebPlayer, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleActivate = async () => {
    try {
      await webPlayerService.activateElement();
      setNeedsActivation(false);
    } catch (err) {
      console.error('[WebPlayerAutoInit] Failed to activate:', err);
    }
  };

  if (needsActivation) {
    return (
      <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg z-50">
        <p className="text-white text-sm mb-2">Tap to enable playback controls</p>
        <button
          onClick={handleActivate}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Enable Playback
        </button>
      </div>
    );
  }

  // Don't render anything visible
  return null;
};

export default WebPlayerAutoInit;