# DMI Open Data API Guide

This guide documents how to use the DMI (Danish Meteorological Institute) Open Data API to retrieve weather data from Copenhagen stations.

## API Overview

- **Base URL**: `https://dmigw.govcloud.dk/v2/metObs`
- **Authentication**: Required via `X-Gravitee-Api-Key` header
- **Format**: Returns GeoJSON format
- **Standard**: OGC API - Features - Part 1: Core

## Authentication

All requests require your API key in the header:
```bash
curl -H "X-Gravitee-Api-Key: YOUR_API_KEY" "https://dmigw.govcloud.dk/v2/metObs/..."
```

## Key Endpoints

### 1. Station Information
```bash
# List all stations in an area (bounding box)
GET /collections/station/items?bbox=MIN_LON,MIN_LAT,MAX_LON,MAX_LAT

# Get specific station details
GET /collections/station/items/{stationId}
```

### 2. Weather Observations
```bash
# Get observations by station and parameter
GET /collections/observation/items?stationId={id}&parameterId={param}&limit={n}

# Get observations with time filter
GET /collections/observation/items?stationId={id}&datetime={from}/{to}
```

## Copenhagen Weather Stations

### Landbohøjskolen (Station ID: 06186)
- **Location**: Central Copenhagen (12.5439°E, 55.6861°N)
- **Type**: Basic temperature/humidity station
- **Available Parameters**:
  - `temp_dry` - Current temperature (°C)
  - `temp_dew` - Dew point temperature (°C)
  - `temp_mean_past1h` - Mean temperature past hour (°C)
  - `temp_max_past1h` - Maximum temperature past hour (°C)
  - `temp_min_past1h` - Minimum temperature past hour (°C)
  - `temp_max_past12h` - Maximum temperature past 12 hours (°C)
  - `temp_min_past12h` - Minimum temperature past 12 hours (°C)
  - `humidity` - Current relative humidity (%)
  - `humidity_past1h` - Humidity past hour (%)

### København Lufthavn (Station ID: 06180)
- **Location**: Copenhagen Airport (12km south of city center)
- **Type**: Full weather station
- **Additional Parameters**:
  - `pressure` - Atmospheric pressure at sea level (hPa)
  - `precip_past1h` - Precipitation past hour (mm)
  - `precip_past10min` - Precipitation past 10 minutes (mm)
  - `wind_speed_past1h` - Wind speed past hour (m/s)
  - `wind_dir_past1h` - Wind direction past hour (degrees)

## Important Discoveries

1. **Parameter Names Vary**: Different stations use different parameter names. For example:
   - Airport uses `pressure` (instantaneous)
   - Some stations might use `pressure_at_sea_past1h` (hourly average)

2. **Station Capabilities**: Not all stations have all sensors:
   - Landbohøjskolen: Only temperature and humidity
   - Airport: Full suite including pressure, wind, precipitation

3. **Time Zones**: All times are in UTC. Convert to Copenhagen time (CEST = UTC+2 in summer, CET = UTC+1 in winter).

## Example Scripts

### 1. Get Current Temperature (Landbohøjskolen)
```bash
#!/bin/bash
API_KEY="your_api_key"
STATION_ID="06186"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"

# Get latest temperature
RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&parameterId=temp_mean_past1h&limit=1")

TEMPERATURE=$(echo "$RESPONSE" | jq -r '.features[0].properties.value')
echo "Temperature: ${TEMPERATURE}°C"
```

### 2. Find Stations in an Area
```bash
# Copenhagen area bounding box
MIN_LON="12.4"
MIN_LAT="55.6"
MAX_LON="12.7"
MAX_LAT="55.8"

curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/station/items?bbox=${MIN_LON},${MIN_LAT},${MAX_LON},${MAX_LAT}"
```

### 3. Combined Weather Report
For a complete weather picture in Copenhagen:
1. Use Landbohøjskolen (06186) for local temperature/humidity
2. Use København Lufthavn (06180) for pressure data

## Time Handling

### Convert UTC to Copenhagen Time
```bash
# Using BSD date (macOS)
OBSERVED_TIME="2025-07-19T13:00:00Z"
EPOCH=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$OBSERVED_TIME" +%s)
LOCAL_TIME=$(TZ="Europe/Copenhagen" date -r "$EPOCH" "+%Y-%m-%d %H:%M %Z")
```

## Response Format

All responses are in GeoJSON format:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [longitude, latitude]
      },
      "properties": {
        "stationId": "06186",
        "parameterId": "temp_mean_past1h",
        "value": 30.1,
        "observed": "2025-07-19T13:00:00Z"
      }
    }
  ]
}
```

## Best Practices

1. **Check Station Capabilities**: Not all stations have all parameters. Check what's available before querying.

2. **Use Appropriate Stations**: 
   - For local temperature: Use the nearest station
   - For pressure/wind/precipitation: Use a full weather station

3. **Handle Missing Data**: Some parameters might not have recent observations. Always check if data exists before parsing.

4. **Time Considerations**: 
   - Past hour parameters (e.g., `temp_mean_past1h`) are updated hourly
   - Instant parameters (e.g., `temp_dry`) are updated more frequently (typically every 10 minutes)

## Rate Limits

Check response headers for rate limit information:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: When the limit resets

## Scripts Created

1. `get_temperature.sh` - Get current temperature from Landbohøjskolen
2. `get_weather_stats.sh` - Get all available statistics from Landbohøjskolen
3. `get_combined_weather.sh` - Combined report using both stations
4. `find_stations.sh` - Find weather stations in Copenhagen area

All scripts are in the project root directory.