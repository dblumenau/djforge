import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import HeaderNav from './HeaderNav';
import MobileMenu from './MobileMenu';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/temp-auth';
import { ModelProvider, useModel } from '../contexts/ModelContext';

interface AppLayoutProps {
  children?: React.ReactNode;
}

const AppLayoutInner: React.FC<AppLayoutProps> = ({ children }) => {
  const { isAuthenticated, loading, logout } = useAuth();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { setCurrentModel } = useModel();

  // Check admin status on mount - MUST be before any conditional returns
  React.useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await api.get('/api/auth/admin-check');
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error('Failed to check admin status:', error);
      }
    };
    
    if (isAuthenticated) {
      checkAdminStatus();
    }
  }, [isAuthenticated]);

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 AppLayout render - loading:', loading, 'isAuthenticated:', isAuthenticated, 'current path:', window.location.pathname);
  }, [loading, isAuthenticated]);

  // Show loading state while checking authentication
  if (loading) {
    console.log('🔄 AppLayout - Showing loading state');
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="animate-pulse text-green-400">Loading...</div>
      </div>
    );
  }

  // Redirect to landing page if not authenticated
  if (!isAuthenticated) {
    console.log('❌ AppLayout - Not authenticated, redirecting to landing');
    return <Navigate to="/landing" replace />;
  }

  const updateModelPreference = async (_type: string, model: string) => {
    try {
      const response = await api.post('/api/preferences/models', { modelId: model });

      if (response.ok) {
        console.log('Model preference updated:', model);
      } else {
        console.error('Failed to update model preference:', response.status);
      }
    } catch (error) {
      console.error('Failed to update model preference:', error);
    }
  };

  const handleModelSelect = (model: string) => {
    updateModelPreference('default', model);
    setCurrentModel(model);
  };

  const handleDeviceChange = async (deviceId: string | 'auto') => {
    try {
      await api.post('/api/control/device-preference', { preference: deviceId });
    } catch (error) {
      console.error('Failed to set device preference:', error);
    }
  };

  const handleExpireTokens = async () => {
    // WARNING: JWT debug functions disabled during auth system refactor
    console.warn('Token expiration simulation disabled during auth refactor');
    alert('Token debug functions disabled during auth system refactor');
  };

  const handleRevokeTokens = async () => {
    // WARNING: JWT debug functions disabled during auth system refactor
    console.warn('Token revocation simulation disabled during auth refactor');
    alert('Token debug functions disabled during auth system refactor');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      {/* Shared Header Navigation */}
      <HeaderNav
        onModelChange={handleModelSelect}
        onDeviceChange={handleDeviceChange}
        onLogout={logout}
        onMenuToggle={() => setShowMobileMenu(true)}
        isDevMode={import.meta.env.DEV}
        onExpireTokens={handleExpireTokens}
        onRevokeTokens={handleRevokeTokens}
        isAdmin={isAdmin}
      />

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        onModelChange={handleModelSelect}
        onDeviceChange={handleDeviceChange}
        onLogout={logout}
        isAdmin={isAdmin}
      />

      {/* Main Content Area */}
      <div className="app-main">
        {children || <Outlet />}
      </div>
    </div>
  );
};

const AppLayout: React.FC<AppLayoutProps> = (props) => {
  return (
    <ModelProvider>
      <AppLayoutInner {...props} />
    </ModelProvider>
  );
};

export default AppLayout;