# Pages Directory

This directory contains the main page components for the Spotify Claude Controller application.

## Page Components

### MainApp.tsx
- Main application interface with command input and response display
- Integrates Spotify playback controls and LLM command processing
- Handles command history and model selection
- Located at route: `/`

### Dashboard.tsx
- Comprehensive Spotify data visualization dashboard
- Displays user profile, top artists/tracks, saved items, and listening insights
- Features interactive charts and real-time playback controls
- Located at route: `/dashboard`

### TasteProfile.tsx
- Displays the user's music taste profile as seen by the LLM
- Shows formatted text exactly as included in LLM prompts
- Includes refresh button to update cached profile data
- Located at route: `/taste-profile`
- Profile data cached for 1 hour in Redis

## Routing

All pages are configured in `/client/src/App.tsx` using React Router v6.

## Authentication

All pages require authentication via Spotify OAuth. Users without valid JWT tokens are redirected to the landing page.