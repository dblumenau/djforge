import { useState } from 'react';
import { apiEndpoint } from '../config/api';

export function AuthTestPanel() {
  const [testStatus, setTestStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const simulateExpiredToken = async () => {
    setIsLoading(true);
    setTestStatus('Simulating expired token...');
    
    try {
      const jwtToken = localStorage.getItem('spotify_jwt');
      if (!jwtToken) {
        setTestStatus('No JWT token found. Please log in first.');
        return;
      }

      const response = await fetch(apiEndpoint('/api/auth/debug/simulate-expired'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      const data = await response.json();
      
      if (data.success && data.simulatedToken) {
        // Replace the current token with the simulated expired one
        localStorage.setItem('spotify_jwt', data.simulatedToken);
        setTestStatus('✅ Token expiry simulated! Refresh the page to test auto-refresh.');
      } else {
        setTestStatus('❌ Failed to simulate token expiry');
      }
    } catch (error) {
      setTestStatus(`❌ Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const simulateRevokedToken = async () => {
    setIsLoading(true);
    setTestStatus('Simulating revoked refresh token...');
    
    try {
      const jwtToken = localStorage.getItem('spotify_jwt');
      if (!jwtToken) {
        setTestStatus('No JWT token found. Please log in first.');
        return;
      }

      const response = await fetch(apiEndpoint('/api/auth/debug/simulate-revoked'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      const data = await response.json();
      
      if (data.success && data.revokedToken) {
        // Replace the current token with the simulated revoked one
        localStorage.setItem('spotify_jwt', data.revokedToken);
        setTestStatus('✅ Revoked token simulated! Refresh the page to test error handling.');
      } else {
        setTestStatus('❌ Failed to simulate revoked token');
      }
    } catch (error) {
      setTestStatus(`❌ Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthAndRefresh = () => {
    localStorage.removeItem('spotify_jwt');
    window.location.reload();
  };

  const getCurrentTokenInfo = () => {
    const jwtToken = localStorage.getItem('spotify_jwt');
    if (!jwtToken) {
      setTestStatus('No JWT token found');
      return;
    }

    try {
      // Decode JWT payload (base64)
      const payload = JSON.parse(atob(jwtToken.split('.')[1]));
      const tokenAge = Date.now() - payload.tokenTimestamp;
      const tokenAgeMinutes = Math.floor(tokenAge / 1000 / 60);
      const expiresAt = new Date(payload.exp * 1000).toLocaleString();
      
      setTestStatus(`Token age: ${tokenAgeMinutes} minutes\nJWT expires: ${expiresAt}\nUser ID: ${payload.spotify_user_id}`);
    } catch (error) {
      setTestStatus('Failed to decode JWT token');
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-white">🧪 Auth Testing Panel</h3>
      
      <div className="space-y-3">
        <button
          onClick={simulateExpiredToken}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
        >
          Simulate Expired Token (Test Auto-Refresh)
        </button>
        
        <button
          onClick={simulateRevokedToken}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          Simulate Revoked Token (Test Error Handling)
        </button>
        
        <button
          onClick={getCurrentTokenInfo}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Show Current Token Info
        </button>
        
        <button
          onClick={clearAuthAndRefresh}
          className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Clear Auth & Refresh Page
        </button>
      </div>

      {testStatus && (
        <div className="mt-4 p-3 bg-gray-900 rounded text-sm text-gray-300 whitespace-pre-wrap">
          {testStatus}
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-500">
        <p>• Expired token test: Makes token appear 61 minutes old</p>
        <p>• Revoked token test: Simulates invalid refresh token</p>
        <p>• After clicking test buttons, refresh the page to see behavior</p>
      </div>
    </div>
  );
}