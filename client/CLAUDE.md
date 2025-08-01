# Client Directory

This directory contains the React frontend application for the Spotify Claude Controller.

## Structure

```
client/
   src/
      components/       # Reusable React components
      pages/           # Main page components
      hooks/           # Custom React hooks
      utils/           # Utility functions
      @types/          # TypeScript type definitions
      App.tsx          # Main router configuration
      main.tsx         # Application entry point
      index.css        # Global styles with Tailwind
   public/              # Static assets
   package.json         # Dependencies and scripts
```

## Key Technologies

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router v6** for client-side routing
- **Tailwind CSS v4** for styling
- **Spotify Web API** for music data

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
- Real-time playback controls
- Queue management
- Volume control
- **Minimizable PlaybackControls**: Horizontal layout that can be collapsed

### Data Visualization
- Comprehensive dashboard with listening insights
- Music taste profile viewer
- AI feedback dashboard with optimistic updates
- Top artists and tracks display
- Recently played history
- Saved library browsing

### User Experience
- Dark theme optimized for music
- Responsive design for all devices
- **Skeleton Loading States**: Zero layout shift loading with motion-safe animations
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
- `/callback` - OAuth callback handler

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