#!/bin/bash

# Manual Fly.io Sentry environment variable setup
# Replace 'your-app-name' with your actual Fly.io app name

APP_NAME="your-app-name"

echo "Setting Sentry environment variables on Fly.io for app: $APP_NAME"

# Client DSN (for frontend)
fly secrets set SENTRY_DSN_CLIENT="https://cf410304d6c0e9f558cf1a1df9d31789@o4509741045579776.ingest.de.sentry.io/4509741102727248" -a $APP_NAME

# Server DSN (for backend)
fly secrets set SENTRY_DSN_SERVER="https://18505a4fbecc87e3b465673e827b4cae@o4509741045579776.ingest.de.sentry.io/4509741295009872" -a $APP_NAME

# Also set VITE_SENTRY_DSN for the client build process
fly secrets set VITE_SENTRY_DSN="https://cf410304d6c0e9f558cf1a1df9d31789@o4509741045579776.ingest.de.sentry.io/4509741102727248" -a $APP_NAME

echo "Sentry environment variables have been set!"
echo "Run 'fly deploy -a $APP_NAME' to apply these changes to your deployment."