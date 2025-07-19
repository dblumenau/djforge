#!/bin/bash

# DMI API credentials
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"
STATION_ID="06186"

echo "Checking ALL parameters available at Landbohøjskolen station..."
echo "============================================================="
echo ""

# Get a larger sample of observations to see all parameters
RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&limit=500")

echo "All unique parameters at this station:"
echo "$RESPONSE" | jq -r '.features[].properties.parameterId' | sort -u | while read param; do
    # Get the latest value for each parameter
    LATEST=$(echo "$RESPONSE" | jq -r --arg p "$param" '.features[] | select(.properties.parameterId == $p) | .properties' | head -1)
    if [ -n "$LATEST" ]; then
        VALUE=$(echo "$LATEST" | jq -r '.value')
        TIME=$(echo "$LATEST" | jq -r '.observed')
        printf "%-30s: %10s (last at %s)\n" "$param" "$VALUE" "$TIME"
    fi
done

echo -e "\n\nChecking specifically for pressure parameters..."
echo "$RESPONSE" | jq -r '.features[].properties.parameterId' | grep -i pressure | sort -u

echo -e "\n\nChecking for any parameter with 'press' in the name..."
echo "$RESPONSE" | jq -r '.features[].properties.parameterId' | grep -i press | sort -u