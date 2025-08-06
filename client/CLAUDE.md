# Client Directory

This directory contains the React frontend application for the Spotify Claude Controller.

## Structure

```
client/
   src/
      components/          # Reusable React components
         playback/         # Refactored playback control components
         playlist-search/  # Playlist search UI components
         dashboard/        # Dashboard visualization components
         skeletons/        # Loading skeleton components
      pages/              # Main page components
      hooks/              # Custom React hooks
      utils/              # Utility functions
      @types/             # TypeScript type definitions
      types/              # Additional type definitions
      App.tsx             # Main router configuration
      main.tsx            # Application entry point
      index.css           # Global styles with Tailwind
   public/               # Static assets
   package.json          # Dependencies and scripts
```

## Key Technologies

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router v6** for client-side routing
- **Tailwind CSS v4** for styling
- **Spotify Web API** for music data
- **Socket.IO** for WebSocket real-time communication

## Main Features

### Modern Chat Interface
- **ChatGPT-style UI**: Clean conversation flow with chronological messages
- **Fixed Layout Structure**:
  - Header navigation bar with controls at top
  - Scrollable chat area in the middle
  - Fixed input area at bottom
- **Responsive Design**: 
  - Desktop: Full navigation in header
  - Mobile: Hamburger menu with slide-out drawer
- **Component Architecture**:
  - `HeaderNav`: Fixed top navigation
  - `ChatMessage`: Individual message bubbles
  - `ChatInput`: Bottom input with send button
  - `MobileMenu`: Full-featured mobile navigation

### Authentication
- Spotify OAuth 2.0 with PKCE flow
- JWT token management
- Automatic token refresh
- Session persistence

### Music Control
- Natural language command processing
- Multiple LLM model support
- Real-time playback controls with WebSocket events
- Queue management
- Volume control
- **Enhanced PlaybackControls**: Modular components with three view modes
  - Minimized: Compact horizontal bar
  - Normal: Full controls with medium visuals
  - **Fullscreen**: Immersive experience with ambient album art glow and optimized mobile support
- **Device Selector Improvements**: Fixed JSX element wrapping in compact mode to prevent React errors
- Keyboard shortcuts (Space, Arrow keys, Escape) in fullscreen mode

### Data Visualization
- Comprehensive dashboard with listening insights
- Music taste profile viewer
- AI feedback dashboard with optimistic updates
- Top artists and tracks display
- Recently played history
- Saved library browsing
- **Playlist Search**: Advanced search with detailed exploration
  - Real-time search with debouncing
  - Multi-tab playlist details modal
  - Analytics and insights
  - Track-by-track exploration

### User Experience
- Dark theme optimized for music
- Responsive design for all devices
- **Skeleton Loading States**: Zero layout shift loading with motion-safe animations
- **Enhanced Browser Compatibility**: 
  - **Safari Optimizations**: Aggressive HTML cache-busting to prevent stale content issues
  - Fixed Safari-specific seeking and progress bar issues
  - Cross-browser playback control compatibility
- Command history with confidence scores
- Optimistic UI updates for instant feedback
- Smooth fade-out transitions with Tailwind v4
- Duplicate submission prevention
- Feedback undo functionality
- Toast notifications for user actions

## Development

### Setup
```bash
cd client
npm install
npm run dev
```

### Environment Variables
Create `.env` file:
```
VITE_API_URL=http://localhost:4001  # Development API URL
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript compiler

## Routes

- `/` - Main application with chat-style interface
- `/landing` - Authentication page
- `/dashboard` - Spotify data dashboard
- `/taste-profile` - User taste profile viewer
- `/feedback-dashboard` - AI feedback management with optimistic UI updates
- `/playlist-search` - Comprehensive playlist search and exploration
- `/websocket-demo` - WebSocket demonstration (authenticated)
- `/callback` - OAuth callback handler

## Component Documentation

Each major component directory has its own CLAUDE.md:
- `/components/CLAUDE.md` - Overview of all components
- `/components/playback/CLAUDE.md` - Playback control components
- `/components/playlist-search/CLAUDE.md` - Playlist search components
- `/components/dashboard/CLAUDE.md` - Dashboard components
- `/components/skeletons/CLAUDE.md` - Skeleton loading components

## API Integration

All API calls go through `utils/api.ts` which provides:
- Centralized fetch wrapper
- JWT token attachment
- Error handling
- Type safety

## Styling

Using Tailwind CSS v4 with custom configuration:
- Dark theme by default
- Spotify green accent colors
- Custom animations for loaders
- Responsive breakpoints

## Testing

- Jest configured but minimal tests
- Focus on manual testing
- Type safety via TypeScript

## Deployment

- Built with Vite for optimized production bundles
- Static files served via Nginx in Docker
- Environment variables injected at build time

## Recent Major Changes

### PlaybackControls Refactoring (2025)
- Split 1400+ line component into modular subcomponents
- Created dedicated `playback/` directory
- Improved maintainability and code organization
- Added fullscreen mode with immersive visualization

### Playlist Search Feature (2025)
- Comprehensive playlist search functionality
- Multi-tab details modal
- Analytics and insights
- Modular component architecture

### WebSocket Integration (2025)
- Real-time communication with Socket.IO
- Live playback state updates
- Keyboard shortcut tracking
- Authenticated WebSocket connections