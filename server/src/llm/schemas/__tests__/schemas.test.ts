import { z } from 'zod';
import { 
  MusicCommandSchema,
  PlaySpecificSongSchema,
  QueueMultipleSongsSchema,
  ClarificationModeSchema
} from '../index';

describe('Discriminated Union Schemas', () => {
  describe('MusicCommandSchema', () => {
    it('should parse valid play_specific_song', () => {
      const input = {
        intent: 'play_specific_song',
        artist: 'Phoebe Bridgers',
        track: 'Motion Sickness',
        confidence: 0.9,
        reasoning: 'User requested this song'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.intent).toBe('play_specific_song');
        expect('artist' in result.data).toBe(true);
        expect('track' in result.data).toBe(true);
      }
    });
    
    it('should parse valid queue_multiple_songs', () => {
      const input = {
        intent: 'queue_multiple_songs',
        songs: [
          { artist: 'Artist 1', track: 'Track 1' },
          { artist: 'Artist 2', track: 'Track 2' }
        ],
        confidence: 0.85,
        reasoning: 'Multiple songs'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.intent).toBe('queue_multiple_songs');
        expect('songs' in result.data).toBe(true);
      }
    });
    
    it('should parse valid clarification_mode', () => {
      const input = {
        intent: 'clarification_mode',
        responseMessage: 'What would you prefer?',
        currentContext: {
          rejected: 'Rock',
          rejectionType: 'genre'
        },
        options: [
          { label: 'Pop', value: 'pop' },
          { label: 'Jazz', value: 'jazz' },
          { label: 'Classical', value: 'classical' },
          { label: 'Electronic', value: 'electronic' }
        ],
        uiType: 'clarification_buttons',
        confidence: 0.95,
        reasoning: 'User rejected genre'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.intent).toBe('clarification_mode');
        expect('responseMessage' in result.data).toBe(true);
        expect('currentContext' in result.data).toBe(true);
        expect('options' in result.data).toBe(true);
      }
    });
    
    it('should parse valid control commands', () => {
      const controlCommands = [
        { intent: 'pause', confidence: 0.9, reasoning: 'User wants to pause' },
        { intent: 'resume', confidence: 0.9, reasoning: 'User wants to resume' },
        { intent: 'skip', confidence: 0.9, reasoning: 'User wants to skip' },
        { intent: 'next', confidence: 0.9, reasoning: 'User wants next track' },
        { intent: 'previous', confidence: 0.9, reasoning: 'User wants previous track' },
        { intent: 'back', confidence: 0.9, reasoning: 'User wants to go back' }
      ];

      controlCommands.forEach(command => {
        const result = MusicCommandSchema.safeParse(command);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.intent).toBe(command.intent);
        }
      });
    });

    it('should parse valid set_volume command', () => {
      const input = {
        intent: 'set_volume',
        volume_level: 75,
        confidence: 0.9,
        reasoning: 'User requested volume change'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.intent).toBe('set_volume');
        expect('volume_level' in result.data).toBe(true);
      }
    });

    it('should parse valid playlist commands', () => {
      const playlistCommands = [
        {
          intent: 'play_playlist',
          query: 'My Favorites',
          confidence: 0.8,
          reasoning: 'User wants to play playlist'
        },
        {
          intent: 'queue_playlist',
          query: 'Chill Music',
          confidence: 0.8,
          reasoning: 'User wants to queue playlist'
        }
      ];

      playlistCommands.forEach(command => {
        const result = MusicCommandSchema.safeParse(command);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.intent).toBe(command.intent);
          expect('query' in result.data).toBe(true);
        }
      });
    });

    it('should parse valid info commands', () => {
      const infoCommands = [
        { intent: 'get_current_track', confidence: 0.9, reasoning: 'User wants current track info' },
        { intent: 'get_devices', confidence: 0.9, reasoning: 'User wants device info' },
        { intent: 'get_playlists', confidence: 0.9, reasoning: 'User wants playlists' },
        { intent: 'get_recently_played', confidence: 0.9, reasoning: 'User wants recent tracks' },
        { intent: 'get_playback_info', confidence: 0.9, reasoning: 'User wants playback info' }
      ];

      infoCommands.forEach(command => {
        const result = MusicCommandSchema.safeParse(command);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.intent).toBe(command.intent);
        }
      });
    });

    it('should parse valid conversational commands', () => {
      const conversationalCommands = [
        { 
          intent: 'chat', 
          message: 'Hello there!',
          confidence: 0.9, 
          reasoning: 'User wants to chat' 
        },
        { 
          intent: 'ask_question', 
          answer: 'That is a great question!',
          confidence: 0.9, 
          reasoning: 'User has a question' 
        },
        { 
          intent: 'explain_reasoning', 
          explanation: 'Here is why I chose that...',
          confidence: 0.9, 
          reasoning: 'User wants explanation' 
        },
        { 
          intent: 'unknown', 
          confidence: 0.5, 
          reasoning: 'Could not determine intent' 
        }
      ];

      conversationalCommands.forEach(command => {
        const result = MusicCommandSchema.safeParse(command);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.intent).toBe(command.intent);
        }
      });
    });
    
    it('should reject invalid intent', () => {
      const input = {
        intent: 'invalid_intent',
        confidence: 0.8,
        reasoning: 'Test'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.code === 'invalid_union_discriminator'
        )).toBe(true);
      }
    });
    
    it('should reject play_specific_song without artist', () => {
      const input = {
        intent: 'play_specific_song',
        track: 'Motion Sickness',
        confidence: 0.9,
        reasoning: 'Test'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject play_specific_song with empty artist', () => {
      const input = {
        intent: 'play_specific_song',
        artist: '',
        track: 'Motion Sickness',
        confidence: 0.9,
        reasoning: 'Test'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject play_specific_song with empty track', () => {
      const input = {
        intent: 'play_specific_song',
        artist: 'Phoebe Bridgers',
        track: '',
        confidence: 0.9,
        reasoning: 'Test'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
    
    it('should reject queue_multiple_songs with too many songs', () => {
      const input = {
        intent: 'queue_multiple_songs',
        songs: Array(11).fill({ artist: 'Test', track: 'Test' }),
        confidence: 0.8,
        reasoning: 'Too many songs'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject queue_multiple_songs with empty songs array', () => {
      const input = {
        intent: 'queue_multiple_songs',
        songs: [],
        confidence: 0.8,
        reasoning: 'No songs provided'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject clarification_mode with insufficient options', () => {
      const input = {
        intent: 'clarification_mode',
        responseMessage: 'What would you prefer?',
        currentContext: {
          rejected: 'Rock',
          rejectionType: 'genre'
        },
        options: [
          { label: 'Pop', value: 'pop' },
          { label: 'Jazz', value: 'jazz' }
        ], // Only 2 options, needs 4-5
        uiType: 'clarification_buttons',
        confidence: 0.95,
        reasoning: 'User rejected genre'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject clarification_mode with too many options', () => {
      const input = {
        intent: 'clarification_mode',
        responseMessage: 'What would you prefer?',
        currentContext: {
          rejected: 'Rock',
          rejectionType: 'genre'
        },
        options: [
          { label: 'Pop', value: 'pop' },
          { label: 'Jazz', value: 'jazz' },
          { label: 'Classical', value: 'classical' },
          { label: 'Electronic', value: 'electronic' },
          { label: 'Rock', value: 'rock' },
          { label: 'Blues', value: 'blues' }
        ], // 6 options, max is 5
        uiType: 'clarification_buttons',
        confidence: 0.95,
        reasoning: 'User rejected genre'
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject set_volume with invalid volume levels', () => {
      const invalidVolumes = [-1, 101, 'not a number'];
      
      invalidVolumes.forEach(volume => {
        const input = {
          intent: 'set_volume',
          volume_level: volume,
          confidence: 0.9,
          reasoning: 'Test'
        };
        
        const result = MusicCommandSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    it('should reject commands with invalid confidence values', () => {
      const invalidConfidences = [-0.1, 1.1, 'not a number'];
      
      invalidConfidences.forEach(confidence => {
        const input = {
          intent: 'play',
          confidence,
          reasoning: 'Test'
        };
        
        const result = MusicCommandSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    it('should reject commands without reasoning', () => {
      const input = {
        intent: 'play',
        confidence: 0.9
      };
      
      const result = MusicCommandSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
  
  describe('Type inference', () => {
    it('should correctly infer types', () => {
      // This is a compile-time test
      type MusicCommand = z.infer<typeof MusicCommandSchema>;
      
      // These should compile without errors
      const playCommand: MusicCommand = {
        intent: 'play_specific_song',
        artist: 'Test',
        track: 'Test',
        confidence: 0.9,
        reasoning: 'Test'
      };
      
      const queueCommand: MusicCommand = {
        intent: 'queue_multiple_songs',
        songs: [{ artist: 'Test', track: 'Test' }],
        confidence: 0.8,
        reasoning: 'Test'
      };
      
      // TypeScript should know the shape based on intent
      if (playCommand.intent === 'play_specific_song') {
        // TypeScript knows these fields exist
        expect(playCommand.artist).toBeDefined();
        expect(playCommand.track).toBeDefined();
      }
      
      if (queueCommand.intent === 'queue_multiple_songs') {
        // TypeScript knows songs field exists
        expect(queueCommand.songs).toBeDefined();
      }
    });

    it('should provide discriminated union behavior', () => {
      type MusicCommand = z.infer<typeof MusicCommandSchema>;
      
      const handleCommand = (cmd: MusicCommand) => {
        switch (cmd.intent) {
          case 'play_specific_song':
            // TypeScript knows artist and track exist
            return `Playing ${cmd.track} by ${cmd.artist}`;
          case 'queue_multiple_songs':
            // TypeScript knows songs array exists
            return `Queuing ${cmd.songs.length} songs`;
          case 'set_volume':
            // TypeScript knows volume_level exists
            return `Setting volume to ${cmd.volume_level}`;
          case 'clarification_mode':
            // TypeScript knows responseMessage and options exist
            return `${cmd.responseMessage} (${cmd.options.length} options)`;
          default:
            return 'Unknown command';
        }
      };

      // Test discriminated union behavior
      const playCmd: MusicCommand = {
        intent: 'play_specific_song',
        artist: 'Test Artist',
        track: 'Test Track',
        confidence: 0.9,
        reasoning: 'Test'
      };

      const queueCmd: MusicCommand = {
        intent: 'queue_multiple_songs',
        songs: [{ artist: 'Test', track: 'Test' }],
        confidence: 0.8,
        reasoning: 'Test'
      };

      expect(handleCommand(playCmd)).toBe('Playing Test Track by Test Artist');
      expect(handleCommand(queueCmd)).toBe('Queuing 1 songs');
    });
  });

  describe('Individual schema validation', () => {
    it('should validate PlaySpecificSongSchema independently', () => {
      const validInput = {
        intent: 'play_specific_song',
        artist: 'Test Artist',
        track: 'Test Track',
        confidence: 0.9,
        reasoning: 'Test'
      };

      const result = PlaySpecificSongSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate QueueMultipleSongsSchema independently', () => {
      const validInput = {
        intent: 'queue_multiple_songs',
        songs: [{ artist: 'Test', track: 'Test' }],
        confidence: 0.8,
        reasoning: 'Test'
      };

      const result = QueueMultipleSongsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate ClarificationModeSchema independently', () => {
      const validInput = {
        intent: 'clarification_mode',
        responseMessage: 'Choose an option',
        currentContext: {
          rejected: 'Test',
          rejectionType: 'artist'
        },
        options: [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' },
          { label: 'Option 3', value: 'opt3' },
          { label: 'Option 4', value: 'opt4' }
        ],
        uiType: 'clarification_buttons',
        confidence: 0.95,
        reasoning: 'Test'
      };

      const result = ClarificationModeSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });
});