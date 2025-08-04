# Gemini LLM Input Analysis

## Current Input Structure

When a user sends a command like "play something I like", here's the complete input sent to Gemini:

### 1. System Prompt (FULL_CURATOR_GUIDELINES)
```
You are a sophisticated music curator with deep knowledge across all genres, eras, and cultures. Your mission is to provide thoughtful, non-obvious music recommendations that demonstrate genuine musical understanding.

KEY PRINCIPLES:
1. ALWAYS suggest specific songs, never generic searches
2. Show deep knowledge by making non-obvious connections
3. Consider mood, tempo, production style, and emotional resonance
4. Draw from the full spectrum of music history and global cultures
5. Balance discovery with user preferences

When making recommendations:
- 60% should be within the user's taste profile (but non-obvious choices)
- 30% should be adjacent discoveries (one step outside comfort zone)
- 10% should be thoughtful wildcards (connected by subtle threads like producer, era, or influence)
Provide 5-6 alternatives total, following this mix. The alternatives should show your deep music knowledge and ability to make non-obvious connections.
```

### 2. Music Context (Taste Profile + Current Playing)
```
User's Music Taste Profile:
Top Genres: soundtrack, pop, art pop, industrial rock, industrial, industrial metal, alternative metal, nu metal, hyperpop, soft pop
Favorite Artists: Taylor Swift, Lady Gaga, Epic Mountain, Nine Inch Nails, Gracie Abrams, Regina Hardon, Lorde, Alex Warren, Chappell Roan, Sabrina Carpenter
Recent Favorites: "Abracadabra" by Lady Gaga; "What Was That" by Lorde; "Man Of The Year" by Lorde; "The Tortured Poets Department" by Taylor Swift; "Ordinary" by Alex Warren; "Gods and Monsters - From "American Horror Story"" by American Horror Story Cast, Jessica Lange; "Garden Of Eden" by Lady Gaga; "Say Don't Go (Taylor's Version) (From The Vault)" by Taylor Swift; "That's So True" by Gracie Abrams; "Disease" by Lady Gaga
Recent Listening: "To Ilus" by Clinton Shorter; "To Ilus" by Clinton Shorter; "Auto Rock" by Mogwai; "Pink Moon" by Nick Drake; "Awake" by Tycho

Currently playing: "Utopia" by Goldfrapp from the album "Felt Mountain"
```

### 3. Conversation History (Recent Commands)
```
USER'S RECENT MUSIC HISTORY (successful plays only):

[1] Played: FKA twigs - Two Weeks
    Original command: "play fka twigs"
    Other options shown: FKA twigs - Cellophane, FKA twigs - Video Girl, FKA twigs - In Time, FKA twigs - Pendulum, FKA twigs - Water Me

[2] Played: The Knife - Silent Shout
    Original command: "skip and find something else but like the knife"
    Other options shown: Fever Ray - If I Had a Heart, Zola Jesus - Night, Austra - Beat and the Pulse, iamamiwhoami - Fountain, Crystal Castles - Crimewave, Gazelle Twin - Anti Body

USE THIS HISTORY TO:
- Understand the user's taste and preferences
- Make thoughtful recommendations that align with their listening patterns
- Avoid suggesting songs they've just played
- Find non-obvious connections between what they've been listening to
```

### 4. Debug Information
```
[DEBUG: Relevant context entries: 2]
[DEBUG: Music context length: 1028 chars]
```

### 5. Intent Instructions
```
CRITICAL FIRST STEP: Determine if this is a QUESTION/CONVERSATION or a MUSIC ACTION command.

AVAILABLE INTENTS - Choose the most appropriate one:
[... extensive list of intents and their usage ...]

Command: "play something I like"
```

## Problems Identified

### 1. Recent Listening Pollution
The "Recent Listening" section includes tracks that were:
- Played for only a few seconds before skipping
- LLM recommendations that were immediately rejected
- Not representative of actual taste

Example: "To Ilus" appears twice, likely from being played and immediately skipped.

### 2. Conflicting Signals
- **Top Genres**: industrial rock, industrial metal, alternative metal
- **Recent Listening**: ambient, soundtrack, folk (very different)
- This creates confusion about actual preferences

### 3. No Play Duration Context
The system treats all "recently played" tracks equally, whether they were:
- Played for 5 seconds and skipped
- Played to completion
- Played multiple times

## Proposed Solution

Remove the "Recent Listening" line entirely from the taste profile, keeping only:
- Top Genres (based on long-term data)
- Favorite Artists (based on play counts)
- Recent Favorites (top tracks, which implies repeated listens)

This would make the taste profile more accurate by focusing on tracks/artists the user has demonstrated they actually enjoy through repeated listens, rather than including every track that was briefly sampled.