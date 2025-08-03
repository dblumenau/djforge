# PlaylistSearch.tsx Refactoring Plan

## Task Overview
Refactor the PlaylistSearch.tsx file (>1150 lines) into smaller, manageable components by extracting logical sections into separate files while maintaining exact functionality.

## Current Analysis Needed
- Read the existing PlaylistSearch.tsx file to understand structure
- Identify all imports, types, and dependencies
- Map out component boundaries and data flow
- Identify shared state and props that need to be passed down

## Proposed Directory Structure
```
/client/src/components/playlist-search/
├── PlaylistDetailsModal.tsx
├── PlaylistCard.tsx  
├── SearchGuide.tsx
└── PlaylistModalTabs/
    ├── OverviewTab.tsx
    ├── TracksTab.tsx
    ├── AnalyticsTab.tsx
    └── JsonTab.tsx
```

## Components to Extract

### 1. PlaylistDetailsModal.tsx
- The entire modal component with all its tabs
- Props needed: selectedPlaylist, onClose, all modal-related state

### 2. PlaylistCard.tsx  
- Individual playlist card component
- Props needed: playlist data, onClick handler, display preferences

### 3. SearchGuide.tsx
- The comprehensive search guide section
- Props needed: minimal, mostly static content

### 4. PlaylistModalTabs/
- **OverviewTab.tsx**: Overview tab content
- **TracksTab.tsx**: Tracks tab content  
- **AnalyticsTab.tsx**: Analytics tab content
- **JsonTab.tsx**: JSON tab content
- Props needed: playlist data, tab-specific state

## What Stays in Main File
- Main search logic and state management
- Search input component
- Results display logic
- Top-level component coordination
- All TypeScript interfaces (or move to separate types file)

## Implementation Strategy
1. Create directory structure
2. Read and analyze current file
3. Extract components one by one:
   - Start with SearchGuide (simplest)
   - Then PlaylistCard
   - Then modal tabs
   - Finally PlaylistDetailsModal
4. Update main file imports and usage
5. Verify TypeScript compilation at each step

## Risks & Considerations
- Complex prop drilling for modal state
- Shared TypeScript interfaces need careful handling
- Import paths for icons, utilities must be maintained
- State management dependencies between components
- Event handlers and callbacks must be properly passed

## Success Criteria
- All components compile without TypeScript errors
- Exact same functionality preserved
- Clean separation of concerns
- Maintainable component structure
- No runtime errors or broken features

## File Analysis Complete

### Current Structure (1153 lines):
- **Lines 1-114**: Imports + TypeScript interfaces (8 interfaces total)
- **Lines 116-332**: Main component with state, search logic, utility functions
- **Lines 333-808**: Main render with search input, results, comprehensive search guide
- **Lines 809-1152**: Massive modal with 4 tabs (overview, tracks, analytics, json)

### Components to Extract:

#### 1. SearchGuide.tsx (Lines 557-805)
- Static comprehensive search guide section
- Can be extracted easily with minimal props
- Props needed: setSearchQuery, performSearch (for clickable examples)

#### 2. PlaylistCard.tsx (Lines 419-516) 
- Individual playlist card component
- Props needed: playlist, truncateDescription function, fetchPlaylistDetails

#### 3. PlaylistDetailsModal.tsx (Lines 811-1150)
- Entire modal component with portal
- Props needed: showModal, setShowModal, selectedPlaylist, loadingDetails, modalTab, setModalTab, copiedItem, copyToClipboard, calculateAnalytics, formatDuration, formatDate

#### 4. Modal Tab Components:
- **OverviewTab.tsx** (Lines 871-961): Overview content
- **TracksTab.tsx** (Lines 964-1043): Tracks list 
- **AnalyticsTab.tsx** (Lines 1046-1118): Analytics display
- **JsonTab.tsx** (Lines 1122-1138): JSON viewer

### Implementation Plan:
1. Create directory structure
2. Extract SearchGuide first (simplest)
3. Extract PlaylistCard
4. Extract modal tabs into separate files
5. Extract PlaylistDetailsModal
6. Update main file to use new components
7. Keep all TypeScript interfaces in main file for now (can be moved later if needed)

## Ready to Proceed
- All analysis complete
- Clear component boundaries identified
- Props and dependencies mapped out
- Ready to begin incremental extraction