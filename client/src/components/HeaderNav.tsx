import React from 'react';
import { useNavigate } from 'react-router-dom';
import ModelSelector from './ModelSelector';
import DeviceSelector from './DeviceSelector';
import WeatherDisplay from './WeatherDisplay';

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
  onMenuToggle,
  isAdmin = false
}) => {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div className="h-16 flex items-center justify-between px-2 md:px-4" style={{ maxWidth: '1440px', margin: '0 auto' }}>
          {/* Mobile Layout */}
          <div className="md:hidden flex items-center justify-between w-full h-full py-1">
            {/* Left: Mobile Menu Button */}
            <button
              onClick={onMenuToggle}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Center: Logo */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <img 
                src="/landscape_icon.png" 
                alt="DJ Forge" 
                className="h-12"
              />
            </div>

            {/* Right: Empty space for balance */}
            <div className="w-10"></div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between w-full">
            {/* Left: Logo and Title */}
            <div className="flex items-center gap-3">
              <img 
                src="/square_icon.png" 
                alt="DJ Forge" 
                className="h-8 w-8"
              />
              <h1 className="text-xl font-bold">DJ Forge</h1>
            </div>

            {/* Center: Weather */}
            <div>
              <WeatherDisplay compact />
            </div>

            {/* Right: Controls and Navigation */}
            <div className="flex items-center gap-2 lg:gap-3">
            {/* Model and Device Selectors (desktop only) */}
            <div className="hidden md:flex items-center gap-2 lg:gap-3">
              <ModelSelector onModelChange={onModelChange} compact />
              <DeviceSelector onDeviceChange={onDeviceChange} compact />
            </div>

            {/* Navigation Buttons (desktop only) */}
            <div className="hidden md:flex items-center gap-1 lg:gap-2">
              <button
                onClick={() => navigate('/')}
                className="px-2 lg:px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 hover:border-zinc-500 rounded-md transition-all text-xs font-medium"
              >
                <span className="hidden lg:inline">💬 Chat</span>
                <span className="lg:hidden">💬</span>
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-2 lg:px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 hover:border-zinc-500 rounded-md transition-all text-xs font-medium"
              >
                <span className="hidden lg:inline">📊 Dashboard</span>
                <span className="lg:hidden">📊</span>
              </button>
              <button
                onClick={() => navigate('/feedback-dashboard')}
                className="px-2 lg:px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 hover:border-zinc-500 rounded-md transition-all text-xs font-medium"
              >
                <span className="hidden lg:inline">🎯 Feedback</span>
                <span className="lg:hidden">🎯</span>
              </button>
              <button 
                className="px-2 lg:px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-zinc-100 border border-zinc-600 hover:border-zinc-500 rounded-md transition-all text-xs"
                onClick={() => navigate('/logs')}
              >
                <span className="hidden lg:inline">📋 Logs</span>
                <span className="lg:hidden">📋</span>
              </button>
              {isAdmin && (
                <button 
                  className="px-2 lg:px-3 py-1.5 bg-purple-900/20 hover:bg-purple-900/30 text-purple-300 hover:text-purple-200 border border-purple-800/50 hover:border-purple-700/50 rounded-md transition-all text-xs font-medium"
                  onClick={() => navigate('/admin/sse-status')}
                >
                  <span className="hidden lg:inline">🔌 SSE Status</span>
                  <span className="lg:hidden">🔌</span>
                </button>
              )}
              <button 
                className="px-2 lg:px-3 py-1.5 bg-blue-900/20 hover:bg-blue-900/30 text-blue-300 hover:text-blue-200 border border-blue-800/50 hover:border-blue-700/50 rounded-md transition-all text-xs font-medium"
                onClick={() => window.location.reload()}
              >
                <span className="hidden lg:inline">🔄 Refresh</span>
                <span className="lg:hidden">🔄</span>
              </button>
              <button 
                className="px-2 lg:px-3 py-1.5 bg-red-900/20 hover:bg-red-900/30 text-red-300 hover:text-red-200 border border-red-800/50 hover:border-red-700/50 rounded-md transition-all text-xs font-medium"
                onClick={onLogout}
              >
                <span className="hidden lg:inline">🚪 Logout</span>
                <span className="lg:hidden">🚪</span>
              </button>

              {/* Dev Tools - Hidden in production */}
              {/* {isDevMode && (
                <>
                  <button 
                    className="px-2 py-1 bg-yellow-900/20 hover:bg-yellow-900/30 text-yellow-400/70 hover:text-yellow-300 border border-yellow-800/30 rounded text-xs opacity-50"
                    onClick={onExpireTokens}
                  >
                    ⏰ Expire
                  </button>
                  <button 
                    className="px-2 py-1 bg-red-900/20 hover:bg-red-900/30 text-red-400/70 hover:text-red-300 border border-red-800/30 rounded text-xs opacity-50"
                    onClick={onRevokeTokens}
                  >
                    🚫 Revoke
                  </button>
                </>
              )} */}
            </div>
          </div>
          </div>
      </div>
    </header>
  );
};

export default HeaderNav;