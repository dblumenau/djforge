- [ ] Log the full entire back and forth of the model.
- [ ] If a song wasn't found and then it falls back another song, still allow the user to rate the fallback song.
- [ ] Ability to rate also the alternatives
- [ ] When the user asks a question about why the model did something, we should include the full model reasoning and also the final answer instead of just the currently playing track so that the model can fully explain itself.

## Expanded Ideas

Discussion from Claude Code about why we are stuck with Lorde and Lana all the time:
```
Looking at your Gemini prompt, I can see why it's getting stuck in a loop with the same artists. The issue is that you're providing the user's favorite artists so
  prominently that the AI is treating them as the primary recommendation pool rather than as context for understanding taste.

  Here are the key problems:

  1. Over-emphasis on familiar artists: The prompt lists specific artists (Taylor Swift, Lady Gaga, Lorde, Gracie Abrams, etc.) as "Familiar artists" which makes the AI
  think these are the go-to choices.
  2. Contradictory instructions: You tell it to "avoid their exact favorites unless they fit perfectly" but also emphasize understanding their taste through these same
  artists.
  3. The example reinforces the problem: When the user says "i dislike lana", the AI immediately picks Lorde (from the familiar list) and fills alternatives with other
  familiar artists.

  Here's how I'd restructure the taste profile section:

  BACKGROUND - User's Musical Discovery Context:
  • Genre preferences: soundtrack, pop, art pop, industrial rock, hyperpop
  • Musical characteristics they enjoy: atmospheric production, emotional vulnerability, genre-blending, strong melodic hooks
  • Discovery sweet spots: Artists who bridge mainstream and alternative, emotional depth with pop sensibility

  IMPORTANT: Use this taste understanding to find NEW artists and songs that share similar qualities, NOT to repeatedly recommend the same familiar artists.

  When user says "something else" or shows dislike, actively avoid:
  - Artists they've been listening to recently
  - Direct genre/style matches to what's currently playing
  - Other songs by artists in their heavy rotation

  This reframing uses their taste as a compass for discovery rather than a playlist to pick from.

✻ Thinking…

  The user asked me to evaluate the prompt, and I've identified the core issue. Since I'm in plan mode, I should present a comprehensive analysis and my suggested
  improvements. Let me continue with more specific recommendations.

⏺ Additionally, I'd suggest these specific changes:

  1. Remove the explicit artist lists from the main prompt and instead describe their taste in terms of qualities:
    - "Appreciates theatrical/cinematic pop production"
    - "Drawn to artists who blend vulnerability with strong production"
    - "Enjoys genre-crossing between pop, industrial, and alternative"
  2. Add a "freshness" directive:
  FRESHNESS RULE: If an artist appears in the user's recent favorites or
  was recommended in the last 5 interactions, actively seek alternatives
  unless specifically requested.
  3. Improve the "something else" handling:
  When user requests "something else" or expresses dislike:
  - Identify what aspect they're rejecting (artist, genre, mood, tempo)
  - Pivot to a different musical territory while respecting their overall taste
  - Don't just pick another artist from their favorites list
  4. Better alternative generation:
  Instead of listing Lady Gaga, Gracie Abrams, etc. as alternatives (which are all from their familiar list), the AI should think:
    - "User likes art pop but not Lana right now → try Weyes Blood, FKA twigs, or Kelsey Lu"
    - "User likes industrial but wants variety → try Health, Zeal & Ardor, or Chelsea Wolfe"

  The goal is to use their profile as a launching pad for discovery, not a cage that limits recommendations.
  ⎿  User rejected Claude's plan:
     ╭─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
     │ Based on my analysis of your Gemini prompt, here's my plan to fix the repetitive recommendation issue:                                                          │
     │                                                                                                                                                                 │
     │ 1. Restructure the taste profile section to emphasize musical qualities over specific artist names                                                              │
     │ 2. Add a "freshness" directive that explicitly tells the AI to avoid recently recommended artists                                                               │
     │ 3. Improve "something else" handling with clear pivoting instructions                                                                                           │
     │ 4. Reframe the discovery guidance to use taste as a compass, not a playlist                                                                                     │
     │                                                                                                                                                                 │
     │ This should help the AI break out of the Lana/Gracie/Lorde loop and provide more diverse recommendations while still respecting the user's musical preferences. │
     ╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```