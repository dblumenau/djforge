import React from 'react';

const DebugButtons: React.FC = () => {
  const handleSimulateExpired = async () => {
    // WARNING: JWT debug functions disabled during auth system refactor
    console.warn('Token expiration simulation disabled during auth refactor');
    alert('Token debug functions disabled during auth system refactor');
  };

  const handleSimulateRevoked = async () => {
    // WARNING: JWT debug functions disabled during auth system refactor
    console.warn('Token revocation simulation disabled during auth refactor');
    alert('Token debug functions disabled during auth system refactor');
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