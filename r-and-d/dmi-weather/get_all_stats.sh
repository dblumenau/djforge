#!/bin/bash

# DMI API credentials
CLIENT_ID="6316d472-0ae9-4812-9eeb-d2137a5f1d3f"
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"

# Station ID for Landbohøjskolen
STATION_ID="06186"

echo "Getting all available statistics from Landbohøjskolen for the past hour..."
echo ""

# Get all observations from the past 2 hours and filter for "past1h" parameters
RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&limit=100")

# Extract unique parameters that contain "past1h"
echo "Available past1h parameters:"
echo "$RESPONSE" | jq -r '.features[] | select(.properties.parameterId | contains("past1h")) | .properties.parameterId' | sort -u

echo -e "\n\nGetting latest values for all past1h parameters:"
echo "================================================"

# Get latest observation for each past1h parameter
for PARAM in $(echo "$RESPONSE" | jq -r '.features[] | select(.properties.parameterId | contains("past1h")) | .properties.parameterId' | sort -u); do
    # Get the latest observation for this parameter
    PARAM_RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
      "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&parameterId=${PARAM}&limit=1")
    
    if [ "$(echo "$PARAM_RESPONSE" | jq -r '.features | length')" -gt 0 ]; then
        VALUE=$(echo "$PARAM_RESPONSE" | jq -r '.features[0].properties.value')
        OBSERVED_TIME=$(echo "$PARAM_RESPONSE" | jq -r '.features[0].properties.observed')
        
        # Convert to Copenhagen time
        EPOCH=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$OBSERVED_TIME" +%s 2>/dev/null)
        LOCAL_TIME=$(TZ="Europe/Copenhagen" date -r "$EPOCH" "+%H:%M")
        
        # Format parameter name nicely
        case $PARAM in
            "temp_mean_past1h") echo "Mean Temperature: ${VALUE}°C (at $LOCAL_TIME)" ;;
            "temp_max_past1h") echo "Max Temperature: ${VALUE}°C (at $LOCAL_TIME)" ;;
            "temp_min_past1h") echo "Min Temperature: ${VALUE}°C (at $LOCAL_TIME)" ;;
            "humidity_past1h") echo "Humidity: ${VALUE}% (at $LOCAL_TIME)" ;;
            "precip_past1h") echo "Precipitation: ${VALUE} mm (at $LOCAL_TIME)" ;;
            "wind_speed_past1h") echo "Wind Speed: ${VALUE} m/s (at $LOCAL_TIME)" ;;
            "wind_dir_past1h") echo "Wind Direction: ${VALUE}° (at $LOCAL_TIME)" ;;
            "pressure_at_sea_past1h") echo "Pressure at Sea Level: ${VALUE} hPa (at $LOCAL_TIME)" ;;
            *) echo "$PARAM: $VALUE (at $LOCAL_TIME)" ;;
        esac
    fi
done