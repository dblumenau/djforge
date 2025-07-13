import { useState, useEffect } from 'react';
import { apiEndpoint } from '../config/api';

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
}

export const useSpotifyAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    accessToken: null,
    loading: true,
    error: null
  });

  const checkAuthStatus = async () => {
    console.log('🔍 useSpotifyAuth: Starting auth status check...');
    
    try {
      const url = apiEndpoint('/api/auth/status');
      console.log('📡 useSpotifyAuth: Checking auth at:', url);
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      console.log('📋 useSpotifyAuth: Auth check response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Failed to check auth status');
      }

      const data = await response.json();
      console.log('📋 useSpotifyAuth: Auth check response data:', data);
      
      if (data.authenticated && data.accessToken) {
        console.log('✅ useSpotifyAuth: Setting authenticated state');
        setAuthState({
          isAuthenticated: true,
          accessToken: data.accessToken,
          loading: false,
          error: null
        });
      } else {
        console.log('❌ useSpotifyAuth: Setting unauthenticated state');
        setAuthState({
          isAuthenticated: false,
          accessToken: null,
          loading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('💥 useSpotifyAuth: Auth check failed:', error);
      setAuthState({
        isAuthenticated: false,
        accessToken: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Auth check failed'
      });
    }
  };

  // Initial auth check
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Refresh token before expiry
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    // Check auth status every 30 minutes
    const interval = setInterval(() => {
      checkAuthStatus();
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [authState.isAuthenticated]);

  const login = () => {
    window.location.href = apiEndpoint('/api/auth/login');
  };

  const logout = async () => {
    try {
      await fetch(apiEndpoint('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include'
      });
      
      setAuthState({
        isAuthenticated: false,
        accessToken: null,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return {
    ...authState,
    login,
    logout,
    checkAuthStatus
  };
};