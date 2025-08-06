# Contexts Directory

This directory contains React Context providers for global state management across the Spotify Claude Controller application.

## Context Providers

### AuthContext.tsx
- **Purpose**: Manages user authentication state across the entire application
- **State Management**:
  - `isAuthenticated` - Boolean authentication status
  - `loading` - Loading state during auth checks
  - Authentication status polling and caching
- **Key Features**:
  - Automatic authentication status checking
  - Session ID management via auth service
  - Graceful handling of server restarts (503 responses)
  - Debounced auth checks to prevent excessive API calls
  - Logout functionality with session cleanup
- **Integration**: Used by components to conditionally render authenticated vs unauthenticated views

### ErrorContext.tsx
- **Purpose**: Global error handling and user notification system
- **Features**:
  - Centralized error state management
  - Error message display coordination
  - Toast notification integration
  - Error recovery mechanisms
- **Integration**: Provides error handling capabilities to all child components

### ModelContext.tsx
- **Purpose**: Manages LLM model selection and preferences
- **State Management**:
  - Current selected model (OpenRouter vs Gemini)
  - Model switching capabilities
  - User preference persistence
- **Features**:
  - Model availability checking
  - Fallback model handling
  - Integration with backend model routing
- **Integration**: Used by model selector components and LLM request handlers

### PlaybackContext.tsx
- **Purpose**: Global playback state management for Spotify integration
- **State Management**:
  - Current track information
  - Playback status (playing/paused)
  - Volume, shuffle, and repeat states
  - Device information
- **Features**:
  - Real-time playback state synchronization
  - WebSocket integration for live updates
  - Playback control action coordination
  - State persistence across component remounts
- **Integration**: Provides playback data and controls to all music-related components

## Context Architecture

### Provider Hierarchy
```
App
├── AuthProvider
    ├── ErrorProvider
        ├── ModelProvider
            ├── PlaybackProvider
                └── Application Components
```

### State Flow
1. **Authentication**: AuthContext checks and maintains user session
2. **Error Handling**: ErrorContext catches and displays application errors
3. **Model Selection**: ModelContext manages LLM preferences
4. **Playback State**: PlaybackContext synchronizes music playback across components

## Usage Patterns

### Consuming Contexts
```typescript
// Authentication
const { isAuthenticated, loading, login, logout } = useAuth();

// Error handling
const { showError, clearError } = useError();

// Model selection
const { selectedModel, switchModel } = useModel();

// Playback state
const { currentTrack, isPlaying, controls } = usePlayback();
```

### Context Integration
- All contexts use custom hooks for type safety
- Contexts are consumed via React's `useContext` hook
- Error boundaries integrate with ErrorContext for global error handling
- Contexts provide both state and action methods to child components

## Performance Considerations

- **Selective Re-renders**: Contexts split state to minimize unnecessary re-renders
- **Memoization**: Context values are memoized where appropriate
- **Lazy Loading**: Context providers only load when needed
- **Debouncing**: Auth checks and API calls are debounced to prevent excessive requests

## Development Guidelines

### Adding New Contexts
1. Create context provider with TypeScript interfaces
2. Implement custom hook for type-safe consumption
3. Add to provider hierarchy in appropriate order
4. Document state management patterns
5. Add error handling for context operations

### Context Best Practices
- Keep context state minimal and focused
- Use multiple small contexts over one large context
- Implement proper error boundaries
- Provide meaningful default values
- Use TypeScript for strict typing

This context architecture provides a solid foundation for global state management while maintaining performance and developer experience.