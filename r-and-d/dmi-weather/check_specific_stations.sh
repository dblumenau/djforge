#!/bin/bash

# DMI API credentials
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"

echo "Checking major Copenhagen stations for pressure data..."
echo ""

# Check Copenhagen Airport (usually has full weather data)
echo "1. København Lufthavn (06180):"
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=06180&parameterId=pressure_at_sea_past1h&limit=1" | \
  jq -r '.features[0].properties | "   Pressure: \(.value) hPa at \(.observed)"' 2>/dev/null || echo "   No pressure data"

# Check other parameters at airport
echo "   Available parameters:"
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=06180&limit=50" | \
  jq -r '.features[].properties.parameterId' | sort -u | grep -E "(pressure|wind|precip)" | head -5

echo -e "\n2. Landbohøjskolen (06186) capabilities:"
echo "   Available parameters:"
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=06186&limit=50" | \
  jq -r '.features[].properties.parameterId' | sort -u

echo -e "\n3. Summary:"
echo "   Landbohøjskolen station appears to be a basic temperature/humidity station"
echo "   For full weather data including pressure, use København Lufthavn (06180)"