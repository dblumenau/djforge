#!/bin/bash

OBSERVED_TIME="2025-07-19T13:00:00Z"

echo "Testing different date conversion methods:"
echo "Original UTC time: $OBSERVED_TIME"
echo ""

# Method 1 - GNU date (Linux)
echo "Method 1 (GNU date):"
TZ="Europe/Copenhagen" date -d "$OBSERVED_TIME" "+%Y-%m-%d %H:%M %Z" 2>/dev/null || echo "GNU date not available"
echo ""

# Method 2 - BSD date (macOS)
echo "Method 2 (BSD date with -j -f):"
TZ="Europe/Copenhagen" date -j -f "%Y-%m-%dT%H:%M:%SZ" "$OBSERVED_TIME" "+%Y-%m-%d %H:%M %Z" 2>/dev/null || echo "BSD date failed"
echo ""

# Method 3 - Using epoch time
echo "Method 3 (via epoch):"
if command -v gdate >/dev/null 2>&1; then
    # If GNU date is available as gdate (common on macOS with coreutils)
    EPOCH=$(gdate -d "$OBSERVED_TIME" +%s)
    TZ="Europe/Copenhagen" gdate -d "@$EPOCH" "+%Y-%m-%d %H:%M %Z"
else
    # BSD date method for epoch
    EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$OBSERVED_TIME" +%s 2>/dev/null)
    if [ -n "$EPOCH" ]; then
        TZ="Europe/Copenhagen" date -r "$EPOCH" "+%Y-%m-%d %H:%M %Z"
    fi
fi