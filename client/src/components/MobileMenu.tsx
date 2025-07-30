import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModelSelector from './ModelSelector';
import DeviceSelector from './DeviceSelector';
import WeatherDisplay from './WeatherDisplay';
import PlaybackControls from './PlaybackControls';
import SpotifyPlayer from './SpotifyPlayer';
import QueueDisplay from './QueueDisplay';
import { useAuth } from '../contexts/AuthContext';
import { webPlayerService } from '../services/webPlayer.service';
import { isMobileDevice } from '../utils/deviceDetection';
import { MessageSquare, BarChart3, Target, ClipboardList, Plug, LogOut } from 'lucide-react';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onModelChange: (model: string) => void;
  onDeviceChange: (deviceId: string | 'auto') => void;
  onLogout: () => void;
  isAdmin?: boolean;
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  onModelChange,
  onDeviceChange,
  onLogout,
  isAdmin = false
}) => {
  const navigate = useNavigate();
  const [showQueue, setShowQueue] = useState(false);
  const [devicePreference, setDevicePreference] = useState<string>('auto');
  const [needsWebPlayerActivation, setNeedsWebPlayerActivation] = useState(false);
  const { isAuthenticated } = useAuth();

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Track device preference from localStorage
  useEffect(() => {
    const checkDevicePreference = () => {
      const savedPreference = localStorage.getItem('spotifyDevicePreference') || 'auto';
      setDevicePreference(savedPreference);
    };
    
    // Check initially and when menu opens
    if (isOpen) {
      checkDevicePreference();
    }
    
    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'spotifyDevicePreference') {
        checkDevicePreference();
      }
    };
    
    // Also listen for custom event that DeviceSelector dispatches
    const handleDeviceChange = () => {
      checkDevicePreference();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('devicePreferenceChanged', handleDeviceChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('devicePreferenceChanged', handleDeviceChange);
    };
  }, [isOpen]);

  // Clean up web player when device preference changes away from web-player
  useEffect(() => {
    console.log('[MobileMenu] Device preference changed:', devicePreference);
    console.log('[MobileMenu] Web player is ready:', webPlayerService.isReady());
    
    if (devicePreference !== 'web-player') {
      // Disconnect the web player when not in use
      webPlayerService.disconnect();
      setNeedsWebPlayerActivation(false);
      console.log('[MobileMenu] Set needsWebPlayerActivation to false');
    } else if (devicePreference === 'web-player') {
      // Check if we're on mobile and need activation
      if (isMobileDevice() && !webPlayerService.isReady()) {
        setNeedsWebPlayerActivation(true);
        console.log('[MobileMenu] Mobile device needs web player activation');
      } else {
        setNeedsWebPlayerActivation(false);
        console.log('[MobileMenu] Web player ready or not mobile device');
      }
    }
  }, [devicePreference]);

  // Listen for web player ready events
  useEffect(() => {
    const unsubscribe = webPlayerService.onDeviceReady(() => {
      setNeedsWebPlayerActivation(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Handle web player activation
  const handleActivateWebPlayer = async () => {
    try {
      await webPlayerService.activateElement();
      setNeedsWebPlayerActivation(false);
    } catch (err) {
      console.error('[MobileMenu] Failed to activate web player:', err);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-out menu */}
      <div
        className={`fixed top-0 left-0 h-full w-full bg-zinc-900 z-50 transform transition-transform duration-300 md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Weather */}
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <WeatherDisplay />
            </div>

            {/* Model & Device Selectors */}
            <div className="space-y-4">
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">AI Model</h3>
                <ModelSelector onModelChange={onModelChange} fullWidth />
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Playback Device</h3>
                <DeviceSelector onDeviceChange={onDeviceChange} fullWidth />
              </div>
            </div>

            {/* Web Player Activation (Mobile only) */}
            {needsWebPlayerActivation && devicePreference === 'web-player' && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Player Activation Required</h3>
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                  <p className="text-white text-sm mb-2">Tap to activate Built In Player</p>
                  <p className="text-gray-400 text-xs mb-3">Mobile browsers require user interaction to enable audio playback</p>
                  <button
                    onClick={handleActivateWebPlayer}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Activate Player
                  </button>
                </div>
              </div>
            )}

            {/* Playback Controls or Web Player */}
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Playback</h3>
              {devicePreference === 'web-player' && isAuthenticated ? (
                <SpotifyPlayer
                  onDeviceReady={(deviceId) => {
                    console.log('[MobileMenu] Web Player device ready:', deviceId);
                  }}
                  onPlayerStateChanged={(state) => {
                    console.log('[MobileMenu] Web Player state changed:', state);
                  }}
                />
              ) : (
                <PlaybackControls 
                  onShowQueue={() => setShowQueue(true)} 
                  isMobile 
                  devicePreference={devicePreference}
                />
              )}
            </div>

            {/* Navigation */}
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Navigation</h3>
              <nav className="space-y-2">
                <button
                  onClick={() => {
                    navigate('/');
                    onClose();
                  }}
                  className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-left rounded-lg transition-colors flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-green-500" />
                  <span>Chat</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard');
                    onClose();
                  }}
                  className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-left rounded-lg transition-colors flex items-center gap-2"
                >
                  <BarChart3 className="w-4 h-4 text-green-500" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/feedback-dashboard');
                    onClose();
                  }}
                  className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-left rounded-lg transition-colors flex items-center gap-2"
                >
                  <Target className="w-4 h-4 text-green-500" />
                  <span>Feedback</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/logs');
                    onClose();
                  }}
                  className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-left rounded-lg transition-colors flex items-center gap-2"
                >
                  <ClipboardList className="w-4 h-4 text-green-500" />
                  <span>Logs</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      navigate('/admin/sse-status');
                      onClose();
                    }}
                    className="w-full px-4 py-2 bg-purple-900/20 hover:bg-purple-900/30 text-purple-300 hover:text-purple-200 text-left rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plug className="w-4 h-4 text-green-500" />
                    <span>SSE Status</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    window.location.reload();
                  }}
                  className="w-full px-4 py-2 bg-blue-900/20 hover:bg-blue-900/30 text-blue-300 hover:text-blue-200 border border-blue-800/50 hover:border-blue-700/50 rounded-lg transition-all flex items-center gap-2"
                >
                  <span>🔄</span>
                  <span>Refresh</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-800" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-300 hover:text-red-200 border border-red-800/50 hover:border-red-700/50 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4 text-green-500" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Queue Display Modal - Rendered at high z-index */}
      {showQueue && <QueueDisplay onClose={() => setShowQueue(false)} />}
    </>
  );
};

export default MobileMenu;