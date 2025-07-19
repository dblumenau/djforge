#!/bin/bash

# DMI API credentials
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"
STATION_ID="06186"

echo "Checking all possible pressure parameter names at Landbohøjskolen..."
echo "==================================================================="
echo ""

# List of possible pressure parameter names to check
declare -a PRESSURE_PARAMS=(
    "pressure"
    "pressure_at_sea"
    "pressure_at_sea_past1h"
    "pressure_past1h"
    "pres"
    "pres_sea"
    "barometer"
    "baro"
    "slp"  # sea level pressure
    "mslp" # mean sea level pressure
)

for PARAM in "${PRESSURE_PARAMS[@]}"; do
    echo -n "Checking '$PARAM': "
    RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
      "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&parameterId=${PARAM}&limit=1")
    
    COUNT=$(echo "$RESPONSE" | jq -r '.features | length')
    if [ "$COUNT" -gt 0 ]; then
        VALUE=$(echo "$RESPONSE" | jq -r '.features[0].properties.value')
        echo "FOUND! Value: $VALUE hPa"
    else
        echo "not found"
    fi
done

echo -e "\n\nDouble-checking: All parameters at station 06186:"
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&limit=100" | \
  jq -r '.features[].properties.parameterId' | sort -u | grep -v "temp\|humid" || echo "Only temperature and humidity parameters found"