#!/bin/bash

# DMI API credentials
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"

echo "Checking latest observations from Landbohøjskolen (06186)..."
echo "Without any time restriction:"

curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=06186&limit=20" | jq -r '.features[] | "Parameter: \(.properties.parameterId) - Value: \(.properties.value) - Time: \(.properties.observed)"' | head -20

echo -e "\n\nChecking for ANY temperature parameters..."
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=06186&limit=100" | jq -r '.features[] | select(.properties.parameterId | contains("temp")) | "Parameter: \(.properties.parameterId) - Value: \(.properties.value) - Time: \(.properties.observed)"' | head -10