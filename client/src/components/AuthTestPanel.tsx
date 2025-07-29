import { useState } from 'react';
// WARNING: Using temporary auth bypass during auth system refactor
import { tempAuthUtils } from '../utils/temp-auth';

export function AuthTestPanel() {
  const [testStatus, setTestStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const simulateExpiredToken = async () => {
    setIsLoading(true);
    setTestStatus('JWT debug functions disabled during auth system refactor');
    setIsLoading(false);
  };

  const simulateRevokedToken = async () => {
    setIsLoading(true);
    setTestStatus('JWT debug functions disabled during auth system refactor');
    setIsLoading(false);
  };

  const clearAuthAndRefresh = () => {
    // WARNING: Using temp auth utils during refactor
    tempAuthUtils.logout();
    window.location.reload();
  };

  const getCurrentTokenInfo = () => {
    // WARNING: JWT system disabled during auth system refactor
    setTestStatus('JWT token info disabled during auth system refactor\nUsing temporary auth bypass');
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