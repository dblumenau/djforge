import { validateMusicCommand, validateAndRepair, needsConfirmation } from '../command-validator';

describe('Command Validator', () => {
  describe('validateMusicCommand', () => {
    it('should validate a correct play_specific_song command', () => {
      const command = {
        intent: 'play_specific_song',
        artist: 'Phoebe Bridgers',
        track: 'Motion Sickness',
        confidence: 0.9,
        reasoning: 'User requested this song'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(expect.objectContaining(command));
    });
    
    it('should reject play_specific_song with empty artist', () => {
      const command = {
        intent: 'play_specific_song',
        artist: '',
        track: 'Motion Sickness',
        confidence: 0.9,
        reasoning: 'Test'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Artist field is required');
    });
    
    it('should reject play_specific_song with empty track', () => {
      const command = {
        intent: 'play_specific_song',
        artist: 'Phoebe Bridgers',
        track: '',
        confidence: 0.9,
        reasoning: 'Test'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Track field is required');
    });
    
    it('should validate queue_multiple_songs with songs array', () => {
      const command = {
        intent: 'queue_multiple_songs',
        songs: [
          { artist: 'Boygenius', track: 'True Blue' },
          { artist: 'Julien Baker', track: 'Appointments' }
        ],
        confidence: 0.85,
        reasoning: 'Multiple songs requested'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(true);
    });
    
    it('should reject queue_multiple_songs with empty songs array', () => {
      const command = {
        intent: 'queue_multiple_songs',
        songs: [],
        confidence: 0.85,
        reasoning: 'Test'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Songs array is required');
    });
    
    it('should validate clarification_mode with all required fields', () => {
      const command = {
        intent: 'clarification_mode',
        responseMessage: 'What would you like instead?',
        currentContext: {
          rejected: 'Phoebe Bridgers',
          rejectionType: 'artist'
        },
        options: [
          { label: 'Rock', value: 'rock' },
          { label: 'Pop', value: 'pop' },
          { label: 'Jazz', value: 'jazz' },
          { label: 'Classical', value: 'classical' }
        ],
        uiType: 'clarification_buttons',
        confidence: 0.95,
        reasoning: 'User rejected selection'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(true);
    });
    
    it('should reject deprecated intents with helpful message', () => {
      const command = {
        intent: 'search_and_play',
        query: 'test',
        confidence: 0.8,
        reasoning: 'Test'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toContain("Intent 'search_and_play' is deprecated. Use 'play_specific_song' or 'queue_specific_song' instead");
    });

    it('should validate set_volume with proper volume_level', () => {
      const command = {
        intent: 'set_volume',
        volume_level: 75,
        confidence: 0.9,
        reasoning: 'User requested volume change'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(true);
    });

    it('should reject set_volume with invalid volume_level', () => {
      const command = {
        intent: 'set_volume',
        volume_level: 150,
        confidence: 0.9,
        reasoning: 'Test'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('volume_level must be between 0 and 100');
    });

    it('should validate simple control commands', () => {
      const commands = ['pause', 'resume', 'skip', 'next', 'previous', 'back'];
      
      commands.forEach(intent => {
        const command = {
          intent,
          confidence: 0.9,
          reasoning: 'Test command'
        };
        
        const result = validateMusicCommand(command);
        expect(result.isValid).toBe(true);
      });
    });

    it('should validate play_playlist with query', () => {
      const command = {
        intent: 'play_playlist',
        query: 'My Favorite Songs',
        confidence: 0.85,
        reasoning: 'User requested playlist'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(true);
    });

    it('should reject play_playlist with empty query', () => {
      const command = {
        intent: 'play_playlist',
        query: '',
        confidence: 0.85,
        reasoning: 'Test'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(false);
    });
  });
  
  describe('validateAndRepair', () => {
    it('should repair deprecated search_and_play intent', () => {
      const command = {
        intent: 'search_and_play',
        artist: 'Test Artist',
        track: 'Test Track',
        confidence: 0.8,
        reasoning: 'Test'
      };
      
      const result = validateAndRepair(command);
      expect(result.isValid).toBe(true);
      expect(result.data?.intent).toBe('play_specific_song');
    });

    it('should repair deprecated search_and_queue intent', () => {
      const command = {
        intent: 'search_and_queue',
        artist: 'Test Artist',
        track: 'Test Track',
        confidence: 0.8,
        reasoning: 'Test'
      };
      
      const result = validateAndRepair(command);
      expect(result.isValid).toBe(true);
      expect(result.data?.intent).toBe('queue_specific_song');
    });

    it('should repair deprecated queue_add intent', () => {
      const command = {
        intent: 'queue_add',
        artist: 'Test Artist',
        track: 'Test Track',
        confidence: 0.8,
        reasoning: 'Test'
      };
      
      const result = validateAndRepair(command);
      expect(result.isValid).toBe(true);
      expect(result.data?.intent).toBe('queue_specific_song');
    });
    
    it('should fix confidence over 1', () => {
      const command = {
        intent: 'play',
        confidence: 85, // Percentage instead of decimal
        reasoning: 'Test'
      };
      
      const result = validateAndRepair(command);
      expect(result.isValid).toBe(true);
      expect(result.data?.confidence).toBe(0.85);
    });

    it('should fix confidence over 100 by clamping', () => {
      const command = {
        intent: 'play',
        confidence: 150,
        reasoning: 'Test'
      };
      
      const result = validateAndRepair(command);
      expect(result.isValid).toBe(true);
      expect(result.data?.confidence).toBe(1);
    });

    it('should add default reasoning if missing', () => {
      const command = {
        intent: 'play',
        confidence: 0.8
      };
      
      const result = validateAndRepair(command);
      expect(result.isValid).toBe(true);
      expect(result.data?.reasoning).toBe('Interpreted from user command');
    });

    it('should add default confidence if missing', () => {
      const command = {
        intent: 'play',
        reasoning: 'Test'
      };
      
      const result = validateAndRepair(command);
      expect(result.isValid).toBe(true);
      expect(result.data?.confidence).toBe(0.7);
    });
    
    it('should not repair empty required fields', () => {
      const command = {
        intent: 'play_specific_song',
        artist: '',
        track: 'Test Track',
        confidence: 0.8,
        reasoning: 'Test'
      };
      
      const result = validateAndRepair(command);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Artist cannot be empty');
    });

    it('should not repair empty track fields', () => {
      const command = {
        intent: 'queue_specific_song',
        artist: 'Test Artist',
        track: '',
        confidence: 0.8,
        reasoning: 'Test'
      };
      
      const result = validateAndRepair(command);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Track cannot be empty');
    });
  });
  
  describe('needsConfirmation', () => {
    it('should require confirmation for low confidence destructive actions', () => {
      const command = {
        intent: 'play_specific_song',
        confidence: 0.5
      };
      
      expect(needsConfirmation(command)).toBe(true);
    });
    
    it('should not require confirmation for high confidence actions', () => {
      const command = {
        intent: 'play_specific_song',
        confidence: 0.9
      };
      
      expect(needsConfirmation(command)).toBe(false);
    });
    
    it('should not require confirmation for non-destructive actions', () => {
      const command = {
        intent: 'get_current_track',
        confidence: 0.5
      };
      
      expect(needsConfirmation(command)).toBe(false);
    });

    it('should require confirmation for low confidence queue operations', () => {
      const destructiveIntents = [
        'queue_specific_song',
        'play_playlist',
        'queue_playlist',
        'queue_multiple_songs'
      ];

      destructiveIntents.forEach(intent => {
        const command = {
          intent,
          confidence: 0.6
        };
        
        expect(needsConfirmation(command)).toBe(true);
      });
    });

    it('should not require confirmation for control commands regardless of confidence', () => {
      const controlIntents = [
        'pause',
        'resume',
        'skip',
        'next',
        'previous',
        'set_volume'
      ];

      controlIntents.forEach(intent => {
        const command = {
          intent,
          confidence: 0.3
        };
        
        expect(needsConfirmation(command)).toBe(false);
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle malformed data gracefully', () => {
      const result = validateMusicCommand(null);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle undefined data', () => {
      const result = validateMusicCommand(undefined);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle non-object data', () => {
      const result = validateMusicCommand('not an object');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing intent field', () => {
      const command = {
        confidence: 0.8,
        reasoning: 'Test'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(false);
    });

    it('should provide detailed error information', () => {
      const command = {
        intent: 'play_specific_song',
        artist: '',
        confidence: 'not a number',
        reasoning: 'Test'
      };
      
      const result = validateMusicCommand(command);
      expect(result.isValid).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.error).toBeDefined();
      // Suggestions may or may not be defined depending on the specific errors
    });
  });
});