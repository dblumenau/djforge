#!/bin/bash

# DMI API credentials
CLIENT_ID="6316d472-0ae9-4812-9eeb-d2137a5f1d3f"
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"

# Station IDs
LANDBOHOJSKOLEN="06186"
AIRPORT="06180"

echo "Weather Report for Central Copenhagen"
echo "====================================="
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

# Get latest observation time from Landbohøjskolen
LATEST_RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${LANDBOHOJSKOLEN}&limit=1")
LATEST_TIME=$(echo "$LATEST_RESPONSE" | jq -r '.features[0].properties.observed')
LOCAL_TIME=$(convert_to_copenhagen_time "$LATEST_TIME")

echo "Time: $LOCAL_TIME"
echo ""

echo "Temperature & Humidity (Landbohøjskolen):"
echo "-----------------------------------------"

# Get temperature and humidity from Landbohøjskolen
declare -a LOCAL_PARAMS=(
    "temp_dry:Current Temperature:°C"
    "temp_dew:Dew Point:°C"
    "humidity:Current Humidity:%"
)

echo "Current Conditions:"
for PARAM_INFO in "${LOCAL_PARAMS[@]}"; do
    IFS=':' read -r PARAM_ID PARAM_NAME UNIT <<< "$PARAM_INFO"
    
    RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
      "${BASE_URL}/collections/observation/items?stationId=${LANDBOHOJSKOLEN}&parameterId=${PARAM_ID}&limit=1")
    
    if [ "$(echo "$RESPONSE" | jq -r '.features | length')" -gt 0 ]; then
        VALUE=$(echo "$RESPONSE" | jq -r '.features[0].properties.value')
        printf "%-25s %8.1f %s\n" "$PARAM_NAME:" "$VALUE" "$UNIT"
    fi
done

echo ""
echo "Past Hour Statistics:"
declare -a HOUR_PARAMS=(
    "temp_mean_past1h:Mean Temperature:°C"
    "temp_max_past1h:Max Temperature:°C"
    "temp_min_past1h:Min Temperature:°C"
    "humidity_past1h:Average Humidity:%"
)

for PARAM_INFO in "${HOUR_PARAMS[@]}"; do
    IFS=':' read -r PARAM_ID PARAM_NAME UNIT <<< "$PARAM_INFO"
    
    RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
      "${BASE_URL}/collections/observation/items?stationId=${LANDBOHOJSKOLEN}&parameterId=${PARAM_ID}&limit=1")
    
    if [ "$(echo "$RESPONSE" | jq -r '.features | length')" -gt 0 ]; then
        VALUE=$(echo "$RESPONSE" | jq -r '.features[0].properties.value')
        printf "%-25s %8.1f %s\n" "$PARAM_NAME:" "$VALUE" "$UNIT"
    fi
done

echo ""
echo "Past 12 Hour Statistics:"
declare -a TWELVE_HOUR_PARAMS=(
    "temp_max_past12h:Max Temperature:°C"
    "temp_min_past12h:Min Temperature:°C"
)

for PARAM_INFO in "${TWELVE_HOUR_PARAMS[@]}"; do
    IFS=':' read -r PARAM_ID PARAM_NAME UNIT <<< "$PARAM_INFO"
    
    RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
      "${BASE_URL}/collections/observation/items?stationId=${LANDBOHOJSKOLEN}&parameterId=${PARAM_ID}&limit=1")
    
    if [ "$(echo "$RESPONSE" | jq -r '.features | length')" -gt 0 ]; then
        VALUE=$(echo "$RESPONSE" | jq -r '.features[0].properties.value')
        printf "%-25s %8.1f %s\n" "$PARAM_NAME:" "$VALUE" "$UNIT"
    fi
done

echo ""
echo "Atmospheric Pressure (København Lufthavn):"
echo "------------------------------------------"

# Get pressure from airport
PRESSURE_RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${AIRPORT}&parameterId=pressure&limit=1")

if [ "$(echo "$PRESSURE_RESPONSE" | jq -r '.features | length')" -gt 0 ]; then
    PRESSURE=$(echo "$PRESSURE_RESPONSE" | jq -r '.features[0].properties.value')
    PRESSURE_TIME=$(echo "$PRESSURE_RESPONSE" | jq -r '.features[0].properties.observed')
    PRESSURE_LOCAL=$(convert_to_copenhagen_time "$PRESSURE_TIME")
    
    printf "%-25s %8.1f hPa\n" "Sea Level Pressure:" "$PRESSURE"
    echo "Measured at: $PRESSURE_LOCAL"
else
    echo "Pressure data not available"
fi

echo ""
echo "Notes:"
echo "- Temperature/humidity from Landbohøjskolen (central Copenhagen)"
echo "- Pressure from København Lufthavn (12km south)"