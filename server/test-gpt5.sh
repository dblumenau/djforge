#!/bin/bash

# Test script for GPT-5 Spotify integration

echo "🎵 GPT-5 Spotify Integration Test Script"
echo "========================================="
echo ""

# Check if session ID is provided
if [ -z "$1" ]; then
    echo "❌ Please provide your session ID as an argument"
    echo "Usage: ./test-gpt5.sh YOUR_SESSION_ID"
    echo ""
    echo "To get your session ID:"
    echo "1. Login at http://localhost:5173"
    echo "2. Open browser console and run: localStorage.getItem('sessionId')"
    exit 1
fi

SESSION_ID=$1
API_URL="http://localhost:4001/api/gpt5"

echo "📍 Using session ID: $SESSION_ID"
echo ""

# Test 1: Health check
echo "1️⃣ Testing health endpoint..."
curl -s "$API_URL/health" | jq '.'
echo ""

# Test 2: Play a specific song
echo "2️⃣ Testing play_specific_song function..."
echo "Command: 'Play Hotel California by Eagles'"
curl -X POST "$API_URL/command" \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: $SESSION_ID" \
  -d '{
    "command": "Play Hotel California by Eagles",
    "model": "gpt-5-nano",
    "useTools": true,
    "temperature": 0.7
  }' | jq '.'
echo ""

# Test 3: Try without tools (should just respond with text)
echo "3️⃣ Testing without tools (text-only response)..."
echo "Command: 'What song is playing?'"
curl -X POST "$API_URL/command" \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: $SESSION_ID" \
  -d '{
    "command": "What song is playing?",
    "model": "gpt-5-nano",
    "useTools": false
  }' | jq '.'
echo ""

# Test 4: Check history
echo "4️⃣ Getting conversation history..."
curl -s "$API_URL/history" \
  -H "X-Session-ID: $SESSION_ID" | jq '.'
echo ""

echo "✅ Test complete!"
echo ""
echo "Note: If you see authentication errors, make sure:"
echo "1. You're logged into Spotify at http://localhost:5173"
echo "2. Your session ID is correct"
echo "3. The server is running with Redis enabled"