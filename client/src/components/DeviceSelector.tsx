import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

interface DeviceSelectorProps {
  onDeviceChange?: (deviceId: string | 'auto') => void;
  compact?: boolean;
  fullWidth?: boolean;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({ onDeviceChange, compact = false, fullWidth = false }) => {
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('auto');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<SpotifyDevice | null>(null);

  // Load saved preference from localStorage
  useEffect(() => {
    const savedPreference = localStorage.getItem('spotifyDevicePreference') || 'auto';
    setSelectedDevice(savedPreference);
  }, []);

  // Fetch devices
  const fetchDevices = async () => {
    try {
      setLoading(true);
      console.log('[DeviceSelector] Fetching devices...');
      const response = await api.get('/api/control/devices');
      console.log('[DeviceSelector] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DeviceSelector] Devices data:', data);
        setDevices(data.devices || []);
        
        // Find the active device to show as current
        const active = data.devices?.find((d: SpotifyDevice) => d.is_active);
        setCurrentDevice(active || data.currentDevice || null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[DeviceSelector] Error response:', response.status, errorData);
      }
    } catch (error) {
      console.error('[DeviceSelector] Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch devices on mount and periodically
  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle device selection
  const handleDeviceSelect = async (deviceId: string | 'auto' | 'web-player') => {
    console.log('[DeviceSelector] Device selected:', deviceId);
    setSelectedDevice(deviceId);
    setIsOpen(false);
    
    // Save preference
    localStorage.setItem('spotifyDevicePreference', deviceId);
    console.log('[DeviceSelector] Saved to localStorage:', deviceId);
    
    // Notify parent component
    if (onDeviceChange) {
      onDeviceChange(deviceId);
    }
    
    // If not auto or web-player, transfer playback to the selected device
    if (deviceId !== 'auto' && deviceId !== 'web-player') {
      try {
        await api.post('/api/control/transfer', { deviceId, play: false });
      } catch (error) {
        console.error('Failed to transfer playback:', error);
      }
    }
    // Note: web-player transfer will be handled by the SpotifyPlayer component itself
  };

  // Get device icon based on type
  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'computer':
        return '💻';
      case 'smartphone':
        return '📱';
      case 'speaker':
        return '🔊';
      default:
        return '🌐'; // Web player or unknown
    }
  };

  // Get display name for selected device
  const getSelectedDisplayName = () => {
    if (selectedDevice === 'auto') {
      return compact ? 'Auto' : 'Auto - Use last active';
    }
    if (selectedDevice === 'web-player') {
      return compact ? '🎵' : '🎵 Built In Player';
    }
    const device = devices.find(d => d.id === selectedDevice);
    if (compact && device) {
      return getDeviceIcon(device.type);
    }
    return device ? `${getDeviceIcon(device.type)} ${device.name}` : 'Select device...';
  };

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${compact ? 'px-3 py-1.5' : 'px-3 py-2'} bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors text-sm ${fullWidth ? 'w-full justify-between' : ''}`}
        title="Select Spotify playback device"
      >
        <span className={`text-gray-400 ${compact ? 'hidden' : ''}`}>Device:</span>
        <span className="text-white truncate max-w-[120px]">{getSelectedDisplayName()}</span>
        <svg
          className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          {loading ? (
            <div className="p-3 text-center text-gray-400">
              Loading devices...
            </div>
          ) : (
            <>
              {/* Auto option */}
              <button
                onClick={() => handleDeviceSelect('auto')}
                className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors ${
                  selectedDevice === 'auto' ? 'bg-gray-700' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white">Auto - Use last active</span>
                  {selectedDevice === 'auto' && (
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                {currentDevice && (
                  <span className="text-xs text-gray-400 mt-1 block">
                    Currently: {currentDevice.name}
                  </span>
                )}
              </button>

              {/* Built In Player option */}
              <button
                onClick={() => handleDeviceSelect('web-player')}
                className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors ${
                  selectedDevice === 'web-player' ? 'bg-gray-700' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎵</span>
                    <span className="text-white">Built In Player</span>
                  </div>
                  {selectedDevice === 'web-player' && (
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-1 block">
                  Play music directly in your browser
                </span>
              </button>

              {/* Divider */}
              <div className="border-t border-gray-700 my-1"></div>
              
              {/* Refresh button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchDevices();
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-gray-400 hover:text-white transition-colors"
              >
                🔄 Refresh devices
              </button>
              
              {/* Divider */}
              <div className="border-t border-gray-700 my-1"></div>

              {/* Device list */}
              {devices.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="text-gray-400 mb-2">No devices found</div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Make sure Spotify is open on at least one device</div>
                    <div>Try playing something in Spotify first</div>
                  </div>
                </div>
              ) : (
                devices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => handleDeviceSelect(device.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors ${
                      selectedDevice === device.id ? 'bg-gray-700' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getDeviceIcon(device.type)}</span>
                        <div>
                          <div className="text-white">{device.name}</div>
                          <div className="text-xs text-gray-400">
                            {device.type} • Volume: {device.volume_percent}%
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {device.is_active && (
                          <span className="text-xs text-green-500">Active</span>
                        )}
                        {selectedDevice === device.id && (
                          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DeviceSelector;