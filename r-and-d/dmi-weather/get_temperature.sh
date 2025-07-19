#!/bin/bash

# DMI API credentials
CLIENT_ID="6316d472-0ae9-4812-9eeb-d2137a5f1d3f"
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"

# Landbohøjskolen coordinates (approximately)
# Located at University of Copenhagen's Frederiksberg Campus
# Coordinates: 55.6867°N, 12.5325°E

# Create a bounding box around Landbohøjskolen (about 2km radius)
MIN_LON="12.52"
MIN_LAT="55.67"
MAX_LON="12.55"
MAX_LAT="55.70"

echo "Getting temperature for Landbohøjskolen (Station ID: 06186)..."
echo ""

# Station ID for Landbohøjskolen
STATION_ID="06186"

# Get current time and 2 hours ago in ISO format
CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TWO_HOURS_AGO=$(date -u -d '2 hours ago' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-2H +"%Y-%m-%dT%H:%M:%SZ")

# Get temperature observations - just get the latest one
TEMP_RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&parameterId=temp_mean_past1h&limit=1")

# Check if we got any data
if [ "$(echo "$TEMP_RESPONSE" | jq -r '.features | length')" -gt 0 ]; then
    # Extract temperature data
    TEMPERATURE=$(echo "$TEMP_RESPONSE" | jq -r '.features[0].properties.value')
    OBSERVED_TIME=$(echo "$TEMP_RESPONSE" | jq -r '.features[0].properties.observed')
    
    # Convert UTC time to local Copenhagen time
    # First convert to epoch, then to local time
    if command -v gdate >/dev/null 2>&1; then
        # GNU date available (e.g., via brew install coreutils on macOS)
        LOCAL_TIME=$(TZ="Europe/Copenhagen" gdate -d "$OBSERVED_TIME" "+%Y-%m-%d %H:%M %Z")
    else
        # BSD date (macOS) - convert to epoch first, then to local time
        EPOCH=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$OBSERVED_TIME" +%s 2>/dev/null)
        if [ -n "$EPOCH" ]; then
            LOCAL_TIME=$(TZ="Europe/Copenhagen" date -r "$EPOCH" "+%Y-%m-%d %H:%M %Z")
        else
            LOCAL_TIME="$OBSERVED_TIME"
        fi
    fi
    
    echo "Location: Landbohøjskolen, Copenhagen"
    echo "Temperature: ${TEMPERATURE}°C"
    echo "Observed at: $LOCAL_TIME (Copenhagen time)"
else
    echo "No temperature data available for Landbohøjskolen station"
fi