// Backward compatibility shim for useSpotifyAuth during auth migration
// This provides the old hook interface using the new auth system

import { useAuth } from '../contexts/AuthContext';

export function useSpotifyAuth() {
  const { isAuthenticated, loading, login, logout } = useAuth();
  
  // Return the old interface for backward compatibility
  return {
    isAuthenticated,
    loading,
    login,
    logout,
    // Legacy properties that some components might expect
    token: null, // Not exposed in new system
    refreshToken: null, // Not exposed in new system
    expiresAt: null, // Not exposed in new system
  };
}