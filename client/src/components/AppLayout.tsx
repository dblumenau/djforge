import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import HeaderNav from './HeaderNav';
import MobileMenu from './MobileMenu';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { api } from '../utils/api';
import { apiEndpoint } from '../config/api';

interface AppLayoutProps {
  children?: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { logout } = useSpotifyAuth();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const updateModelPreference = async (_type: string, model: string) => {
    try {
      const jwtToken = localStorage.getItem('spotify_jwt');
      if (!jwtToken) return;

      const response = await fetch(apiEndpoint('/api/preferences/models'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ modelId: model })
      });

      if (response.ok) {
        console.log('Model preference updated:', model);
      }
    } catch (error) {
      console.error('Failed to update model preference:', error);
    }
  };

  const handleModelSelect = (model: string) => {
    updateModelPreference('default', model);
  };

  const handleDeviceChange = async (deviceId: string | 'auto') => {
    try {
      await api.post('/api/control/device-preference', { preference: deviceId });
    } catch (error) {
      console.error('Failed to set device preference:', error);
    }
  };

  const handleExpireTokens = async () => {
    const jwtToken = localStorage.getItem('spotify_jwt');
    if (jwtToken) {
      try {
        const response = await fetch(apiEndpoint('/api/auth/debug/simulate-expired'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        if (data.success) {
          localStorage.setItem('spotify_jwt', data.simulatedToken);
          console.log('⏰ Simulated expired tokens - refresh page to test auto-refresh');
          alert('Tokens expired! Refresh the page to test automatic token refresh.');
        } else {
          alert(data.error);
        }
      } catch (error) {
        console.error('Simulate expired failed:', error);
      }
    }
  };

  const handleRevokeTokens = async () => {
    const jwtToken = localStorage.getItem('spotify_jwt');
    if (jwtToken) {
      try {
        const response = await fetch(apiEndpoint('/api/auth/debug/simulate-revoked'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        if (data.success) {
          localStorage.setItem('spotify_jwt', data.revokedToken);
          console.log('🚫 Simulated revoked refresh token');
          alert('Refresh token revoked! Refresh the page to test error handling.');
        }
      } catch (error) {
        console.error('Simulate revoked failed:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white flex flex-col">
      {/* Shared Header Navigation */}
      <HeaderNav
        onModelChange={handleModelSelect}
        onDeviceChange={handleDeviceChange}
        onLogout={logout}
        onMenuToggle={() => setShowMobileMenu(true)}
        isDevMode={import.meta.env.DEV}
        onExpireTokens={handleExpireTokens}
        onRevokeTokens={handleRevokeTokens}
      />

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        onModelChange={handleModelSelect}
        onDeviceChange={handleDeviceChange}
        onLogout={logout}
      />

      {/* Main Content Area with padding for fixed header */}
      <div className="flex-1 flex flex-col pt-16">
        {children || <Outlet />}
      </div>
    </div>
  );
};

export default AppLayout;