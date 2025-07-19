#!/bin/bash

# DMI API credentials
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"

echo "Finding Copenhagen stations with pressure measurements..."
echo "========================================================="
echo ""

# Get all stations in Copenhagen area
STATIONS=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/station/items?bbox=12.4,55.6,12.7,55.8&limit=100")

# Check each station for pressure data
echo "$STATIONS" | jq -r '.features[] | "\(.properties.stationId):\(.properties.name)"' | sort -u | while IFS=: read -r STATION_ID STATION_NAME; do
    # Check if this station has pressure data
    PRESSURE_CHECK=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
      "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&parameterId=pressure_at_sea_past1h&limit=1")
    
    if [ "$(echo "$PRESSURE_CHECK" | jq -r '.features | length')" -gt 0 ]; then
        VALUE=$(echo "$PRESSURE_CHECK" | jq -r '.features[0].properties.value')
        TIME=$(echo "$PRESSURE_CHECK" | jq -r '.features[0].properties.observed')
        echo "✓ Station $STATION_ID - $STATION_NAME has pressure: ${VALUE} hPa (at $TIME)"
    fi
done

echo -e "\n\nChecking what parameters Landbohøjskolen (06186) actually measures:"
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/station/items/06186" 2>/dev/null | jq '.properties.parameterId[]' 2>/dev/null | sort || echo "Could not get station metadata"