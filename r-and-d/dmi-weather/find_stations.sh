#!/bin/bash

# DMI API credentials
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"

echo "Searching for all stations with 'Landbohøjskolen' in the name..."
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/station/items?limit=1000" | jq -r '.features[] | select(.properties.name | contains("Landbohøjskolen")) | "ID: \(.properties.stationId) - Name: \(.properties.name) - Status: \(.properties.status) - Coordinates: \(.geometry.coordinates)"'

echo -e "\n\nSearching in broader Copenhagen area (55.6-55.8°N, 12.4-12.7°E)..."
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/station/items?bbox=12.4,55.6,12.7,55.8&limit=100" | jq -r '.features[] | "ID: \(.properties.stationId) - Name: \(.properties.name) - Status: \(.properties.status)"' | sort