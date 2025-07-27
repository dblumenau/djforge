#!/bin/bash

# Script to upload source maps to Sentry after build
# This is optional but helps with better stack traces

echo "📦 Uploading source maps to Sentry..."

# Get the release version (you can customize this)
RELEASE="spotify-claude-controller@$(date +%Y%m%d-%H%M%S)"

# Upload client source maps
echo "📤 Uploading client source maps..."
npx @sentry/cli sourcemaps upload \
  --org=your-org-name \
  --project=your-frontend-project \
  --release=$RELEASE \
  client/dist

# Upload server source maps
echo "📤 Uploading server source maps..."
npx @sentry/cli sourcemaps upload \
  --org=your-org-name \
  --project=your-backend-project \
  --release=$RELEASE \
  server/dist

echo "✅ Source maps uploaded for release: $RELEASE"