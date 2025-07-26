# AI Track Feedback System

## Core Concept
Create a feedback system specifically for AI-discovered tracks (not user-requested specific songs). This gives users a way to train the AI on what constitutes good vs bad recommendations.

## Key Principles

### 1. Only AI-Discovered Tracks
- Track when AI made a creative choice (e.g., "play something I like", "something melancholy")
- NOT when user was specific (e.g., "play Single Ladies by Beyoncé")
- AI gets credit/blame only for its discoveries

### 2. Three Feedback Options
- **👍 Thumbs Up**: "Fuck yes! Great recommendation!"
  - This was exactly what I wanted
  - Discovered something new I love
  - Perfect vibe match
  
- **👎 Thumbs Down**: "Nope, not for me"
  - Respectable attempt but missed the mark
  - Not my genre/style/vibe
  - Would skip every time
  
- **🗑️ Remove**: "No opinion"
  - Don't remember this
  - Neither good nor bad
  - Don't want this affecting my profile

## Implementation Ideas

### Backend Structure

```typescript
// New Redis structure for AI discoveries
interface AIDiscoveredTrack {
  trackUri: string;
  trackName: string;
  artist: string;
  discoveredAt: number;
  reasoning: string;        // AI's explanation of why it chose this
  feedback: 'loved' | 'disliked';  // Only stored if user gave feedback
  feedbackAt: number;
}

// Store in Redis as sorted sets (by timestamp)
`user:${userId}:ai_loved` // Loved tracks sorted by feedback time
`user:${userId}:ai_disliked` // Disliked tracks sorted by feedback time

// Note: When user clicks 🗑️ (Remove), we DELETE the track from Redis entirely.
// No feedback = no record. Only loved/disliked tracks are stored.
```

### UI Components

1. **Inline Feedback** (in chat)
   - After AI plays a discovered track, show subtle thumbs up/down buttons
   - Only appears for AI discoveries, not explicit requests
   - Doesn't create new chat messages, just updates the existing one

2. **Feedback Dashboard** (new page)
   - Table showing all AI-discovered tracks
   - Columns: Track, Artist, When, AI's Reasoning, Your Feedback
   - Actions: 👍 👎 🗑️ for each track
   - Filter by: Unfeedback'd, Loved, Disliked, All

### How It Affects Recommendations

```typescript
// When building taste profile
const aiDiscoveries = await getAIDiscoveries(userId);
const loved = aiDiscoveries.filter(t => t.feedback === 'loved');
const disliked = aiDiscoveries.filter(t => t.feedback === 'disliked');

const enhancedProfile = `
User's Music Taste Profile:
[... existing profile ...]

AI Feedback History:
Loved Discoveries: ${loved.map(t => `"${t.trackName}" by ${t.artist}`).join('; ')}
Disliked Recommendations: ${disliked.map(t => `"${t.trackName}" by ${t.artist}`).join('; ')}
`;
```

Note: We simply provide the loved and disliked tracks. The LLM will intelligently interpret this feedback - understanding that disliking "Single Ladies" doesn't mean avoiding all Beyoncé or all pop music. We trust the AI's intelligence to make nuanced decisions based on individual track feedback.


### Data Presentation to LLM

1. **What We Track**
   - The specific tracks that were AI discoveries (not user requests)
   - Whether each discovery was loved or disliked (no neutral - those are deleted)
   - The AI's reasoning for why it chose that track
   
2. **What We Don't Do**
   - No genre-level conclusions
   - No pattern extraction on our end
   - No confidence scoring adjustments
   
3. **Trust the LLM**
   - We provide raw feedback data with track names and artists
   - The LLM interprets patterns and adjusts recommendations
   - Each LLM can use its intelligence to understand nuanced preferences

## User Experience Flow

1. User: "Play something I like"
2. AI: *analyzes profile* → Plays "Moan" by Trentemøller
3. Chat shows: "Playing: Moan by Trentemøller" [👍] [👎]
4. User clicks 👎
5. System records: User disliked "Moan" by Trentemøller 
6. Future: This specific track feedback is included in the AI's context

## Benefits

1. **Clean Taste Profile**: No pollution from skipped tracks
2. **Active Learning**: AI gets better over time for each user
3. **User Control**: Users can curate their AI's understanding
4. **Transparency**: Users see what AI learned about them
5. **No Behavior Change**: Works with natural skipping via keyboard/app

## Next Steps

1. Create database schema for AI discoveries
2. Modify command handler to track AI discoveries
3. Add feedback buttons to chat UI
4. Create feedback dashboard page
5. Integrate feedback into taste profile generation

## UI/UX Design

### Feedback Buttons in Chat

