#!/bin/bash

# DMI API credentials
CLIENT_ID="6316d472-0ae9-4812-9eeb-d2137a5f1d3f"
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"

# Station ID for Landbohøjskolen
STATION_ID="06186"

echo "Weather Statistics for Landbohøjskolen, Copenhagen"
echo "=================================================="
echo ""
echo "Note: This is a basic weather station with temperature and humidity sensors only."
echo "For full weather data including pressure and precipitation, see København Lufthavn."
echo ""

# Function to convert UTC to Copenhagen time
convert_to_copenhagen_time() {
    local utc_time=$1
    local epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$utc_time" +%s 2>/dev/null)
    if [ -n "$epoch" ]; then
        TZ="Europe/Copenhagen" date -r "$epoch" "+%Y-%m-%d %H:%M %Z"
    else
        echo "$utc_time"
    fi
}

# Get latest observation time
LATEST_RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&limit=1")
LATEST_TIME=$(echo "$LATEST_RESPONSE" | jq -r '.features[0].properties.observed')
LOCAL_TIME=$(convert_to_copenhagen_time "$LATEST_TIME")

echo "Latest observation: $LOCAL_TIME"
echo ""

# Define all past1h parameters available at this station
declare -a PARAMS=(
    "temp_mean_past1h:Mean Temperature:°C"
    "temp_max_past1h:Maximum Temperature:°C"
    "temp_min_past1h:Minimum Temperature:°C"
    "humidity_past1h:Relative Humidity:%"
)

echo "Past Hour Statistics:"
echo "--------------------"

# Get each parameter
for PARAM_INFO in "${PARAMS[@]}"; do
    IFS=':' read -r PARAM_ID PARAM_NAME UNIT <<< "$PARAM_INFO"
    
    RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
      "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&parameterId=${PARAM_ID}&limit=1")
    
    if [ "$(echo "$RESPONSE" | jq -r '.features | length')" -gt 0 ]; then
        VALUE=$(echo "$RESPONSE" | jq -r '.features[0].properties.value')
        printf "%-25s %8.1f %s\n" "$PARAM_NAME:" "$VALUE" "$UNIT"
    else
        printf "%-25s %8s\n" "$PARAM_NAME:" "N/A"
    fi
done

echo ""
echo "Current Conditions:"
echo "------------------"

# Also get some instant readings
declare -a INSTANT_PARAMS=(
    "temp_dry:Current Temperature:°C"
    "temp_dew:Dew Point:°C"
    "humidity:Current Humidity:%"
)

for PARAM_INFO in "${INSTANT_PARAMS[@]}"; do
    IFS=':' read -r PARAM_ID PARAM_NAME UNIT <<< "$PARAM_INFO"
    
    RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
      "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&parameterId=${PARAM_ID}&limit=1")
    
    if [ "$(echo "$RESPONSE" | jq -r '.features | length')" -gt 0 ]; then
        VALUE=$(echo "$RESPONSE" | jq -r '.features[0].properties.value')
        printf "%-25s %8.1f %s\n" "$PARAM_NAME:" "$VALUE" "$UNIT"
    fi
done