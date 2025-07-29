import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModelSelector from './ModelSelector';
import DeviceSelector from './DeviceSelector';
import WeatherDisplay from './WeatherDisplay';
import PlaybackControls from './PlaybackControls';
import SpotifyPlayer from './SpotifyPlayer';
import QueueDisplay from './QueueDisplay';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { api } from '../utils/api';

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
  const { accessToken } = useSpotifyAuth();

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
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically when menu is open
    let interval: NodeJS.Timeout | null = null;
    if (isOpen) {
      interval = setInterval(checkDevicePreference, 1000);
    }
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (interval) clearInterval(interval);
    };
  }, [isOpen]);

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
        className={`fixed top-0 right-0 h-full w-80 bg-zinc-900 border-l border-zinc-800 z-50 transform transition-transform duration-300 md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
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
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Weather</h3>
              <WeatherDisplay />
            </div>

            {/* Model & Device Selectors */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">AI Model</h3>
                <ModelSelector onModelChange={onModelChange} fullWidth />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Playback Device</h3>
                <DeviceSelector onDeviceChange={onDeviceChange} fullWidth />
              </div>
            </div>

            {/* Playback Controls or Web Player */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Playback</h3>
              {devicePreference === 'web-player' && accessToken ? (
                <SpotifyPlayer 
                  token={accessToken}
                  onDeviceReady={(deviceId) => {
                    console.log('[MobileMenu] Web Player device ready:', deviceId);
                    // Transfer playback to web player
                    api.post('/api/control/transfer', { deviceId, play: false })
                      .catch(err => console.error('Failed to transfer to web player:', err));
                  }}
                />
              ) : (
                <PlaybackControls onShowQueue={() => setShowQueue(true)} isMobile />
              )}
            </div>

            {/* Navigation */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Navigation</h3>
              <nav className="space-y-2">
                <button
                  onClick={() => {
                    navigate('/');
                    onClose();
                  }}
                  className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-left rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>💬</span>
                  <span>Chat</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard');
                    onClose();
                  }}
                  className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-left rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>📊</span>
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/feedback-dashboard');
                    onClose();
                  }}
                  className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-left rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>🎯</span>
                  <span>Feedback</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/logs');
                    onClose();
                  }}
                  className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-left rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>📋</span>
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
                    <span>🔌</span>
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
              <span>🚪</span>
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