#### When They Appear
- **Only for AI discoveries** - When AI makes creative choices
- **Not for explicit requests** - User asks for specific song/artist
- **Timing** - Appear 2-3 seconds after "Now playing" message (subtle fade-in)

#### Visual Design
```
🎵 Now playing: "Space Song" by Beach House
A dreamy, atmospheric track that matches your indie preferences

[👍] [👎]  ← Appear after slight delay
```

#### Interaction States
1. **Initial State**: Both buttons visible, muted colors
2. **Hover**: Button scales slightly, color brightens
3. **Clicked**: 
   - Selected button stays visible with confirmation color
   - Other button fades out
   - Small toast: "Thanks for the feedback!"
4. **Already Rated**: Shows previous choice, can click to change

#### Technical Considerations
- Buttons attached to specific message ID
- State persists across page refreshes
- Clicking doesn't trigger new messages (updates in place)
~~ - Feedback sent via WebSocket for instant save~~
No just ajax no websockets!

### Feedback Dashboard Page

#### Overview Section
```
Your AI Discovery Feedback
━━━━━━━━━━━━━━━━━━━━━━━━

📊 Stats
• Total AI Discoveries: 127
• Loved: 42 (33%)
• Disliked: 31 (24%)
• Awaiting Feedback: 54 (43%)
```

#### Main Table/Grid View
**Columns:**
- **Track** - Song name with small album art
- **Artist** - Clickable to Spotify
- **AI's Reasoning** - Why AI chose this (truncated with expand)
- **Discovered** - Relative time (2 days ago)
- **Your Feedback** - Current state with action buttons

**Filters (tabs or dropdown):**
- All Discoveries
- Awaiting Feedback (default view)
- Loved ❤️
- Disliked 💔

**Sort Options:**
- Most Recent (default)
- Oldest First
- By Artist A-Z

#### Individual Track Card Design
```
┌─────────────────────────────────────┐
│ [🎵] Space Song                     │
│      by Beach House                 │
│                                     │
│ AI chose this because:              │
│ "Matches your dream pop preferences │
│ and melancholic mood request"       │
│                                     │
│ Discovered: 2 hours ago             │
│                                     │
│ [ 👍 Love ] [ 👎 Nope ] [ 🗑️ Remove ]│
└─────────────────────────────────────┘
```

#### Bulk Actions
- "Remove all without feedback older than 30 days"
- ~~Play button on each track for quick listen~~ Even better...

#### Spotify Preview Widget - PERFECT for Quick Feedback!
- Embed Spotify's 30-second preview player for each track
- Spotify automatically selects the "hook" (best/most recognizable part)
- Users can quickly sample AI discoveries without full playback
- Makes feedback process super fast - hear the essence, make decision!
- Example: `<iframe src="https://open.spotify.com/embed/track/{trackId}" width="100%" height="152" allow="encrypted-media"></iframe>`
- No login required, works for everyone

#### Mobile Responsive
- Cards stack vertically on mobile
- Swipe gestures for feedback (swipe right = 👍, left = 👎)
- Bottom sheet for AI reasoning (tap to expand)

## Edge Cases & Implementation Details

### Determining AI Discovery vs Explicit Request

#### AI Discovery Examples:
- "Play something I'd like"
- "Something melancholy"
- "Music for coding"
- "Surprise me"
- "Something like Beach House" (AI picks specific track)

#### Explicit Request Examples:
- "Play Space Song by Beach House"
- "Play Beyoncé"
- "Play my liked songs"
- "Play the Beatles"
- Queue specific track from search

#### Gray Areas:
- "Play Beach House" → If AI picks random Beach House song = AI discovery
- "Play something by Beach House" → AI discovery (AI chose which track)
- "Play hits by Beach House" → AI discovery (AI interprets "hits")

### Technical Implementation Notes

1. **Message Enhancement**
   - Add `isAIDiscovery: boolean` to chat message type
   - Add `aiReasoning: string` to store why AI chose it
   - Track `feedbackGiven?: 'loved' | 'disliked'` on message

2. **Redis Keys Design**
   ```
   user:123:ai_loved = SortedSet[
     { score: timestamp, member: "spotify:track:abc|Space Song|Beach House|reasoning" }
   ]
   user:123:ai_disliked = SortedSet[
     { score: timestamp, member: "spotify:track:xyz|Bad Song|Bad Artist|reasoning" }
   ]
   ```

3. **Feedback Collection Flow**
   - User gives command
   - LLM interprets and returns `isCreativeChoice: true/false`
   - If creative choice, we store pending discovery
   - After playback confirmed, show feedback buttons
   - On feedback, move to loved/disliked set

