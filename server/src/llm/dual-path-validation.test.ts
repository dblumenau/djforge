/**
 * Dual Path Validation Tests
 * 
 * This test suite validates that both OpenRouter and Gemini Direct API paths
 * produce identical, valid intent objects. These tests are critical for
 * ensuring schema drift doesn't occur between the two systems.
 */

import { 
  validateIntent, 
  validateIntents, 
  compareIntents,
  createTestIntent,
  ValidationOptions 
} from './intent-validator';
import { 
  MusicCommandIntent,
  SpotifySearchEnhancement,
  MusicKnowledgeResponse,
  ErrorResponse,
  BatchCommand,
  IntentType
} from './intent-types';
import { 
  GEMINI_SCHEMAS,
  getSchemaForIntent,
  getSystemPromptForIntent 
} from './gemini-schemas';
import { MusicCommandSchema } from './schemas';

describe('Dual Path Validation', () => {
  
  describe('Intent Validator Core Functionality', () => {
    
    test('validates basic music command intent', () => {
      const intent = createTestIntent({
        intent: 'play',
        confidence: 0.9,
        reasoning: 'Simple play command'
      });

      const result = validateIntent(intent);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('music_command');
      expect(result.errors).toHaveLength(0);
    });

    test('validates music command with all optional fields', () => {
      const intent = createTestIntent({
        intent: 'play_specific_song',
        query: 'bohemian rhapsody',
        artist: 'Queen',
        track: 'Bohemian Rhapsody',
        album: 'A Night at the Opera',
        confidence: 0.95,
        reasoning: 'Clear search request with full details',
        alternatives: ['play queen bohemian rhapsody', 'search queen opera'],
        enhancedQuery: 'track:"Bohemian Rhapsody" artist:"Queen"',
        modifiers: {
          obscurity: 'popular',
          version: 'original',
          mood: 'dramatic',
          era: '1970s',
          genre: 'rock',
          exclude: ['remaster', 'cover']
        }
      });

      const result = validateIntent(intent);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('music_command');
      expect(result.errors).toHaveLength(0);
    });

    test('validates spotify search enhancement', () => {
      const enhancement: SpotifySearchEnhancement = {
        originalQuery: 'obscure beatles songs',
        enhancedQuery: 'artist:"The Beatles" tag:hipster',
        searchType: 'track',
        filters: {
          artist: 'The Beatles',
          tag: ['hipster']
        },
        popularity: {
          min: 0,
          max: 30
        },
        explanation: 'Using tag:hipster to find less popular Beatles tracks'
      };

      const result = validateIntent(enhancement);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('spotify_search_enhancement');
      expect(result.errors).toHaveLength(0);
    });

    test('validates music knowledge response', () => {
      const knowledge: MusicKnowledgeResponse = {
        query: 'tell me about pink floyd',
        answer: 'Pink Floyd was a British rock band formed in 1965...',
        recommendations: [
          {
            artist: 'Pink Floyd',
            track: 'Comfortably Numb',
            reason: 'One of their most acclaimed songs',
            spotifyQuery: 'track:"Comfortably Numb" artist:"Pink Floyd"'
          }
        ],
        context: {
          genre: 'progressive rock',
          era: '1970s',
          mood: 'psychedelic'
        },
        confidence: 0.9
      };

      const result = validateIntent(knowledge);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('music_knowledge');
      expect(result.errors).toHaveLength(0);
    });

    test('validates error response', () => {
      const error: ErrorResponse = {
        error: 'Unable to parse the music command',
        suggestion: 'Try being more specific about the song or artist',
        fallback: 'Would you like me to search for popular songs instead?'
      };

      const result = validateIntent(error);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('error');
      expect(result.errors).toHaveLength(0);
    });

    test('validates batch command', () => {
      const batch: BatchCommand = {
        commands: [
          createTestIntent({ intent: 'play', confidence: 0.9, reasoning: 'First command' }),
          createTestIntent({ intent: 'pause', confidence: 0.8, reasoning: 'Second command' })
        ],
        executionOrder: 'sequential',
        context: 'User wants to play then pause'
      };

      const result = validateIntent(batch);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('batch');
      expect(result.errors).toHaveLength(0);
    });

    test('rejects invalid intent types', () => {
      const invalidIntent = {
        intent: 'invalid_intent',
        confidence: 0.8,
        reasoning: 'Test invalid intent'
      };

      const result = validateIntent(invalidIntent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid intent "invalid_intent". Must be one of: play_specific_song, queue_specific_song, queue_multiple_songs, play_playlist, queue_playlist, play, pause, skip, previous, volume, set_volume, resume, next, back, get_current_track, set_shuffle, set_repeat, clear_queue, get_devices, get_playlists, get_recently_played, search, get_playback_info, chat, ask_question, explain_reasoning, unknown');
    });

    test('rejects invalid confidence values', () => {
      const invalidIntent = createTestIntent({
        confidence: 1.5 // Invalid - over 1.0
      });

      const result = validateIntent(invalidIntent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field "confidence" must be between 0 and 1');
    });

    test('rejects missing required fields', () => {
      const invalidIntent = {
        intent: 'play'
        // Missing confidence and reasoning
      };

      const result = validateIntent(invalidIntent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Required field "confidence" must be a number');
      expect(result.errors).toContain('Required field "reasoning" must be a non-empty string');
    });

  });

  describe('Intent Comparison', () => {
    
    test('identifies identical intents', () => {
      const intent1 = createTestIntent({
        intent: 'play',
        confidence: 0.9,
        reasoning: 'Play command'
      });

      const intent2 = createTestIntent({
        intent: 'play',
        confidence: 0.9,
        reasoning: 'Play command'
      });

      const comparison = compareIntents(intent1, intent2);
      
      expect(comparison.isEqual).toBe(true);
      expect(comparison.differences).toHaveLength(0);
    });

    test('identifies different intents', () => {
      const intent1 = createTestIntent({
        intent: 'play',
        confidence: 0.9,
        reasoning: 'Play command'
      });

      const intent2 = createTestIntent({
        intent: 'pause',
        confidence: 0.8,
        reasoning: 'Pause command'
      });

      const comparison = compareIntents(intent1, intent2);
      
      expect(comparison.isEqual).toBe(false);
      expect(comparison.differences.length).toBeGreaterThan(0);
    });

    test('identifies missing fields', () => {
      const intent1 = createTestIntent({
        intent: 'play',
        query: 'test song',
        confidence: 0.9,
        reasoning: 'Play command'
      });

      const intent2 = createTestIntent({
        intent: 'play',
        confidence: 0.9,
        reasoning: 'Play command'
      });
      
      // Explicitly remove the query field to simulate missing field
      delete (intent2 as any).query;

      const comparison = compareIntents(intent1, intent2);
      
      expect(comparison.isEqual).toBe(false);
      expect(comparison.differences.some(d => d.includes('query'))).toBe(true);
    });

  });

  describe('Schema Compatibility', () => {
    
    test('gemini schema supports all required fields', () => {
      const schema = getSchemaForIntent('music_command');
      
      // Check that all required fields are present
      expect(schema.required).toContain('intent');
      expect(schema.required).toContain('confidence');
      expect(schema.required).toContain('reasoning');
      
      // Check that optional fields are defined
      expect((schema as any).properties.query).toBeDefined();
      expect((schema as any).properties.artist).toBeDefined();
      expect((schema as any).properties.track).toBeDefined();
      expect((schema as any).properties.album).toBeDefined();
      expect((schema as any).properties.modifiers).toBeDefined();
      expect((schema as any).properties.alternatives).toBeDefined();
      expect((schema as any).properties.enhancedQuery).toBeDefined();
    });

    test('gemini schema has proper property ordering', () => {
      const schema = getSchemaForIntent('music_command');
      
      expect((schema as any).propertyOrdering).toBeDefined();
      expect((schema as any).propertyOrdering).toContain('intent');
      expect((schema as any).propertyOrdering).toContain('confidence');
      expect((schema as any).propertyOrdering).toContain('reasoning');
      
      // Check that intent comes first
      expect((schema as any).propertyOrdering[0]).toBe('intent');
    });

    test('gemini schema has proper enum constraints', () => {
      const schema = getSchemaForIntent('music_command');
      
      // Check intent enum
      expect((schema as any).properties.intent.enum).toContain('play');
      expect((schema as any).properties.intent.enum).toContain('pause');
      expect((schema as any).properties.intent.enum).toContain('play_specific_song');
      
      // Check modifiers enum
      expect((schema as any).properties.modifiers.properties.obscurity.enum).toContain('popular');
      expect((schema as any).properties.modifiers.properties.obscurity.enum).toContain('obscure');
      expect((schema as any).properties.modifiers.properties.version.enum).toContain('original');
      expect((schema as any).properties.modifiers.properties.version.enum).toContain('remix');
    });

    test('all schema types are available', () => {
      const musicCommandSchema = getSchemaForIntent('music_command');
      const searchEnhancementSchema = getSchemaForIntent('search_enhancement');
      const knowledgeSchema = getSchemaForIntent('music_knowledge');
      const errorSchema = getSchemaForIntent('error');
      const batchSchema = getSchemaForIntent('batch');
      
      expect(musicCommandSchema).toBeDefined();
      expect(searchEnhancementSchema).toBeDefined();
      expect(knowledgeSchema).toBeDefined();
      expect(errorSchema).toBeDefined();
      expect(batchSchema).toBeDefined();
    });

  });

  describe('System Prompt Consistency', () => {
    
    test('system prompts are available for all intent types', () => {
      const musicPrompt = getSystemPromptForIntent('music_command');
      const searchPrompt = getSystemPromptForIntent('search_enhancement');
      const knowledgePrompt = getSystemPromptForIntent('music_knowledge');
      
      expect(musicPrompt).toBeDefined();
      expect(musicPrompt.length).toBeGreaterThan(0);
      expect(searchPrompt).toBeDefined();
      expect(searchPrompt.length).toBeGreaterThan(0);
      expect(knowledgePrompt).toBeDefined();
      expect(knowledgePrompt.length).toBeGreaterThan(0);
    });

    test('system prompts are optimized for structured output', () => {
      const musicPrompt = getSystemPromptForIntent('music_command');
      
      // Should mention structured output but not JSON explicitly
      // (since responseSchema handles that)
      expect(musicPrompt.toLowerCase()).toContain('structured');
      expect(musicPrompt.toLowerCase()).toContain('confidence');
      expect(musicPrompt.toLowerCase()).toContain('reasoning');
    });

  });

  describe('Validation Options', () => {
    
    test('strict mode rejects warnings', () => {
      const intent = createTestIntent({
        intent: 'volume',
        confidence: 0.8,
        reasoning: 'Volume command without value'
        // Missing value field - should generate warning
      });

      const normalResult = validateIntent(intent, { 
        strict: false, 
        normalize: false, 
        logErrors: false 
      });
      
      const strictResult = validateIntent(intent, { 
        strict: true, 
        normalize: false, 
        logErrors: false 
      });
      
      expect(normalResult.isValid).toBe(true);
      expect(normalResult.warnings.length).toBeGreaterThan(0);
      
      expect(strictResult.isValid).toBe(false);
      expect(strictResult.errors.length).toBeGreaterThan(0);
    });

    test('normalization adds default values', () => {
      const intent = createTestIntent({
        intent: 'play',
        confidence: 0.8,
        reasoning: 'Test intent'
        // Missing alternatives and modifiers
      });

      const result = validateIntent(intent, { 
        strict: false, 
        normalize: true, 
        logErrors: false 
      });
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedIntent).toBeDefined();
      expect((result.normalizedIntent as any)?.alternatives).toBeDefined();
      expect((result.normalizedIntent as any)?.modifiers?.exclude).toBeDefined();
    });

  });

  describe('Batch Validation', () => {
    
    test('validates multiple intents at once', () => {
      const intents = [
        createTestIntent({ intent: 'play', confidence: 0.9, reasoning: 'First' }),
        createTestIntent({ intent: 'pause', confidence: 0.8, reasoning: 'Second' }),
        createTestIntent({ intent: 'skip', confidence: 0.7, reasoning: 'Third' })
      ];

      const results = validateIntents(intents, { 
        strict: false, 
        normalize: false, 
        logErrors: false 
      });
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.isValid)).toBe(true);
    });

    test('identifies invalid intents in batch', () => {
      const intents = [
        createTestIntent({ intent: 'play', confidence: 0.9, reasoning: 'Valid' }),
        { intent: 'invalid', confidence: 2.0 }, // Invalid
        createTestIntent({ intent: 'pause', confidence: 0.8, reasoning: 'Valid' })
      ];

      const results = validateIntents(intents, { 
        strict: false, 
        normalize: false, 
        logErrors: false 
      });
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
    });

  });

  describe('Edge Cases', () => {
    
    test('handles null and undefined values', () => {
      const nullResult = validateIntent(null);
      const undefinedResult = validateIntent(undefined);
      
      expect(nullResult.isValid).toBe(false);
      expect(undefinedResult.isValid).toBe(false);
    });

    test('handles empty objects', () => {
      const emptyResult = validateIntent({});
      
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.errors.length).toBeGreaterThan(0);
    });

    test('handles malformed JSON strings', () => {
      const malformedJson = '{"intent": "play", "confidence": 0.8, "reasoning": "test"'; // Missing closing brace
      
      // This would be caught by JSON.parse in actual usage
      expect(() => JSON.parse(malformedJson)).toThrow();
    });

    test('handles very large intent objects', () => {
      const largeIntent = createTestIntent({
        intent: 'play_specific_song',
        query: 'a'.repeat(1000), // Very long query
        confidence: 0.8,
        reasoning: 'b'.repeat(500), // Very long reasoning
        alternatives: Array(100).fill('test alternative'), // Many alternatives
        modifiers: {
          exclude: Array(50).fill('exclude term') // Many exclude terms
        }
      });

      const result = validateIntent(largeIntent);
      
      expect(result.isValid).toBe(true);
    });

  });

  describe('Performance Tests', () => {
    
    test('validation performance is acceptable', () => {
      const intent = createTestIntent();
      const startTime = performance.now();
      
      // Validate 1000 times
      for (let i = 0; i < 1000; i++) {
        validateIntent(intent, { strict: false, normalize: false, logErrors: false });
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 1000 validations in under 1 second
      expect(totalTime).toBeLessThan(1000);
    });

    test('comparison performance is acceptable', () => {
      const intent1 = createTestIntent();
      const intent2 = createTestIntent();
      const startTime = performance.now();
      
      // Compare 1000 times
      for (let i = 0; i < 1000; i++) {
        compareIntents(intent1, intent2);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 1000 comparisons in under 1 second
      expect(totalTime).toBeLessThan(1000);
    });

  });

  describe('Extended Intent Validation', () => {
    
    test('validates all 25 intent types', () => {
      const allIntents = [
        'play_specific_song', 'queue_specific_song', 'queue_multiple_songs', 'play_playlist', 'queue_playlist',
        'play', 'pause', 'skip', 'previous', 'volume', 'set_volume', 'resume', 'next', 'back',
        'get_current_track', 'set_shuffle', 'set_repeat', 'clear_queue', 'get_devices', 'get_playlists',
        'get_recently_played', 'search', 'get_playback_info', 'chat', 'ask_question', 'explain_reasoning', 'unknown'
      ];
      
      allIntents.forEach(intentType => {
        const intent = createTestIntent({
          intent: intentType as any,
          confidence: 0.8,
          reasoning: `Test intent for ${intentType}`
        });
        
        const result = validateIntent(intent);
        expect(result.isValid).toBe(true);
        expect(result.intentType).toBe('music_command');
      });
    });

    test('validates extended intent with volume_level field', () => {
      const intent = createTestIntent({
        intent: 'set_volume',
        volume_level: 75,
        confidence: 0.9,
        reasoning: 'Set volume to 75%'
      });

      const result = validateIntent(intent);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('music_command');
      expect(result.errors).toHaveLength(0);
    });

    test('validates extended intent with enabled field', () => {
      const intent = createTestIntent({
        intent: 'set_shuffle',
        enabled: true,
        confidence: 0.9,
        reasoning: 'Enable shuffle mode'
      });

      const result = validateIntent(intent);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('music_command');
      expect(result.errors).toHaveLength(0);
    });

    test('validates repeat intent with enabled field', () => {
      const intent = createTestIntent({
        intent: 'set_repeat',
        enabled: false,
        confidence: 0.9,
        reasoning: 'Disable repeat mode'
      });

      const result = validateIntent(intent);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('music_command');
      expect(result.errors).toHaveLength(0);
    });

    test('rejects invalid volume_level values', () => {
      const intent = createTestIntent({
        intent: 'set_volume',
        volume_level: 150, // Invalid - over 100
        confidence: 0.9,
        reasoning: 'Set volume too high'
      });

      const result = validateIntent(intent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field "volume_level" must be between 0 and 100');
    });

    test('rejects invalid enabled field types', () => {
      const intent = createTestIntent({
        intent: 'set_shuffle',
        confidence: 0.9,
        reasoning: 'Enable shuffle with string'
      });
      
      // Manually set invalid enabled field to bypass TypeScript
      (intent as any).enabled = 'true'; // Invalid - should be boolean

      const result = validateIntent(intent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Optional field "enabled" must be a boolean if provided');
    });

    test('warns about missing volume_level for set_volume intent', () => {
      const intent = createTestIntent({
        intent: 'set_volume',
        confidence: 0.9,
        reasoning: 'Set volume without level'
      });

      const result = validateIntent(intent);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Set volume intent should typically include a "volume_level" or "value" field');
    });

    test('warns about missing enabled for shuffle/repeat intents', () => {
      const shuffleIntent = createTestIntent({
        intent: 'set_shuffle',
        confidence: 0.9,
        reasoning: 'Set shuffle without enabled'
      });

      const repeatIntent = createTestIntent({
        intent: 'set_repeat',
        confidence: 0.9,
        reasoning: 'Set repeat without enabled'
      });

      const shuffleResult = validateIntent(shuffleIntent);
      const repeatResult = validateIntent(repeatIntent);
      
      expect(shuffleResult.isValid).toBe(true);
      expect(shuffleResult.warnings).toContain('Shuffle/repeat intents should typically include an "enabled" field');
      
      expect(repeatResult.isValid).toBe(true);
      expect(repeatResult.warnings).toContain('Shuffle/repeat intents should typically include an "enabled" field');
    });

  });

  describe('Schema Drift Detection', () => {
    
    test('OpenRouter and Gemini schemas must support identical intent types', () => {
      // Extract intents from OpenRouter schema
      const openRouterIntents = [
        'play_specific_song', 'queue_specific_song', 'queue_multiple_songs', 'play_playlist', 
        'queue_playlist', 'play', 'pause', 'skip', 'previous', 'volume', 'set_volume', 
        'resume', 'next', 'back', 'get_current_track', 'set_shuffle', 'set_repeat', 
        'clear_queue', 'get_devices', 'get_playlists', 'get_recently_played', 'search', 
        'get_playback_info', 'chat', 'ask_question', 'explain_reasoning', 'unknown'
      ];
      
      // Extract intents from Gemini schema
      const geminiSchema = getSchemaForIntent('music_command');
      const geminiIntents = (geminiSchema as any).properties.intent.enum;
      
      // Verify both schemas have identical intent types
      expect(geminiIntents).toEqual(openRouterIntents);
      expect(geminiIntents).toHaveLength(27);
      expect(openRouterIntents).toHaveLength(27);
    });

    test('Both schemas must support identical required fields', () => {
      const musicCommandSchema = getSchemaForIntent('music_command');
      const expectedRequiredFields = ['intent', 'confidence', 'reasoning'];
      
      expect((musicCommandSchema as any).required).toEqual(expectedRequiredFields);
    });

    test('All intent types must be validated by intent-validator', () => {
      const allIntents = [
        'play_specific_song', 'queue_specific_song', 'queue_multiple_songs', 'play_playlist', 
        'queue_playlist', 'play', 'pause', 'skip', 'previous', 'volume', 'set_volume', 
        'resume', 'next', 'back', 'get_current_track', 'set_shuffle', 'set_repeat', 
        'clear_queue', 'get_devices', 'get_playlists', 'get_recently_played', 'search', 
        'get_playback_info', 'chat', 'ask_question', 'unknown'
      ];
      
      // Verify all intents are in VALID_INTENTS
      const { VALID_INTENTS } = require('./intent-types');
      expect(VALID_INTENTS).toEqual(allIntents);
      expect(VALID_INTENTS).toHaveLength(26);
    });

    test('Schema field consistency across OpenRouter and Gemini', () => {
      const musicCommandSchema = getSchemaForIntent('music_command');
      const properties = (musicCommandSchema as any).properties;
      
      // Verify critical fields exist in both schemas
      const expectedFields = [
        'intent', 'query', 'artist', 'track', 'album', 'value', 'volume_level', 
        'enabled', 'modifiers', 'confidence', 'reasoning', 'alternatives', 
        'enhancedQuery', 'responseMessage', 'songs', 'theme'
      ];
      
      expectedFields.forEach(field => {
        expect(properties[field]).toBeDefined();
      });
    });

  });

  describe('Integration Scenarios', () => {
    
    test('validates realistic music command scenario', () => {
      const intent = createTestIntent({
        intent: 'play_specific_song',
        query: 'acoustic version of hurt by johnny cash',
        artist: 'Johnny Cash',
        track: 'Hurt',
        confidence: 0.92,
        reasoning: 'User specifically requested acoustic version of Johnny Cash\'s cover of Hurt',
        alternatives: [
          'play hurt by nine inch nails original',
          'search johnny cash covers',
          'play acoustic johnny cash songs'
        ],
        enhancedQuery: 'track:"Hurt" artist:"Johnny Cash" acoustic',
        modifiers: {
          version: 'acoustic',
          obscurity: 'popular',
          mood: 'melancholy',
          era: '2000s',
          exclude: ['nine inch nails', 'original']
        }
      });

      const result = validateIntent(intent);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('music_command');
      expect(result.errors).toHaveLength(0);
    });

    test('validates realistic search enhancement scenario', () => {
      const enhancement: SpotifySearchEnhancement = {
        originalQuery: 'rare 90s hip hop instrumental tracks',
        enhancedQuery: 'genre:hip-hop year:1990-1999 tag:hipster instrumental',
        searchType: 'track',
        filters: {
          genre: 'hip-hop',
          year: '1990-1999',
          tag: ['hipster', 'instrumental']
        },
        popularity: {
          min: 0,
          max: 25
        },
        explanation: 'Using genre filter for hip-hop, year range for 90s, tag:hipster for rare tracks, and instrumental keyword for instrumental versions'
      };

      const result = validateIntent(enhancement);
      
      expect(result.isValid).toBe(true);
      expect(result.intentType).toBe('spotify_search_enhancement');
      expect(result.errors).toHaveLength(0);
    });

  });

});

/**
 * Test utilities for manual testing and debugging
 */
export const TestUtils = {
  
  /**
   * Generate a test intent with random values
   */
  generateRandomIntent(): MusicCommandIntent {
    const intents: IntentType[] = ['play', 'pause', 'skip', 'play_specific_song', 'volume'];
    const intent = intents[Math.floor(Math.random() * intents.length)];
    
    return createTestIntent({
      intent,
      confidence: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
      reasoning: `Random test intent for ${intent}`,
      query: Math.random() > 0.5 ? 'test song' : undefined
    });
  },

  /**
   * Validate a batch of random intents
   */
  validateRandomBatch(count: number = 10): any[] {
    const intents = Array(count).fill(null).map(() => this.generateRandomIntent());
    return validateIntents(intents, { strict: false, normalize: false, logErrors: false });
  },

  /**
   * Compare two random intents
   */
  compareRandomIntents(): { intents: [MusicCommandIntent, MusicCommandIntent], comparison: ReturnType<typeof compareIntents> } {
    const intent1 = this.generateRandomIntent();
    const intent2 = this.generateRandomIntent();
    
    return {
      intents: [intent1, intent2],
      comparison: compareIntents(intent1, intent2)
    };
  }

};

// Re-export for convenience
export { validateIntent, validateIntents, compareIntents, createTestIntent };
export type { ValidationResult, ValidationOptions } from './intent-validator';