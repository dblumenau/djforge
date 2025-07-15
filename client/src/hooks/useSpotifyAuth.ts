import { useState, useEffect, useCallback } from 'react';
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

  const checkAuthStatus = useCallback(async () => {
    console.log('🔍 useSpotifyAuth: Starting auth status check...');
    
    // Set loading to true when starting auth check
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      const url = apiEndpoint('/api/auth/status');
      console.log('📡 useSpotifyAuth: Checking auth at:', url);
      
      // Get JWT token from localStorage
      const jwtToken = localStorage.getItem('spotify_jwt');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (jwtToken) {
        headers['Authorization'] = `Bearer ${jwtToken}`;
        console.log('📡 useSpotifyAuth: Sending JWT token in Authorization header');
      } else {
        console.log('📡 useSpotifyAuth: No JWT token found, checking session cookies');
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers
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
  }, []);

  // Initial auth check
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Refresh token before expiry
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    // Check auth status every 30 minutes
    const interval = setInterval(() => {
      checkAuthStatus();
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [authState.isAuthenticated, checkAuthStatus]);

  const login = useCallback(() => {
    window.location.href = apiEndpoint('/api/auth/login');
  }, []);

  const logout = useCallback(async () => {
    try {
      // Clear JWT token
      localStorage.removeItem('spotify_jwt');
      
      // Also call logout endpoint (for session cleanup if any)
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
  }, []);

  return {
    ...authState,
    login,
    logout,
    checkAuthStatus
  };
};