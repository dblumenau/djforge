import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/auth.service';
import { apiEndpoint } from '../config/api';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState(0);

  const checkAuthStatus = async () => {
    try {
      const sessionId = authService.getSessionId();
      
      if (!sessionId) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      const response = await fetch(apiEndpoint('/api/auth/status'), {
        headers: {
          'X-Session-ID': sessionId
        }
      });
      
      
      // Handle 503 Service Unavailable (server just restarted)
      if (response.status === 503) {
        // Keep loading state true during retry
        setTimeout(() => {
          checkAuthStatus();
        }, 1000);
        return; // Don't set loading to false yet
      }
      
      const data = await response.json();
      
      setIsAuthenticated(data.authenticated);
      setLoading(false);
      setLastCheckTime(Date.now());
    } catch (error) {
      console.error('❌ AuthContext - Auth status check failed:', error);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
    
    // Re-check auth status when window gains focus
    const handleFocus = () => {
      if (!loading) {
        checkAuthStatus();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loading]);

  // Periodic check when not authenticated (to catch server restarts)
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      
      const interval = setInterval(() => {
        const timeSinceLastCheck = Date.now() - lastCheckTime;
        // Only check if it's been more than 2 seconds since last check
        if (timeSinceLastCheck > 2000) {
          checkAuthStatus();
        }
      }, 3000); // Check every 3 seconds
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [isAuthenticated, loading, lastCheckTime]);

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
    // Clear cached profile data
    localStorage.removeItem('spotify_user_profile');
    window.location.href = '/landing';
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout, checkAuthStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};