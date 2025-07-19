#!/bin/bash

# DMI API credentials
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"
STATION_ID="06186"

echo "Looking for pressure measurements at Landbohøjskolen..."
echo ""

# Get recent observations
RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&limit=200")

# Save response to file for analysis
echo "$RESPONSE" > station_data.json

# Get all unique parameters
echo "All parameters available at this station:"
cat station_data.json | jq -r '.features[].properties.parameterId' | sort -u

echo -e "\n\nChecking for pressure-related parameters:"
cat station_data.json | jq -r '.features[].properties.parameterId' | sort -u | grep -E "(press|pres|bar|hPa)" -i || echo "No pressure parameters found"

# Try searching for pressure in other nearby stations
echo -e "\n\nChecking Botanisk Have station (05735) for comparison:"
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=05735&parameterId=pressure_at_sea_past1h&limit=1" | jq '.features[0].properties' || echo "No data"