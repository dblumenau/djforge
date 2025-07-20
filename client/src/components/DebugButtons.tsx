import React from 'react';
import { apiEndpoint } from '../config/api';

const DebugButtons: React.FC = () => {
  const handleSimulateExpired = async () => {
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

  const handleSimulateRevoked = async () => {
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

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="hidden gap-2 ml-auto lg:ml-0">
      <button 
        className="px-3 py-2 bg-orange-600 text-white font-semibold rounded-full hover:bg-orange-700 transition-colors text-xs"
        onClick={handleSimulateExpired}
      >
        Simulate Expired
      </button>
      <button 
        className="px-3 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700 transition-colors text-xs"
        onClick={handleSimulateRevoked}
      >
        Simulate Revoked
      </button>
    </div>
  );
};

export default DebugButtons;