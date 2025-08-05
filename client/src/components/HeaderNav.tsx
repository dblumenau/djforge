import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ModelSelector from './ModelSelector';
import DeviceSelector from './DeviceSelector';
import WeatherDisplay from './WeatherDisplay';
import HeaderPlaybackControls from './HeaderPlaybackControls';
import { MessageSquare, BarChart3, Target, ClipboardList, RefreshCw, LogOut, MoreVertical, Wifi, Search, Music2 } from 'lucide-react';

interface HeaderNavProps {
  onModelChange: (model: string) => void;
  onDeviceChange: (deviceId: string | 'auto') => void;
  onLogout: () => void;
  onMenuToggle: () => void;
  isDevMode?: boolean;
  onExpireTokens?: () => void;
  onRevokeTokens?: () => void;
  isAdmin?: boolean;
}

const HeaderNav: React.FC<HeaderNavProps> = ({
  onModelChange,
  onDeviceChange,
  onLogout,
  onMenuToggle
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="app-header border-b border-zinc-800/50 backdrop-blur-md">
      <div className="h-16 flex items-center justify-between px-4 md:px-4 px-1" style={{ maxWidth: '1440px', margin: '0 auto' }}>
          {/* Mobile Layout */}
          <div className="md:hidden flex items-center w-full h-full py-1">
            {/* Left: Mobile Menu Button */}
            <button
              onClick={onMenuToggle}
              className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Center: Header Playback Controls */}
            <div className="flex-1 flex px-1">
              <HeaderPlaybackControls />
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between w-full">
            {/* Left: Logo and Navigation */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <img 
                  src="/square_icon.png" 
                  alt="DJ Forge" 
                  className="h-8 w-8"
                />
                <h1 className="text-xl font-bold">DJ Forge</h1>
              </div>

              <nav className="flex items-center gap-6">
                <button
                  onClick={() => navigate('/')}
                  className={`flex items-center gap-2 text-sm font-medium transition-all ${
                    location.pathname === '/' 
                      ? 'text-white' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className={`w-4 h-4 ${location.pathname === '/' ? 'text-green-500' : ''}`} />
                  Chat
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`flex items-center gap-2 text-sm font-medium transition-all ${
                    location.pathname === '/dashboard' 
                      ? 'text-white' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <BarChart3 className={`w-4 h-4 ${location.pathname === '/dashboard' ? 'text-green-500' : ''}`} />
                  Dashboard
                </button>
                <button
                  onClick={() => navigate('/playlist-tools')}
                  className={`flex items-center gap-2 text-sm font-medium transition-all ${
                    location.pathname === '/playlist-tools' 
                      ? 'text-white' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Music2 className={`w-4 h-4 ${location.pathname === '/playlist-tools' ? 'text-green-500' : ''}`} />
                  Playlist Tools
                </button>
                <button
                  onClick={() => navigate('/feedback-dashboard')}
                  className={`flex items-center gap-2 text-sm font-medium transition-all ${
                    location.pathname === '/feedback-dashboard' 
                      ? 'text-white' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Target className={`w-4 h-4 ${location.pathname === '/feedback-dashboard' ? 'text-green-500' : ''}`} />
                  Feedback
                </button>
                <button 
                  onClick={() => navigate('/playlist-search')}
                  className={`hidden lg:flex items-center gap-2 text-sm font-medium transition-all ${
                    location.pathname === '/playlist-search' 
                      ? 'text-white' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Search className={`w-4 h-4 ${location.pathname === '/playlist-search' ? 'text-green-500' : ''}`} />
                  Playlist Search
                </button>
              </nav>
            </div>

            {/* Center: Playback Controls */}
            <HeaderPlaybackControls />

            {/* Right: Weather and Settings */}
            <div className="flex items-center gap-4">
              <WeatherDisplay compact />
              
              {/* Settings Dropdown */}
              <div className="relative" ref={settingsRef}>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-all"
                  aria-label="Settings"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showSettings && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50">
                    <div className="p-2">
                      {/* Extra navigation items */}
                      <div className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">More</div>
                      <div className="space-y-1 mb-2">
                        <button 
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 rounded transition-all flex items-center gap-3 ${
                            location.pathname === '/websocket-demo' ? 'text-white bg-zinc-800' : 'text-zinc-300 hover:text-white'
                          }`}
                          onClick={() => {
                            navigate('/websocket-demo');
                            setShowSettings(false);
                          }}
                        >
                          <Wifi className={`w-4 h-4 ${location.pathname === '/websocket-demo' ? 'text-green-500' : ''}`} />
                          WebSocket Demo
                        </button>
                        <button 
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 rounded transition-all flex items-center gap-3 ${
                            location.pathname === '/logs' ? 'text-white bg-zinc-800' : 'text-zinc-300 hover:text-white'
                          }`}
                          onClick={() => {
                            navigate('/logs');
                            setShowSettings(false);
                          }}
                        >
                          <ClipboardList className={`w-4 h-4 ${location.pathname === '/logs' ? 'text-green-500' : ''}`} />
                          Logs
                        </button>
                      </div>
                      <div className="border-t border-zinc-800 my-2"></div>

                      <div className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Controls</div>
                      <div className="space-y-1">
                        <div className="px-3 py-2">
                          <div className="text-xs text-zinc-500 mb-1">AI Model</div>
                          <ModelSelector onModelChange={onModelChange} fullWidth />
                        </div>
                        <div className="px-3 py-2">
                          <div className="text-xs text-zinc-500 mb-1">Playback Device</div>
                          <DeviceSelector onDeviceChange={onDeviceChange} fullWidth />
                        </div>
                      </div>
                      
                      <div className="border-t border-zinc-800 mt-2 pt-2">
                        <button 
                          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-all flex items-center gap-3"
                          onClick={() => {
                            window.location.reload();
                            setShowSettings(false);
                          }}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Refresh Page
                        </button>
                        <button 
                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-all flex items-center gap-3"
                          onClick={() => {
                            onLogout();
                            setShowSettings(false);
                          }}
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>
    </header>
  );
};

export default HeaderNav;