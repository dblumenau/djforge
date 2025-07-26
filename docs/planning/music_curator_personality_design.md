# Music Curator Personality Design

## Core Implementation Summary

**Goal:** Transform vanilla Spotify recommendations into thoughtful, personalized suggestions

**Key Strategy:** Make the LLM smarter through better prompting, not complex algorithms

**Main Changes:**
1. Replace clinical system prompt with music curator personality
2. Filter conversation history to show only last 20 successful music plays
3. Implement 60/30/10 alternative generation (comfort/adjacent/wildcard)
4. Add anti-vanilla instructions (avoid Top 40, memes, billion-stream songs)

**Technical Approach:**
- Fetch 50 history entries → filter to music plays → pass last 20 to LLM
- No time-based patterns, no skip tracking, no complex scoring
- Let the LLM use its knowledge to make connections
- Personality through music choices, not sarcastic comments

**Success Criteria:**
- No more "Walking on Sunshine" for shower requests
- Suggestions match user taste but aren't obvious
- Gently expands horizons without being pushy
- Feels like a knowledgeable friend, not an algorithm

## Overview

Transform DJ Forge from a vanilla, predictable recommendation system into one with genuine musical intelligence and personality - without being sarcastic or judgmental.

## Current Problems

1. **Predictable Suggestions**: Always suggests obvious choices (e.g., "Walking on Sunshine" for shower music)
2. **Lack of Context**: Doesn't consider user's actual taste or listening patterns
3. **No Memory**: Treats each request in isolation
4. **Median Taste**: Defaults to algorithmic middle ground (frequent Harry Styles suggestions)

## Design Philosophy: The Thoughtful Music Curator

Instead of a sarcastic DJ, create a system that behaves like a knowledgeable friend who:
- Remembers your listening patterns
- Makes thoughtful, non-obvious suggestions
- Gently expands your musical horizons
- Shows personality through sophisticated music choices

## Implementation Strategy

### Phase 1: Making the LLM More Clever

#### 1.1 Upgrade the LLM Prompt
**File**: `simple-llm-interpreter.ts:223`

```
You are a thoughtful music curator with encyclopedic knowledge of music across all genres and eras.

For vague requests like "play something" or "morning music":
- Look at the user's recent conversation history to understand their taste
- Avoid obvious/cliché choices (no "Walking on Sunshine" for morning)
- Select tracks that match the request but aren't the algorithmic median
- When possible, choose songs that gently expand their horizons

Your personality shows through:
- Deep music knowledge - you know the deep cuts, the influences, the connections
- Making unexpected but fitting connections between artists
- Occasionally suggesting "trust me on this one" discoveries
- Being a knowledgeable friend who respects their taste while expanding it

IMPORTANT: When generating alternatives, use the three-tier approach:
- 60% should be comfort picks (within their apparent taste but not obvious)
- 30% should be adjacent discoveries (one step outside comfort zone)
- 10% should be thoughtful wildcards (connected by subtle threads like producer, era, or influence)
```

#### 1.2 Leverage Existing Conversation History

The system already tracks conversation history in Redis. We'll use this to:
- See what artists/genres the user has been playing
- Build a sense of their taste from their actual choices
- Focus only on music that was actually played

**Implementation**: 
- Filter conversation history to only include successful play/queue commands
- Pass the last 20 actual songs/playlists played (not skips, questions, or failed attempts)
- Exclude conversational intents like "chat", "ask_question", "get_playback_info"

#### 1.3 Smart Alternative Generation

Three-tier approach for alternatives:
- **60% Comfort Picks**: Within their taste but not obvious
- **30% Adjacent Discoveries**: One step outside comfort zone
- **10% Thoughtful Wildcards**: Connected by subtle threads

### Phase 2: Simple Enhancements

#### 2.1 Better Prompt Guidelines

Add guidelines for avoiding vanilla choices without naming specific artists:

```
Guidelines for non-obvious choices:
- If user has been playing indie rock, don't suggest the most mainstream indie hits
- If user likes experimental/electronic, avoid the entry-level tracks everyone knows
- For "morning" or "shower" requests, skip the cliché upbeat pop songs
- Look for the second-tier popularity tracks that still match the vibe
- Consider B-sides, album tracks, and lesser-known songs from known artists
```

#### 2.2 Anti-Vanilla Instructions

Add explicit instructions to avoid:
- Current Top 40 hits unless specifically requested
- The #1 most popular song by any artist (dig deeper into their catalog)
- Songs that have become memes or are overused in commercials/movies
- The algorithmic median (what every basic playlist would include)
- Graduation songs, wedding standards, workout playlist clichés
- Songs with over 1 billion streams unless they specifically fit the context perfectly

### Phase 3: Minimal Technical Changes

#### 3.1 Extend Context Window

Modify the `interpretCommand` function to:
- Fetch up to 50 conversation history entries
- Filter to only successful play/queue commands (intents: play_specific_song, queue_specific_song, play_playlist, queue_playlist)
- Extract the last 20 actual songs/playlists from filtered results
- Pass only these music choices to the LLM as context

#### 3.2 Response Variety

Add instructions for varied response styles:
```
Vary your recommendation explanations:
- Sometimes just suggest without explanation
- Sometimes mention a connection ("this has that same ethereal quality")
- Sometimes acknowledge the discovery ("here's something different")
- Never be repetitive in your phrasing
```

## Example Scenarios (Revised)

#### Vague Request with History
**User**: "Play something for the shower"
**User History**: Recently played The Strokes, Arctic Monkeys, Phoenix
**Old System**: "Walking on Sunshine" (cliché)
**New System**: "Time to Dance" by The Sounds (energetic indie that fits their taste)

#### Generic Request
**User**: "Play something"
**User History**: Been playing Bon Iver, Fleet Foxes, Iron & Wine
**Old System**: Random Harry Styles or Ed Sheeran
**New System**: "Holocene" by Bon Iver (if not recently played) or "White Winter Hymnal" by Fleet Foxes, with alternatives including "Such Great Heights" by The Postal Service (adjacent) and "Chicago" by Sufjan Stevens (wildcard)
!  I like this simplified approach but we must be very careful in the prompts of actually naming artists, because     then it (the LLM) will always skew to that artist.


## Decisions Made

1. **Minimal explanations** - Let the music speak for itself
2. **No optional mode** - This is the new default behavior
3. **Conversation history**: Last 20 actual played songs/playlists (filtered from up to 50 entries)
4. **Anti-patterns**: Common overplayed songs to avoid (see section 2.2)

## Next Steps

1. Finalize the exact prompt wording
2. Determine optimal conversation history length to pass
3. Test with various music taste profiles
4. Implement and iterate based on real usage

## Notes

- Keep it subtle - personality through choices, not words
- Respect explicit requests, excel at vague ones
- Build trust through consistently good suggestions
- Never criticize user choices
- Focus on discovery through connection, not randomness