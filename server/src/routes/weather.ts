import { Router, Request, Response } from 'express';

const router = Router();

// DMI API configuration
const DMI_BASE_URL = 'https://dmigw.govcloud.dk/v2/metObs';
const LANDBOHOJSKOLEN_STATION_ID = '06186';

// Cache for weather data (5 minutes)
interface WeatherCache {
  data: WeatherData | null;
  timestamp: number;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  observationTime: string;
}

let weatherCache: WeatherCache = {
  data: null,
  timestamp: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch weather data from DMI API
async function fetchWeatherData(): Promise<WeatherData | null> {
  const apiKey = process.env.DMI_API_KEY;
  const clientId = process.env.DMI_CLIENT_ID;

  if (!apiKey || !clientId) {
    console.error('DMI API credentials not configured');
    return null;
  }

  try {
    // Fetch temperature
    const tempResponse = await fetch(
      `${DMI_BASE_URL}/collections/observation/items?stationId=${LANDBOHOJSKOLEN_STATION_ID}&parameterId=temp_dry&limit=1`,
      {
        headers: {
          'X-Gravitee-Api-Key': apiKey
        }
      }
    );

    if (!tempResponse.ok) {
      throw new Error(`Temperature fetch failed: ${tempResponse.status}`);
    }

    const tempData: any = await tempResponse.json();

    // Fetch humidity
    const humidityResponse = await fetch(
      `${DMI_BASE_URL}/collections/observation/items?stationId=${LANDBOHOJSKOLEN_STATION_ID}&parameterId=humidity&limit=1`,
      {
        headers: {
          'X-Gravitee-Api-Key': apiKey
        }
      }
    );

    if (!humidityResponse.ok) {
      throw new Error(`Humidity fetch failed: ${humidityResponse.status}`);
    }

    const humidityData: any = await humidityResponse.json();

    // Extract values
    if (tempData.features?.length > 0 && humidityData.features?.length > 0) {
      const temperature = tempData.features[0].properties.value;
      const humidity = humidityData.features[0].properties.value;
      const observationTime = tempData.features[0].properties.observed;

      return {
        temperature,
        humidity,
        observationTime
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
}

// GET /api/weather - Get current weather data
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check cache
    const now = Date.now();
    if (weatherCache.data && (now - weatherCache.timestamp) < CACHE_DURATION) {
      return res.json({
        success: true,
        data: weatherCache.data,
        cached: true
      });
    }

    // Fetch fresh data
    const weatherData = await fetchWeatherData();

    if (!weatherData) {
      return res.status(503).json({
        success: false,
        error: 'Unable to fetch weather data'
      });
    }

    // Update cache
    weatherCache = {
      data: weatherData,
      timestamp: now
    };

    res.json({
      success: true,
      data: weatherData,
      cached: false
    });
  } catch (error) {
    console.error('Weather route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;