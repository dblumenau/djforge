# Pages Directory

This directory contains the main page components for the Spotify Claude Controller application.

## Page Components

### MainApp.tsx
- Main application interface with command input and response display
- Integrates Spotify playback controls and LLM command processing
- Handles command history and model selection with skeleton loading
- **Skeleton Loading**: Command history skeleton prevents empty state flash
- Located at route: `/`

### Dashboard.tsx
- Comprehensive Spotify data visualization dashboard with granular skeleton loading
- Displays user profile, top artists/tracks, saved items, and listening insights
- Features interactive charts and real-time playback controls
- **Skeleton Loading**: Section-by-section loading with zero layout shift
- Progressive content replacement as data becomes available
- Located at route: `/dashboard`

### TasteProfile.tsx
- Displays the user's music taste profile as seen by the LLM
- Shows formatted text exactly as included in LLM prompts
- Includes refresh button to update cached profile data
- Located at route: `/taste-profile`
- Profile data cached for 1 hour in Redis

### FeedbackDashboard.tsx
- AI feedback management interface with advanced UX improvements
- Features optimistic UI updates without page reloads
- Smooth fade-out transitions using Tailwind v4 utilities
- Feedback undo functionality (click same button to remove feedback)
- Duplicate submission prevention with loading states
- Filter tabs: Pending, All, Loved, Disliked discoveries
- Individual Spotify track players with 30-second previews
- Located at route: `/feedback-dashboard`
- Real-time statistics display with automatic updates

## Routing

All pages are configured in `/client/src/App.tsx` using React Router v6.

## Authentication

All pages require authentication via Spotify OAuth. Users without valid JWT tokens are redirected to the landing page.