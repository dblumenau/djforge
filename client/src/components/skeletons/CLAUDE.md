# Skeleton Loading States System

The application implements a comprehensive skeleton loading system that eliminates layout shift and provides immediate visual feedback during data loading operations.

## Architecture Overview

**Zero Layout Shift Implementation**:
- Skeleton components match exact dimensions of final content
- Progressive content replacement without visual disruption
- Granular loading states for different sections
- Motion-safe accessibility variants using `motion-safe:animate-pulse`

**Key Design Principles**:
1. **Immediate Response**: Skeleton appears instantly on user action
2. **Accurate Dimensions**: Matches final content layout precisely
3. **Accessibility**: Respects user motion preferences
4. **Progressive Loading**: Individual sections load independently

## Skeleton Components

### Core Components

1. **ProfileSkeleton** - User profile card loading state
   - Avatar placeholder (24x24 rounded circle)
   - Three text lines with varying widths (1/2, 1/3, 2/3)
   - Matches profile card layout exactly

2. **StatCardSkeleton** - Statistics card loading state
   - Number placeholder (16px height, 16px width, centered)
   - Label placeholder (4px height, 20px width, centered)
   - Used for stats like follower counts, track counts

3. **TrackListSkeleton** - Track list loading state
   - Configurable count (default: 5 tracks)
   - Track number, album art (12x12), track info, action buttons, duration
   - Matches saved tracks table and top tracks layouts

4. **AlbumGridSkeleton** - Album/artist grid loading state
   - Configurable count (default: 12 items)
   - Responsive grid (2-6 columns based on screen size)
   - Square aspect ratio images with metadata below

5. **TimelineSkeleton** - Recently played timeline loading state
   - Configurable date groups and tracks per group
   - Timeline line with circular date markers
   - Track cards with precise spacing and alignment

6. **ChartSkeleton** - Data visualization loading state
   - Configurable height (default: h-64)
   - Optional title area with placeholder text
   - Bar chart simulation with random heights
   - Legend area with color dots and labels

7. **CommandHistorySkeleton** - Command history loading state
   - Configurable count (default: 3 commands)
   - Command text with badges, response content, metadata
   - Matches command history card structure

## Implementation Patterns

### Tailwind CSS Animation
```typescript
// All skeletons use motion-safe prefix
className="motion-safe:animate-pulse bg-zinc-700 rounded"

// Respects user's prefers-reduced-motion setting
// Falls back to static loading state for accessibility
```

### Responsive Design
```typescript
// AlbumGridSkeleton responsive grid
className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"

// Matches production grid layouts exactly
```

### Configurable Components
```typescript
interface TrackListSkeletonProps {
  count?: number;  // Default: 5
}

interface TimelineSkeletonProps {
  dateGroups?: number;     // Default: 3
  tracksPerGroup?: number; // Default: 4
}
```

## Dashboard Integration

### Granular Loading States (Dashboard.tsx)
```typescript
interface DashboardLoadingState {
  profile: boolean;        // User profile section
  stats: boolean;          // Quick stats cards
  topItems: boolean;       // Top artists/tracks
  savedTracks: boolean;    // Saved tracks table
  savedAlbums: boolean;    // Saved albums grid
  recentlyPlayed: boolean; // Recently played timeline
  playlists: boolean;      // User playlists grid
  insights: boolean;       // Data visualization charts
}
```

### Progressive Loading Pattern
- Each section loads independently
- Skeleton shown until specific data is available
- No cascading layout shifts as content populates
- Loading states cleared only when data is fully rendered

### Usage Examples
```typescript
// Profile section
{loadingStates.profile || !dashboardData ? (
  <ProfileSkeleton />
) : (
  <UserProfileCard data={dashboardData.profile} />
)}

// Configurable track list
{loadingStates.savedTracks || !dashboardData ? (
  <TrackListSkeleton count={10} />
) : (
  <SavedTracksTable tracks={dashboardData.savedTracks.items} />
)}

// Timeline with custom grouping
{loadingStates.recentlyPlayed || !dashboardData ? (
  <TimelineSkeleton dateGroups={4} tracksPerGroup={5} />
) : (
  <RecentlyPlayedTimeline data={dashboardData.recentlyPlayed} />
)}
```

## MainApp Command History Integration

**Command History Loading** (MainApp.tsx):
- Shows skeleton during initial command history fetch
- Prevents empty state flash before data loads
- Graceful fallback to empty state message if no commands exist

```typescript
{commandHistoryLoading ? (
  <CommandHistorySkeleton count={3} />
) : commandHistory.length === 0 ? (
  <p className="text-gray-500 text-center py-8">No commands yet. Try sending a command!</p>
) : (
  <CommandHistoryList commands={commandHistory} />
)}
```

## Visual Design System

### Color Palette
- `bg-zinc-900` - Component backgrounds
- `bg-zinc-700` - Skeleton element fills
- `bg-zinc-800` - Chart/timeline backgrounds
- `border-zinc-800` - Subtle borders

### Spacing & Sizing
- Consistent with production components
- Proper flex-shrink-0 for fixed elements
- Responsive spacing using Tailwind utilities

### Animation
- `motion-safe:animate-pulse` - Respects accessibility preferences
- Subtle pulsing effect for visual feedback
- No motion for users with prefers-reduced-motion

## Performance Benefits

1. **Immediate Visual Feedback**: Users see loading state instantly
2. **Zero Layout Shift**: Content appears in exact final positions
3. **Reduced Perceived Load Time**: Progressive loading feels faster
4. **Better UX Flow**: Smooth transitions from loading to content
5. **Accessibility Compliant**: Motion-safe animations

## Development Patterns

### Creating New Skeletons
1. Match exact dimensions of final content
2. Use consistent color palette (zinc-700/800/900)
3. Include motion-safe prefix for animations
4. Make count/size configurable where appropriate
5. Test with real content to ensure perfect alignment

### Loading State Management
1. Start with all loading states true
2. Clear individual states as data becomes available
3. Use conditional rendering with skeleton as fallback
4. Never show skeleton and content simultaneously

## Debugging Tips

### Common Issues
- **Layout shift during loading** → Check skeleton dimensions match final content
- **Animation not working** → Verify `motion-safe:animate-pulse` class usage
- **Content flashing** → Ensure loading states start as `true` and clear only when data ready
- **Accessibility concerns** → Test with `prefers-reduced-motion: reduce` setting

This skeleton system significantly improves the user experience by providing immediate visual feedback and eliminating the jarring effects of content popping into place during load operations.