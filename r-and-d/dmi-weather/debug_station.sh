#!/bin/bash

# DMI API credentials
API_KEY="78025163-28df-4624-996a-2657ddb0cf27"
BASE_URL="https://dmigw.govcloud.dk/v2/metObs"

# Get station details
echo "Getting station details for Landbohøjskolen (06186)..."
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/station/items/06186" | jq .

echo -e "\n\nGetting all available observations from this station..."
curl -s -H "X-Gravitee-Api-Key: $API_KEY" \
  "${BASE_URL}/collections/observation/items?stationId=06186&limit=10&sortorder=observed,desc" | jq '.features[] | {parameterId: .properties.parameterId, value: .properties.value, observed: .properties.observed}'