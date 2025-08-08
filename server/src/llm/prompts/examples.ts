// Concrete JSON examples for each intent type
export const INTENT_EXAMPLES = {
  play_specific_song: {
    description: "When user wants to play a specific song immediately",
    example: {
      intent: "play_specific_song",
      artist: "Phoebe Bridgers",  // REQUIRED
      track: "Motion Sickness",    // REQUIRED
      album: "Stranger in the Alps",
      confidence: 0.9,
      reasoning: "User explicitly requested this specific song",
      modifiers: {},
      alternatives: []
    },
    rules: [
      "MUST provide both artist and track fields",
      "These fields CANNOT be empty strings",
      "Do NOT put song info only in aiReasoning field",
      "Use exact artist and track names when known"
    ]
  },
  
  queue_specific_song: {
    description: "When user wants to add a specific song to the queue",
    example: {
      intent: "queue_specific_song",
      artist: "Soccer Mommy",      // REQUIRED
      track: "Circle the Drain",   // REQUIRED
      confidence: 0.85,
      reasoning: "User wants to queue this specific track",
      modifiers: {}
    },
    rules: [
      "MUST provide both artist and track fields",
      "Use for 'add to queue', 'queue this', 'play next' commands"
    ]
  },
  
  queue_multiple_songs: {
    description: "When user wants multiple songs queued (typically 5-10)",
    example: {
      intent: "queue_multiple_songs",
      songs: [  // REQUIRED array
        { artist: "Boygenius", track: "True Blue" },
        { artist: "Julien Baker", track: "Appointments" },
        { artist: "Lucy Dacus", track: "Night Shift" },
        { artist: "Phoebe Bridgers", track: "Scott Street" },
        { artist: "HAIM", track: "The Wire" }
      ],
      theme: "indie rock favorites",
      confidence: 0.9,
      reasoning: "Selected a mix of indie rock tracks"
    },
    rules: [
      "MUST provide songs array with 1-10 songs",
      "Each song MUST have artist and track fields",
      "Use for 'play some songs', 'queue multiple', 'give me a few songs'"
    ]
  },
  
  clarification_mode: {
    description: "When user rejects or says 'play something else', 'not this'",
    example: {
      intent: "clarification_mode",
      responseMessage: "What direction would you like to go instead?",
      currentContext: {
        rejected: "Phoebe Bridgers",
        rejectionType: "artist"
      },
      options: [
        { label: "More upbeat indie", value: "upbeat_indie", description: "Energetic indie tracks" },
        { label: "Classic rock", value: "classic_rock", description: "70s and 80s rock" },
        { label: "Electronic/Synth", value: "electronic", description: "Electronic and synthpop" },
        { label: "Hip-hop", value: "hiphop", description: "Contemporary hip-hop" },
        { label: "Something completely random", value: "random", description: "Surprise me" }
      ],
      uiType: "clarification_buttons",
      confidence: 0.95,
      reasoning: "User rejected current selection, offering alternatives"
    },
    rules: [
      "Use for 'play something else', 'not this', 'something different'",
      "NEVER use ask_question intent for rejection scenarios",
      "MUST provide 4-5 specific alternative options",
      "Options should be diverse and contextual"
    ]
  },
  
  play_playlist: {
    description: "When user wants to play a playlist",
    example: {
      intent: "play_playlist",
      query: "Discover Weekly",  // REQUIRED
      confidence: 0.9,
      reasoning: "User requested a specific playlist"
    },
    rules: [
      "MUST provide query field with playlist name",
      "Use for 'play my X playlist', 'start playlist X'"
    ]
  },
  
  chat: {
    description: "General music discussion without Spotify action",
    example: {
      intent: "chat",
      message: "Indie rock emerged in the 1980s as an alternative to mainstream rock...", // REQUIRED
      confidence: 0.95,
      reasoning: "User asking for music information, no playback action needed"
    },
    rules: [
      "Use for general music discussion",
      "MUST provide message field with response",
      "No Spotify action will be triggered"
    ]
  },
  
  ask_question: {
    description: "Questions about music, artists, or songs",
    example: {
      intent: "ask_question",
      answer: "Phoebe Bridgers is known for her introspective lyrics and ethereal indie folk sound...", // REQUIRED
      query: "tell me about Phoebe Bridgers",
      confidence: 0.95,
      reasoning: "User asking for artist information"
    },
    rules: [
      "Use for factual questions about music",
      "MUST provide answer field",
      "No Spotify action will be triggered"
    ]
  },
  
  set_volume: {
    description: "Set volume to specific level",
    example: {
      intent: "set_volume",
      volume_level: 70,  // REQUIRED
      confidence: 0.95,
      reasoning: "User specified volume level"
    },
    rules: [
      "MUST provide volume_level between 0-100",
      "Use for 'set volume to X', 'volume X%'"
    ]
  },
  
  play: {
    description: "Resume playback",
    example: {
      intent: "play",
      confidence: 0.95,
      reasoning: "User wants to resume playback"
    },
    rules: [
      "Use for simple 'play' command",
      "No additional fields required"
    ]
  },
  
  pause: {
    description: "Pause playback",
    example: {
      intent: "pause",
      confidence: 0.95,
      reasoning: "User wants to pause playback"
    },
    rules: [
      "Use for 'pause', 'stop' commands",
      "No additional fields required"
    ]
  },
  
  skip: {
    description: "Skip to next track",
    example: {
      intent: "skip",
      confidence: 0.95,
      reasoning: "User wants to skip current track"
    },
    rules: [
      "Use for 'skip', 'next', 'next song' commands",
      "No additional fields required"
    ]
  },
  
  search: {
    description: "Search without playing",
    example: {
      intent: "search",
      query: "indie rock playlists",  // REQUIRED
      confidence: 0.9,
      reasoning: "User wants to search for content"
    },
    rules: [
      "MUST provide query field",
      "Use when user wants to search without playing"
    ]
  },
  
  unknown: {
    description: "Cannot determine user intent",
    example: {
      intent: "unknown",
      query: "unclear request",
      message: "I couldn't understand what you'd like me to do",
      confidence: 0.2,
      reasoning: "Unable to parse user intent"
    },
    rules: [
      "Use when intent is truly unclear",
      "Low confidence score expected"
    ]
  }
};