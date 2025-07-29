import { useState, useEffect } from 'react';
import { authService } from '../services/auth.service';
import { apiEndpoint } from '../config/api';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    checkAuthStatus();
  }, []);
  
  const checkAuthStatus = async () => {
    try {
      const sessionId = authService.getSessionId();
      console.log('🔍 useAuth checkAuthStatus - Session ID from storage:', sessionId);
      
      if (!sessionId) {
        console.log('❌ useAuth - No session ID found, setting unauthenticated');
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      console.log('📡 useAuth - Making auth status request to:', apiEndpoint('/api/auth/status'));
      const response = await fetch(apiEndpoint('/api/auth/status'), {
        headers: {
          'X-Session-ID': sessionId
        }
      });
      
      console.log('📋 useAuth - Auth status response:', response.status, response.statusText);
      
      // Handle 503 Service Unavailable (server just restarted)
      if (response.status === 503) {
        console.log('⏳ Server is initializing, retrying in 1 second...');
        // Keep loading state true during retry
        setTimeout(() => {
          checkAuthStatus();
        }, 1000);
        return; // Don't set loading to false yet - no finally block will run
      }
      
      const data = await response.json();
      console.log('📋 useAuth - Auth status data:', data);
      
      setIsAuthenticated(data.authenticated);
      console.log('✅ useAuth - Authentication set to:', data.authenticated);
      setLoading(false);
    } catch (error) {
      console.error('❌ useAuth - Auth status check failed:', error);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };
  
  const login = () => {
    window.location.href = apiEndpoint('/api/auth/login');
  };
  
  const logout = async () => {
    const sessionId = authService.getSessionId();
    if (sessionId) {
      await fetch(apiEndpoint('/api/auth/logout'), {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId
        }
      });
    }
    
    authService.logout();
    setIsAuthenticated(false);
    window.location.href = '/landing';
  };
  
  return {
    isAuthenticated,
    loading,
    login,
    logout
  };
}