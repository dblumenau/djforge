#!/bin/bash

# Deploy DJForge to Fly.io
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo -e "${RED}❌ flyctl is not installed!${NC}"
    echo "Install it with: brew install flyctl"
    exit 1
fi

# Check if logged in
if ! flyctl auth whoami &> /dev/null; then
    echo -e "${YELLOW}📝 Not logged in to Fly.io${NC}"
    flyctl auth login
fi

# Function to check if app exists
app_exists() {
    flyctl apps list | grep -q "$1"
}

# Parse command line arguments
ACTION=${1:-deploy}
COMPONENT=${2:-all}

# Check for help flag
if [ "$ACTION" = "--help" ] || [ "$ACTION" = "-h" ] || [ "$ACTION" = "help" ]; then
    ACTION="help"
fi

case $ACTION in
    "init")
        echo "🚀 DJForge Fly.io Deployment Tool"
        echo -e "${GREEN}🔧 Initializing Fly.io apps...${NC}"
        
        # Create server app
        if app_exists "djforge-server"; then
            echo -e "${YELLOW}⚠️  djforge-server already exists${NC}"
        else
            echo "Creating djforge-server app..."
            cd server
            flyctl launch --name djforge-server --no-deploy --region fra
            cd ..
        fi
        
        # Create client app
        if app_exists "djforge-client"; then
            echo -e "${YELLOW}⚠️  djforge-client already exists${NC}"
        else
            echo "Creating djforge-client app..."
            cd client
            flyctl launch --name djforge-client --no-deploy --region fra
            cd ..
        fi
        
        echo -e "${GREEN}✅ Apps initialized!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Set secrets: ./deploy-to-fly.sh secrets"
        echo "2. Deploy: ./deploy-to-fly.sh deploy"
        ;;
        
    "secrets")
        echo "🚀 DJForge Fly.io Deployment Tool"
        echo -e "${GREEN}🔐 Setting up secrets...${NC}"
        echo ""
        echo "Enter your production secrets:"
        
        read -p "SPOTIFY_CLIENT_ID: " SPOTIFY_CLIENT_ID
        read -p "SPOTIFY_CLIENT_SECRET: " SPOTIFY_CLIENT_SECRET
        read -p "OPENROUTER_API_KEY: " OPENROUTER_API_KEY
        read -p "SESSION_SECRET (leave blank to generate): " SESSION_SECRET
        
        if [ -z "$SESSION_SECRET" ]; then
            SESSION_SECRET=$(openssl rand -base64 32)
            echo "Generated SESSION_SECRET: $SESSION_SECRET"
        fi
        
        read -p "REDIS_HOST (leave blank for local): " REDIS_HOST
        read -p "REDIS_PORT (default 6379): " REDIS_PORT
        read -s -p "REDIS_PASSWORD: " REDIS_PASSWORD
        echo ""
        
        # Set server secrets
        cd server
        flyctl secrets set \
            SPOTIFY_CLIENT_ID="$SPOTIFY_CLIENT_ID" \
            SPOTIFY_CLIENT_SECRET="$SPOTIFY_CLIENT_SECRET" \
            SPOTIFY_REDIRECT_URI="https://djforge-server.fly.dev/callback" \
            SESSION_SECRET="$SESSION_SECRET" \
            OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
            REDIS_HOST="${REDIS_HOST:-localhost}" \
            REDIS_PORT="${REDIS_PORT:-6379}" \
            REDIS_PASSWORD="$REDIS_PASSWORD" \
            -a djforge-server
        cd ..
        
        echo -e "${GREEN}✅ Secrets configured!${NC}"
        ;;
        
    "deploy")
        echo "🚀 Deploying DJForge to Fly.io..."
        if [ "$COMPONENT" = "all" ] || [ "$COMPONENT" = "server" ]; then
            echo -e "${GREEN}📦 Deploying server...${NC}"
            cd server
            
            # Deploy with no-cache to ensure fresh build
            flyctl deploy -a djforge-server --no-cache
            cd ..
        fi
        
        if [ "$COMPONENT" = "all" ] || [ "$COMPONENT" = "client" ]; then
            echo -e "${GREEN}📦 Deploying client...${NC}"
            cd client
            
            # Deploy with API URL and no-cache
            flyctl deploy -a djforge-client --build-arg VITE_API_URL=https://djforge-server.fly.dev --no-cache
            cd ..
        fi
        
        echo -e "${GREEN}✅ Deployment complete!${NC}"
        echo ""
        echo "Your apps are available at:"
        echo "- Server: https://djforge-server.fly.dev"
        echo "- Client: https://djforge-client.fly.dev"
        ;;
        
    "status")
        echo "🚀 DJForge Fly.io Status Check"
        echo -e "${GREEN}📊 Checking app status...${NC}"
        echo ""
        echo "Server status:"
        flyctl status -a djforge-server
        echo ""
        echo "Client status:"
        flyctl status -a djforge-client
        ;;
        
    "logs")
        if [ "$COMPONENT" = "server" ]; then
            echo -e "${GREEN}📋 Fetching logs for djforge-server...${NC}"
            flyctl logs -a djforge-server
        elif [ "$COMPONENT" = "client" ]; then
            echo -e "${GREEN}📋 Fetching logs for djforge-client...${NC}"
            flyctl logs -a djforge-client
        else
            echo "Please specify: ./deploy-to-fly.sh logs server|client"
        fi
        ;;
        
    "scale")
        echo "🚀 DJForge Fly.io Scaling"
        COUNT=${3:-1}
        if [ "$COMPONENT" = "server" ]; then
            flyctl scale count $COUNT -a djforge-server
        elif [ "$COMPONENT" = "client" ]; then
            flyctl scale count $COUNT -a djforge-client
        else
            echo "Please specify: ./deploy-to-fly.sh scale server|client [count]"
        fi
        ;;
        
    "destroy")
        echo "🚀 DJForge Fly.io App Management"
        echo -e "${RED}⚠️  This will destroy your Fly.io apps!${NC}"
        read -p "Are you sure? (yes/no): " CONFIRM
        if [ "$CONFIRM" = "yes" ]; then
            flyctl apps destroy djforge-server -y
            flyctl apps destroy djforge-client -y
            echo -e "${GREEN}✅ Apps destroyed${NC}"
        fi
        ;;
        
    "help")
        echo "DJForge Fly.io Deployment Script"
        echo ""
        echo "Usage: ./deploy-to-fly.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  init              Initialize Fly.io apps"
        echo "  secrets           Set production secrets"
        echo "  deploy [all|server|client]   Deploy apps (default: all)"
        echo "  status            Check app status"
        echo "  logs [server|client]         View app logs"
        echo "  scale [server|client] [count]  Scale app instances"
        echo "  destroy           Destroy all apps"
        echo "  help, -h, --help  Show this help message"
        echo ""
        echo "Example workflow:"
        echo "  1. ./deploy-to-fly.sh init"
        echo "  2. ./deploy-to-fly.sh secrets"
        echo "  3. ./deploy-to-fly.sh deploy"
        ;;
        
    *)
        echo "Unknown command: $ACTION"
        echo "Use './deploy-to-fly.sh --help' for usage information"
        exit 1
        ;;
esac