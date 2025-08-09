#!/bin/bash

# Test script for GPT-5 context handling
SERIES="taylor_context_test"
API_URL="http://localhost:4001/api/llm/test"

echo "===================================="
echo "GPT-5 Context Test - Taylor Swift"
echo "===================================="
echo ""

# Step 1: Clear the test series
echo "1. Clearing test series '$SERIES'..."
curl -X DELETE "$API_URL/$SERIES" 2>/dev/null | jq '.message'
echo ""

# Step 2: Ask about Taylor Swift
echo "2. Sending: 'tell me about taylor swift'"
RESPONSE1=$(curl -X POST "$API_URL/$SERIES" \
  -H "Content-Type: application/json" \
  -d '{"command": "tell me about taylor swift", "model": "gpt-5-nano"}' \
  2>/dev/null)

echo "Response intent: $(echo "$RESPONSE1" | jq '.interpretation.intent')"
echo "Response message: $(echo "$RESPONSE1" | jq '.response.message')"
echo ""

# Step 3: Test contextual reference
echo "3. Sending: 'play some of her stuff'"
RESPONSE2=$(curl -X POST "$API_URL/$SERIES" \
  -H "Content-Type: application/json" \
  -d '{"command": "play some of her stuff", "model": "gpt-5-nano"}' \
  2>/dev/null)

echo "Response intent: $(echo "$RESPONSE2" | jq '.interpretation.intent')"
echo "Songs selected:"
echo "$RESPONSE2" | jq '.interpretation.songs[]? | "\(.artist) - \(.track)"'

# Check if all songs are by Taylor Swift
echo ""
echo "===================================="
echo "VERIFICATION"
echo "===================================="
ARTISTS=$(echo "$RESPONSE2" | jq -r '.interpretation.songs[]?.artist' | sort | uniq)
echo "Unique artists in response: $ARTISTS"

if [ "$ARTISTS" = "Taylor Swift" ]; then
  echo "✅ SUCCESS: All songs are by Taylor Swift!"
  echo "The context is working correctly!"
else
  echo "❌ FAILED: Found other artists besides Taylor Swift"
  echo "Context is not being properly maintained"
fi

echo ""
echo "To see full conversation history:"
echo "curl $API_URL/$SERIES | jq"