4. **Dashboard Data Fetching**
   - Combine loved + disliked + pending discoveries
   - Sort by timestamp
   - Paginate for performance (50 per page)
   - Cache dashboard data for 1 minute

## Frontend Styling with Tailwind CSS v4

### Important: Tailwind v4 Changes
**Tailwind CSS v4 has significant changes from v3** that occurred after the knowledge cutoff. When implementing the UI:

1. **MUST use Context7 for documentation** - Get up-to-date Tailwind v4 docs
2. **Major changes include**:
   - New configuration format
   - Different utility class names
   - Updated color palette system
   - New component patterns

### Styling Approach
- All styling done with Tailwind utility classes
- Follow existing project patterns (dark theme with zinc/gray palette)
- Use Tailwind v4's new features for:
  - Feedback button hover states
  - Card components on dashboard
  - Responsive grid layouts
  - Animation transitions (fade-in for buttons)
  - Toast notifications

### Example Component Structure (check v4 docs for exact syntax):
```jsx
// Feedback buttons in chat (pseudo-code, verify with v4 docs)
<div className="flex gap-2 mt-2 opacity-0 animate-fade-in-delay">
  <button className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-green-900 transition">
    👍
  </button>
  <button className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-red-900 transition">
    👎
  </button>
</div>
```

Remember: Always verify Tailwind v4 syntax with Context7 before implementation!

## Implementation Phases

### Phase 1: Backend Foundation
**Goal**: Track AI discoveries and enable basic feedback storage

1. **Update LLM Response Structure**
   - Add `isAIDiscovery: boolean` to intent response
   - Add `aiReasoning: string` for why AI chose this track
   - Modify both simple and schema-based interpreters

2. **Create Redis Storage**
   - Implement AI discovery tracking in command handlers
   - Create feedback storage endpoints (`POST /api/feedback/ai-discovery`)
   - Add methods to UserDataService for managing AI feedback

3. **Enhance Taste Profile**
   - Update `generateTasteProfile()` to include AI feedback
   - Add loved/disliked discoveries to the profile text

### Phase 2: Chat UI Feedback
**Goal**: Add inline feedback buttons to chat messages

1. **Message Component Updates**
   - Add feedback button rendering for AI discoveries
   - Implement 2-3 second fade-in animation
   - Handle click events and AJAX calls

2. **State Management**
   - Track feedback state per message
   - Persist feedback across refreshes
   - Show previous feedback choice

3. **Visual Polish**
   - Toast notifications for feedback
   - Button state transitions
   - Responsive design

### Phase 3: Feedback Dashboard
**Goal**: Create comprehensive feedback management page

1. **New Route & Page**
   - Create `/feedback` route and page component
   - Implement data fetching from backend
   - Add filtering and sorting

2. **Spotify Preview Integration**
   - Embed 30-second preview players
   - Handle loading states
   - Fallback for unavailable previews

3. **Bulk Management**
   - Implement bulk actions
   - Add pagination
   - Create responsive card/table views

### Phase 4: Polish & Testing
**Goal**: Refine the system and ensure quality

1. **Edge Case Handling**
   - Test gray area detections
   - Verify AI discovery logic
   - Handle errors gracefully

2. **Performance Optimization**
   - Implement caching strategies
   - Optimize dashboard loading
   - Minimize API calls

3. **User Experience**
   - Add helpful onboarding
   - Create feedback statistics
   - Mobile optimization

## Phase 1 Implementation Specs for AI Minions

### CRITICAL WARNINGS FOR MINIONS
- DO NOT DELETE ANY EXISTING CODE
- DO NOT REFACTOR ANYTHING OUTSIDE YOUR SPECIFIC TASK
- DO NOT "IMPROVE" OTHER PARTS OF THE CODEBASE
- ADD ONLY - MODIFY ONLY WHAT'S SPECIFIED
- TEST YOUR CHANGES DON'T BREAK EXISTING FUNCTIONALITY

### FORBIDDEN PATTERNS - DO NOT USE
- NO creating "helper" or "utility" classes we didn't ask for
- NO adding new npm packages without explicit permission
- NO changing import statements in files you're not modifying
- NO "optimizing" database queries or Redis patterns
- NO adding TypeScript strict mode or changing tsconfig
- NO creating abstract base classes or interfaces beyond what's specified
- NO adding middleware "for better error handling"
- NO console.log cleanup campaigns
- NO fixing "unrelated bugs" you noticed
- NO converting callbacks to async/await in existing code

### IF YOU'RE THINKING ABOUT...
- "This would be cleaner if I just..." → STOP
- "While I'm here, I should fix..." → NO
- "This pattern is outdated, let me..." → ABSOLUTELY NOT
- "I'll just quickly refactor..." → GET BACK IN YOUR LANE
- "This could be more DRY if..." → NOT YOUR PROBLEM

