#!/bin/bash

# Redis connection string
REDIS_URL="redis://default:AXpQAAIjcDFjZjA2ZWE5YzgzM2E0Y2VmODY0ODNlY2QwODY5ODhjMXAxMA@awake-quetzal-31312.upstash.io:6379"

# Connect to Redis and remove Grimes tracks
redis-cli --tls -u "$REDIS_URL" <<EOF
# List all discoveries to find Grimes
LRANGE user:gogekian:ai_discoveries 0 -1

# Remove Grimes from discoveries (you'll need to identify which index after listing)
# Example: LREM user:gogekian:ai_discoveries 0 '{"trackUri":"spotify:track:XXXXX","trackName":"Oblivion","artist":"Grimes",...}'

# Also check and remove from other sets if needed
ZRANGE user:gogekian:ai_loved 0 -1 WITHSCORES
ZRANGE user:gogekian:ai_disliked 0 -1 WITHSCORES
ZRANGE user:gogekian:ai_blocked 0 -1 WITHSCORES
EOF