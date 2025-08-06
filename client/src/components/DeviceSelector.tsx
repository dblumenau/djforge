import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { api } from '../utils/api';
import { webPlayerService } from '../services/webPlayer.service';
import { Radio, Laptop, Smartphone, Speaker, Wifi, RefreshCw } from 'lucide-react';

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
  customTrigger?: (onClick: () => void, isOpen: boolean) => React.ReactNode;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({ onDeviceChange, compact = false, fullWidth = false, customTrigger }) => {
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('auto');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<SpotifyDevice | null>(null);
  const [isChangingDevice, setIsChangingDevice] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  // Load saved preference from localStorage
  useEffect(() => {
    const savedPreference = localStorage.getItem('spotifyDevicePreference') || 'auto';
    setSelectedDevice(savedPreference);
  }, []);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.right - 256 // 256px is the width of the dropdown (w-64)
      });
    }
  }, [isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!triggerRef.current?.contains(target) && !target.closest('.device-selector-dropdown')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Fetch devices
  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/control/devices');
      
      if (response.ok) {
        const data = await response.json();
        
        // Filter out the web player device since we have "Built In Player" option
        const filteredDevices = (data.devices || []).filter((d: SpotifyDevice) => 
          !d.name.includes('DJForge Web Player')
        );
        
        setDevices(filteredDevices);
        
        // Set current device - prioritize data.currentDevice which includes web player
        // If web player is active, data.currentDevice will contain it
        if (data.currentDevice) {
          setCurrentDevice(data.currentDevice);
        } else {
          // Fallback to finding active device in filtered list
          const active = filteredDevices.find((d: SpotifyDevice) => d.is_active);
          setCurrentDevice(active || null);
        }
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
    
    // Listen for web player ready events
    const unsubscribeWebPlayer = webPlayerService.onDeviceReady(() => {
      // Delay slightly to ensure the device appears in Spotify's device list
      setTimeout(fetchDevices, 500);
    });
    
    return () => {
      clearInterval(interval);
      unsubscribeWebPlayer();
    };
  }, []);

  // Handle device selection
  const handleDeviceSelect = async (deviceId: string | 'auto' | 'web-player') => {
    setIsChangingDevice(true);
    setSelectedDevice(deviceId);
    setIsOpen(false);
    
    // Save preference
    localStorage.setItem('spotifyDevicePreference', deviceId);
    
    // Dispatch custom event for same-window listeners (like MobileMenu)
    window.dispatchEvent(new Event('devicePreferenceChanged'));
    
    try {
      // Notify parent component
      if (onDeviceChange) {
        onDeviceChange(deviceId);
      }
      
      // Handle device transfer based on selection
      if (deviceId === 'web-player') {
        // Initialize and transfer to web player
        await webPlayerService.initialize();
        // Wait a bit for the player to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (webPlayerService.isReady()) {
          await webPlayerService.transferPlayback();
          // Show success feedback
          const event = new CustomEvent('device-changed', { 
            detail: { success: true, device: 'Built In Player' } 
          });
          window.dispatchEvent(event);
        } else {
          console.log('Web player not ready yet, transfer will happen when ready');
          const event = new CustomEvent('device-changed', { 
            detail: { success: true, device: 'Built In Player (initializing...)' } 
          });
          window.dispatchEvent(event);
        }
      } else if (deviceId !== 'auto') {
        // Transfer to regular Spotify device
        await api.post('/api/control/transfer', { deviceId, play: false });
        const device = devices.find(d => d.id === deviceId);
        const event = new CustomEvent('device-changed', { 
          detail: { success: true, device: device?.name || 'Unknown Device' } 
        });
        window.dispatchEvent(event);
      } else {
        // Auto mode selected
        const event = new CustomEvent('device-changed', { 
          detail: { success: true, device: 'Auto - Remote Control' } 
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Failed to change device:', error);
      // Revert selection on error
      const previousDevice = localStorage.getItem('spotifyDevicePreference') || 'auto';
      setSelectedDevice(previousDevice);
      localStorage.setItem('spotifyDevicePreference', previousDevice);
      
      // Dispatch event to sync other components
      window.dispatchEvent(new Event('devicePreferenceChanged'));
      
      // Show error feedback
      const event = new CustomEvent('device-changed', { 
        detail: { success: false, error: 'Failed to change device' } 
      });
      window.dispatchEvent(event);
    } finally {
      setIsChangingDevice(false);
    }
  };

  // Get device icon component based on type
  const getDeviceIcon = (type: string) => {
    const iconClass = "w-4 h-4 text-green-500";
    switch (type.toLowerCase()) {
      case 'computer':
        return <Laptop className={iconClass} />;
      case 'smartphone':
        return <Smartphone className={iconClass} />;
      case 'speaker':
        return <Speaker className={iconClass} />;
      default:
        return <Wifi className={iconClass} />; // Web player or unknown
    }
  };

  // Get display name for selected device
  const getSelectedDisplayName = () => {
    if (selectedDevice === 'auto') {
      return compact ? 'Remote' : 'Auto - Remote Control';
    }
    if (selectedDevice === 'web-player') {
      return compact ? (
        <span className="flex items-center">
          <Radio className="w-4 h-4 text-green-500" />
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-green-500" />
          <span>Built In Player</span>
        </span>
      );
    }
    const device = devices.find(d => d.id === selectedDevice);
    if (compact && device) {
      return (
        <span className="flex items-center">
          {getDeviceIcon(device.type)}
        </span>
      );
    }
    return device ? (
      <span className="flex items-center gap-2">
        {getDeviceIcon(device.type)}
        <span>{device.name}</span>
      </span>
    ) : 'Select device...';
  };

  return (
    <div ref={triggerRef} className={`relative ${fullWidth ? 'w-full' : ''}`}>
      {/* Use custom trigger if provided, otherwise use default button */}
      {customTrigger ? (
        customTrigger(() => setIsOpen(!isOpen), isOpen)
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isChangingDevice}
          className={`flex items-center gap-2 ${compact ? 'px-3 py-1.5' : 'px-3 py-2'} bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors text-sm ${fullWidth ? 'w-full justify-between' : ''} ${isChangingDevice ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Select Spotify playback device"
        >
          <span className={`text-gray-400 ${compact ? 'hidden' : ''}`}>Device:</span>
          <div className="text-white truncate max-w-[120px] flex items-center gap-2">
            {getSelectedDisplayName()}
            {isChangingDevice && (
              <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
          </div>
          <svg
            className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Render dropdown in a portal */}
      {isOpen && ReactDOM.createPortal(
        <div 
          className="device-selector-dropdown fixed w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-[400px] overflow-y-auto"
          style={{ 
            zIndex: 9999,
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}>
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
                  <span className="text-white">Auto - Remote Control</span>
                  {selectedDevice === 'auto' && (
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-1 block">
                  {currentDevice ? 
                    (currentDevice.name.includes('DJForge Web Player') 
                      ? 'Currently: Built In Player' 
                      : `Currently: ${currentDevice.name}`) 
                    : 'No active device - start playing first'}
                </span>
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
                    <Radio className="w-4 h-4 text-green-500" />
                    <span className="text-white">Built In Player</span>
                    {/* Show active indicator if web player is the current device */}
                    {currentDevice && currentDevice.name.includes('DJForge Web Player') && (
                      <span className="text-xs text-green-500">(Active)</span>
                    )}
                  </div>
                  {selectedDevice === 'web-player' && (
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-1 block">
                  Play music directly in this browser tab
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
                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh devices</span>
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
                        {getDeviceIcon(device.type)}
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
                        {/* Also check if this device matches the current device by ID */}
                        {!device.is_active && currentDevice && currentDevice.id === device.id && !currentDevice.name.includes('DJForge Web Player') && (
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default DeviceSelector;