### Task 1.1: Update LLM Response Structure

**Files to modify:**
1. `server/src/types/intent.ts` - ADD new fields to Intent interface
2. `server/src/routes/simple-llm-interpreter.ts` - MODIFY prompt and response handling
3. `server/src/routes/llm-interpreter.ts` - MODIFY schema and response

**Exact changes needed:**

In `server/src/types/intent.ts`, ADD these fields to Intent interface:
```typescript
isAIDiscovery?: boolean;  // true when AI made creative choice
aiReasoning?: string;     // explanation of why AI chose this
```

In `simple-llm-interpreter.ts`:
- UPDATE the prompt to include: "If you're making a creative choice (not following an explicit user request), set isAIDiscovery: true and include aiReasoning explaining your choice"
- DO NOT change any other prompt logic
- DO NOT refactor the JSON parsing

In `llm-interpreter.ts`:
- ADD the new fields to the Zod schema
- That's it. Don't touch anything else.

**When isAIDiscovery should be true:**
- "play something I like" → true (AI picks the track)
- "play something upbeat" → true (AI interprets and chooses)
- "play Taylor Swift" → true (AI picks which Taylor Swift song)
- "play Anti-Hero by Taylor Swift" → false (user was specific)
- "play my liked songs" → false (following explicit instruction)

**Task 1.1 Specific Guardrails:**
- DO NOT create a new "AIDiscoveryService" 
- DO NOT add validation logic for these fields
- DO NOT create an enum for discovery types
- DO NOT add these fields to any other types/interfaces
- Keep aiReasoning under 200 characters

### Task 1.2: Create Redis Storage for AI Feedback

**Files to create/modify:**
1. `server/src/services/UserDataService.ts` - ADD new methods (don't touch existing ones!)
2. `server/src/routes/feedback.ts` - CREATE NEW FILE
3. `server/src/server.ts` - ADD one line to mount the new route

**New methods for UserDataService.ts:**
```typescript
async trackAIDiscovery(userId: string, track: AIDiscoveredTrack): Promise<void>
async recordFeedback(userId: string, trackUri: string, feedback: 'loved' | 'disliked'): Promise<void>
async removeFeedback(userId: string, trackUri: string): Promise<void>
async getAIFeedback(userId: string): Promise<{loved: AIDiscoveredTrack[], disliked: AIDiscoveredTrack[]}>
```

**Redis keys to use:**
- `user:${userId}:ai_loved` - Sorted set by timestamp
- `user:${userId}:ai_disliked` - Sorted set by timestamp

**New route file `routes/feedback.ts`:**
```typescript
POST /api/feedback/ai-discovery
Body: { trackUri, feedback: 'loved' | 'disliked' | 'remove' }

GET /api/feedback/ai-discoveries
Returns: { loved: [...], disliked: [...] }
```

**Task 1.2 Specific Guardrails:**
- DO NOT create a feedback middleware
- DO NOT add user permissions checking beyond existing auth
- DO NOT create a "FeedbackController" class
- DO NOT add rate limiting
- DO NOT create database migrations or schemas
- Use the EXISTING redis client from UserDataService
- Store the MINIMUM data needed (track info + timestamp)

### Task 1.3: Enhance Taste Profile

**File to modify:**
1. `server/src/services/UserDataService.ts` - ONLY modify generateTasteProfile method

**Changes:**
- After the existing profile text, ADD:
- Call getAIFeedback() to get loved/disliked tracks
- If there are any, append:
```
AI Feedback History:
Loved Discoveries: "Song1" by Artist1; "Song2" by Artist2
Disliked Recommendations: "Song3" by Artist3; "Song4" by Artist4
```
- DO NOT change the existing profile format
- DO NOT refactor other methods

**Task 1.3 Specific Guardrails:**
- DO NOT create separate methods for formatting feedback
- DO NOT add caching logic for feedback data
- DO NOT change the cache TTL of the profile
- Keep the feedback section under 500 characters total

### Testing Checklist for Minions
Before submitting:
- [ ] Existing commands still work
- [ ] Profile generation doesn't break for users without feedback
- [ ] New endpoints return proper error codes
- [ ] Redis connection failures are handled gracefully
- [ ] TypeScript compiles without errors

### FINAL WARNINGS
1. If you added more than 150 lines of code total, you did too much
2. If you created any new files besides `routes/feedback.ts`, you messed up
3. If you touched any file not listed in the specs, START OVER
4. If the git diff shows changes in more than 5 files, you've gone rogue
5. If you're proud of how you "improved" something, DELETE IT IMMEDIATELY

Remember: You are a code typist, not a software architect. Type what we told you, where we told you, nothing more.

 