import { useState, useEffect, useCallback } from 'react';
import { apiEndpoint } from '../config/api';
import { setSentryUserContext, clearSentryUserContext } from '../utils/sentry';

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
}

// Refresh lock to prevent race conditions
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

const onRefreshed = (token: string | null) => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string | null) => void) => {
  refreshSubscribers.push(callback);
};

export const useSpotifyAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    accessToken: null,
    loading: true,
    error: null
  });

  const attemptTokenRefresh = useCallback(async (jwtToken: string) => {
    // If already refreshing, wait for the result
    if (isRefreshing) {
      console.log('🔄 Refresh already in progress, waiting...');
      return new Promise<void>((resolve, reject) => {
        addRefreshSubscriber((token) => {
          if (token) {
            setAuthState({
              isAuthenticated: true,
              accessToken: token,
              loading: false,
              error: null
            });
            resolve();
          } else {
            reject(new Error('Refresh failed'));
          }
        });
      });
    }

    // Start refreshing
    isRefreshing = true;
    
    try {
      console.log('🔄 Starting token refresh...');
      const response = await fetch(apiEndpoint('/api/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check if this is a revoked token that requires re-auth
        if (errorData.requiresReauth || response.headers.get('X-Auth-Error') === 'token_revoked') {
          console.error('🚨 Refresh token was revoked - user must re-authenticate');
          // Clear the JWT since it contains a revoked refresh token
          localStorage.removeItem('spotify_jwt');
          clearSentryUserContext();
          
          // Set state to not authenticated
          setAuthState({
            isAuthenticated: false,
            accessToken: null,
            loading: false,
            error: 'Your Spotify authorization was revoked. Please log in again.'
          });
          
          // Notify subscribers
          onRefreshed(null);
          isRefreshing = false;
          
          // Redirect to landing page
          window.location.href = '/landing';
          return;
        }
        
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      console.log('✅ Token refresh successful');
      
      if (data.success && data.newJwtToken) {
        // Update localStorage with new JWT
        localStorage.setItem('spotify_jwt', data.newJwtToken);
        
        // Update Sentry user context
        setSentryUserContext(data.newJwtToken);
        
        // Set authenticated state directly with new token
        setAuthState({
          isAuthenticated: true,
          accessToken: data.accessToken,
          loading: false,
          error: null
        });
        
        // Notify all waiting subscribers
        onRefreshed(data.accessToken);
        isRefreshing = false;
      } else {
        throw new Error('Invalid refresh response');
      }
    } catch (error: any) {
      console.error('💥 Token refresh failed:', error.response?.data || error.message || 'Unknown error');
      // DON'T clear JWT - it's still valid for 30 days
      // Only the Spotify tokens inside it are expired/revoked
      // Keep user "authenticated" but with expired tokens
      setAuthState({
        isAuthenticated: true, // Keep them logged in
        accessToken: null,     // But no valid access token
        loading: false,
        error: 'Spotify tokens expired. Please log in again to refresh.'
      });
      
      // Notify all waiting subscribers of failure
      onRefreshed(null);
      isRefreshing = false;
      
      // Re-throw the error so the calling code knows it failed
      throw error;
    }
  }, []);

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
        console.log('✅ useSpotifyAuth: Setting authenticated state with valid access token');
        
        // Update Sentry user context
        setSentryUserContext(jwtToken);
        
        setAuthState({
          isAuthenticated: true,
          accessToken: data.accessToken,
          loading: false,
          error: null
        });
      } else if (data.authenticated && data.tokenExpired && data.hasRefreshToken && jwtToken) {
        // User is authenticated but Spotify tokens are expired - attempt refresh
        console.log('🔄 useSpotifyAuth: User authenticated but tokens expired, attempting automatic refresh');
        try {
          await attemptTokenRefresh(jwtToken);
          // If refresh succeeds, attemptTokenRefresh will set the auth state
        } catch (error) {
          console.error('🔄 useSpotifyAuth: Token refresh failed during auth check');
          // If refresh fails, DON'T log out - attemptTokenRefresh already handled state
          // The user should stay "authenticated" but with expired tokens
        }
        return; // Don't continue to the else clause
      } else if (!data.authenticated) {
        // Only mark as unauthenticated if server explicitly says so (no refresh token)
        console.log('❌ useSpotifyAuth: User not authenticated - no valid session or refresh token');
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

    // Check auth status every 45 minutes (Spotify tokens last 60 minutes)
    // This gives us a 15-minute buffer before actual expiry
    const interval = setInterval(() => {
      checkAuthStatus();
    }, 45 * 60 * 1000);

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
      
      // Clear Sentry user context on logout
      clearSentryUserContext();
      
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