#!/bin/bash

# DMI API credentials
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"
STATION_ID="06186"

echo "Testing API call for temp_mean_past1h..."
RESPONSE=$(curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&parameterId=temp_mean_past1h&limit=1")

echo "Raw response:"
echo "$RESPONSE" | jq .

echo -e "\n\nNumber of features:"
echo "$RESPONSE" | jq '.features | length'

echo -e "\n\nTrying without datetime filter:"
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=${STATION_ID}&parameterId=temp_mean_past1h&limit=5" | jq .