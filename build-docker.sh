#!/bin/bash

# Build script for DJForge Docker containers
set -e

echo "🐳 Building DJForge Docker containers..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Copy .env.docker to .env and configure it."
    exit 1
fi

# Parse command line arguments
BUILD_MODE=${1:-development}
NO_CACHE=${2:-false}

echo "📦 Build mode: $BUILD_MODE"

# Build based on mode
if [ "$BUILD_MODE" = "production" ]; then
    echo "🏭 Building for production..."
    
    # Build with production compose file
    if [ "$NO_CACHE" = "no-cache" ]; then
        docker-compose -f docker-compose.prod.yml build --no-cache
    else
        docker-compose -f docker-compose.prod.yml build
    fi
    
    echo "✅ Production build complete!"
    echo "🚀 To run: docker-compose -f docker-compose.prod.yml up -d"
    
elif [ "$BUILD_MODE" = "development" ]; then
    echo "🔧 Building for development..."
    
    # Build with development compose file
    if [ "$NO_CACHE" = "no-cache" ]; then
        docker-compose build --no-cache
    else
        docker-compose build
    fi
    
    echo "✅ Development build complete!"
    echo "🚀 To run: docker-compose up -d"
    
else
    echo "❌ Invalid build mode. Use 'development' or 'production'"
    exit 1
fi

echo ""
echo "📋 Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop services: docker-compose down"
echo "  - Remove volumes: docker-compose down -v"
echo "  - Enter server container: docker exec -it djforge-server sh"
echo "  - Enter client container: docker exec -it djforge-client sh"