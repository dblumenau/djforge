#!/bin/bash

# Fly.io environment variable setup for Sentry
# Run this script to add Sentry configuration to your Fly.io deployment

echo "Setting Sentry environment variables on Fly.io..."

# Client DSN (for frontend)
fly secrets set SENTRY_DSN_CLIENT="https://cf410304d6c0e9f558cf1a1df9d31789@o4509741045579776.ingest.de.sentry.io/4509741102727248"

# Server DSN (for backend)
fly secrets set SENTRY_DSN_SERVER="https://18505a4fbecc87e3b465673e827b4cae@o4509741045579776.ingest.de.sentry.io/4509741295009872"

# Also set VITE_SENTRY_DSN for the client build process
fly secrets set VITE_SENTRY_DSN="https://cf410304d6c0e9f558cf1a1df9d31789@o4509741045579776.ingest.de.sentry.io/4509741102727248"

echo "Sentry environment variables have been set!"
echo "Run 'fly deploy' to apply these changes to your deployment."