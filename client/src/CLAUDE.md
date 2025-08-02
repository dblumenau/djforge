# CLAUDE.md - Client Source

This directory contains the React application source code for the Spotify Claude Controller frontend.

## Directory Structure

### `/components`
- Reusable React components
- See `/components/CLAUDE.md` for detailed component documentation

### `/pages`
- Page-level components for routing
- See `/pages/CLAUDE.md` for page documentation

### `/hooks`
- Custom React hooks for reusable logic
- See `/hooks/CLAUDE.md` for hook documentation

### `/services`
- External service integrations and API clients
- **Files**:
  - `auth.service.ts` - Authentication and token management
  - `spotify-client.ts` - Spotify Web API client wrapper
  - `spotifyWebApi.service.ts` - Spotify Web API integration
  - `webPlayer.service.ts` - Spotify Web Playback SDK management
  - `socket.ts` - Socket.IO client singleton for WebSocket communication

### `/services/socket.ts`
- **Purpose**: Socket.IO client singleton for WebSocket connections
- **Features**:
  - Single socket instance for entire application
  - Configured for `/demo` namespace
  - Automatic reconnection with exponential backoff
  - Transport preference: WebSocket with polling fallback
- **Exports**:
  - `socket` - Socket.IO client instance
  - `getSocketId()` - Get current socket ID
  - `getTransport()` - Get current transport type
- **Configuration**:
  ```typescript
  {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  }
  ```

### `/styles`
- Global styles and Tailwind CSS configuration
- Component-specific styles use CSS modules

### `/@types`
- TypeScript type definitions
- See `/@types/CLAUDE.md` for type documentation

### `/utils`
- Utility functions and helpers
- Common functions used across components

### `/contexts`
- React Context providers for global state
- Theme, authentication, and app state management

## Key Files

### `App.tsx`
- Main application component
- Route definitions and layout structure
- Authentication wrapper

### `main.tsx`
- Application entry point
- React DOM rendering
- Provider setup

### `vite-env.d.ts`
- Vite environment type definitions
- Module declarations

## Architecture Patterns

### Component Structure
- Functional components with hooks
- TypeScript for all components
- Props interfaces defined inline or in types file

### State Management
- Local state with `useState`
- Complex state with `useReducer`
- Global state via Context API
- Server state with React Query patterns

### Styling Approach
- Tailwind CSS v4 for utility-first styling
- CSS modules for component-specific styles
- Dark mode support via CSS variables

### Service Layer
- Centralized API communication
- Singleton patterns for persistent connections
- Error handling and retry logic
- Type-safe request/response handling

## WebSocket Integration

The application uses Socket.IO for real-time features:

1. **Socket Service** (`/services/socket.ts`):
   - Manages single socket connection
   - Handles reconnection logic
   - Provides helper functions

2. **useWebSocket Hook** (`/hooks/useWebSocket.ts`):
   - React integration for components
   - Event listener management
   - Connection state tracking
   - Message history

3. **WebSocketDemo Page** (`/pages/WebSocketDemo.tsx`):
   - Live demonstration of WebSocket features
   - Connection controls and status display
   - Message visualization

## Development Guidelines

### Adding New Features
1. Create components in appropriate directories
2. Define TypeScript interfaces for props
3. Use existing hooks and services
4. Follow established patterns

### Code Organization
- Keep components focused and single-purpose
- Extract reusable logic to hooks
- Use services for external communication
- Maintain clear separation of concerns

### Performance Considerations
- Use React.memo for expensive components
- Implement proper dependency arrays
- Lazy load routes and heavy components
- Optimize re-renders with useCallback/useMemo

### Testing Strategy
- Unit tests for utilities and hooks
- Integration tests for services
- Component testing with React Testing Library
- E2E tests for critical user flows