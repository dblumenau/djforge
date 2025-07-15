import React, { useState, useEffect } from 'react';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { apiEndpoint } from '../config/api';

interface AuthFlowEvent {
  timestamp: string;
  type: 'localStorage' | 'auth_check' | 'state_change' | 'redirect';
  data: any;
}

const AuthFlowDebugger: React.FC = () => {
  const [events, setEvents] = useState<AuthFlowEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const authState = useSpotifyAuth();

  const addEvent = (type: AuthFlowEvent['type'], data: any) => {
    const event: AuthFlowEvent = {
      timestamp: new Date().toISOString(),
      type,
      data
    };
    setEvents(prev => [...prev.slice(-9), event]); // Keep last 10 events
    console.log('🔍 AuthFlowDebugger:', event);
  };

  // Monitor localStorage changes
  useEffect(() => {
    const token = localStorage.getItem('spotify_jwt');
    addEvent('localStorage', { 
      hasToken: !!token, 
      tokenLength: token?.length || 0,
      tokenStart: token?.substring(0, 20) || null
    });
  }, []);

  // Monitor auth state changes
  useEffect(() => {
    addEvent('state_change', {
      isAuthenticated: authState.isAuthenticated,
      loading: authState.loading,
      error: authState.error,
      hasAccessToken: !!authState.accessToken
    });
  }, [authState.isAuthenticated, authState.loading, authState.error, authState.accessToken]);

  // Monitor page navigation
  useEffect(() => {
    const currentPath = window.location.pathname;
    addEvent('redirect', { 
      path: currentPath,
      search: window.location.search
    });
  }, []);

  const testAuthFlow = async () => {
    addEvent('auth_check', { action: 'manual_test_started' });
    
    try {
      // Check localStorage
      const token = localStorage.getItem('spotify_jwt');
      addEvent('localStorage', { token: token ? 'exists' : 'missing' });
      
      // Test auth endpoint
      const response = await fetch(apiEndpoint('/api/auth/status'), {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      
      const data = await response.json();
      addEvent('auth_check', { 
        response: {
          status: response.status,
          data
        }
      });
      
      // Test useSpotifyAuth hook
      await authState.checkAuthStatus();
      addEvent('auth_check', { action: 'hook_check_completed' });
    } catch (error) {
      addEvent('auth_check', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const clearEvents = () => {
    setEvents([]);
  };

  const clearTokenAndTest = () => {
    localStorage.removeItem('spotify_jwt');
    addEvent('localStorage', { action: 'token_cleared' });
    testAuthFlow();
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-lg"
        >
          Show Auth Flow Debug
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-zinc-900 border border-zinc-700 rounded-lg p-4 max-w-lg z-50 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Auth Flow Debug</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="text-sm text-gray-300">
          <strong>Current State:</strong>
          <div className="text-xs text-gray-400">
            Auth: {authState.isAuthenticated ? '✓' : '✗'} | 
            Loading: {authState.loading ? '✓' : '✗'} | 
            Token: {authState.accessToken ? '✓' : '✗'}
          </div>
        </div>
        
        <div className="text-sm text-gray-300">
          <strong>Path:</strong> {window.location.pathname}
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        <button
          onClick={testAuthFlow}
          className="w-full px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Test Auth Flow
        </button>
        <button
          onClick={clearTokenAndTest}
          className="w-full px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
        >
          Clear Token & Test
        </button>
        <button
          onClick={clearEvents}
          className="w-full px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
        >
          Clear Events
        </button>
      </div>
      
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-300">Recent Events:</h4>
        <div className="max-h-48 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-gray-500">No events yet</p>
          ) : (
            events.map((event, index) => (
              <div key={index} className="text-xs bg-zinc-800 rounded p-2 border border-zinc-700">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-gray-300">{event.type}</span>
                  <span className="text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-gray-400 mt-1">
                  {JSON.stringify(event.data, null, 2)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthFlowDebugger;