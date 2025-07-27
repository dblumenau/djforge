import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/api';
import { apiEndpoint } from '../config/api';

interface WeatherData {
  temperature: number;
  humidity: number;
  observationTime: string;
}

interface WeatherDisplayProps {
  compact?: boolean;
}

const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ compact = false }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to format time string
  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return timeString;
    }
  };

  // Function to fetch weather data
  const fetchWeather = async () => {
    try {
      const response = await authenticatedFetch(apiEndpoint('/api/weather'));
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setWeather(data.data);
          setError(null);
        } else {
          setError('Weather data unavailable');
        }
      } else {
        setError('Failed to fetch weather');
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('Weather service error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchWeather();

    // Refresh every 5 minutes
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Get temperature icon based on value
  const getTemperatureIcon = (temp: number) => {
    if (temp > 25) return '🥵'; // dying of heat
    if (temp >= 20) return '😅'; // a bit hot
    if (temp >= 13) return '😊'; // nice
    return '🥶'; // chilly
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-800/50 rounded-full">
        <div className="animate-pulse">
          <div className="h-4 w-20 bg-zinc-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return null; // Don't show anything if there's an error
  }

  return (
    <div className={`flex items-center gap-3 ${compact ? 'px-3 py-1.5' : 'px-4 py-2'} bg-zinc-800/50 rounded-full border border-zinc-700/50`}>
      {/* Temperature */}
      <div className="flex items-center gap-1.5">
        <span className={compact ? 'text-base' : 'text-lg'}>{getTemperatureIcon(weather.temperature)}</span>
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-300`}>
          {weather.temperature.toFixed(1)}°C
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-zinc-700"></div>

      {/* Humidity */}
      <div className="flex items-center gap-1.5">
        <span className={compact ? 'text-base' : 'text-lg'}>💧</span>
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-300`}>
          {weather.humidity.toFixed(0)}%
        </span>
      </div>

      {/* Location and time - only in non-compact mode */}
      {!compact && (
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-500">
          <span>Copenhagen</span>
          <span>•</span>
          <span>{formatTime(weather.observationTime)}</span>
        </div>
      )}
    </div>
  );
};

export default WeatherDisplay;