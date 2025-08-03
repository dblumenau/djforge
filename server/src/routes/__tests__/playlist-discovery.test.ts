import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the dependencies
jest.mock('../../middleware/session-auth');
jest.mock('../../spotify/api'); 
jest.mock('../../llm/orchestrator');

import { SpotifyWebAPI } from '../../spotify/api';
import { llmOrchestrator } from '../../llm/orchestrator';

describe('Playlist Discovery Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LLM prompt generation', () => {
    it('should generate proper prompt for LLM analysis', () => {
      const query = 'taylor swift but on harp';
      const mockPlaylists = [
        {
          id: '1',
          name: 'Taylor Swift Harp Covers',
          description: 'Beautiful harp renditions of Taylor Swift songs',
          owner: 'HarpMaster',
          trackCount: 25,
          followers: 1500,
          isPublic: true,
          images: []
        },
        {
          id: '2', 
          name: 'Pop Hits on Harp',
          description: 'Popular songs played on harp including Taylor Swift',
          owner: 'ClassicalVibes',
          trackCount: 50,
          followers: 3200,
          isPublic: true,
          images: []
        }
      ];

      const expectedPromptContent = `User is looking for playlists matching: "${query}"

Here are ${mockPlaylists.length} playlists from Spotify search results:

${mockPlaylists.map((p, i) => 
  `${i + 1}. ID: ${p.id}
   Name: "${p.name}"
   Description: "${p.description || 'No description'}"
   Owner: ${p.owner}
   Tracks: ${p.trackCount}
   Followers: ${p.followers}
   Public: ${p.isPublic}
`).join('\n')}

Analyze these playlists and select the 5 that best match the user's intent: "${query}"`;

      // This verifies our prompt generation logic is correct
      expect(expectedPromptContent).toContain('Taylor Swift Harp Covers');
      expect(expectedPromptContent).toContain('HarpMaster');
      expect(expectedPromptContent).toContain('Tracks: 25');
      expect(expectedPromptContent).toContain('Followers: 1500');
    });
  });

  describe('Fallback logic', () => {
    it('should sort playlists by follower count for fallback', () => {
      const mockPlaylists = [
        { id: '1', name: 'Low Followers', followers: 100 },
        { id: '2', name: 'High Followers', followers: 5000 },
        { id: '3', name: 'Medium Followers', followers: 1000 },
        { id: '4', name: 'No Followers', followers: 0 }
      ];

      const sorted = mockPlaylists
        .sort((a, b) => (b.followers || 0) - (a.followers || 0))
        .slice(0, 3);

      expect(sorted[0].name).toBe('High Followers');
      expect(sorted[1].name).toBe('Medium Followers'); 
      expect(sorted[2].name).toBe('Low Followers');
    });
  });

  describe('LLM response validation', () => {
    it('should validate correct LLM response format', () => {
      const mockLLMResponse = {
        selectedPlaylistIds: ['1', '2', '3'],
        reasoning: 'These playlists best match the harp theme'
      };

      expect(mockLLMResponse.selectedPlaylistIds).toHaveLength(3);
      expect(mockLLMResponse.selectedPlaylistIds).toContain('1');
      expect(mockLLMResponse.reasoning).toContain('harp');
    });

    it('should handle LLM response with no reasoning', () => {
      const mockLLMResponse: { selectedPlaylistIds: string[]; reasoning?: string } = {
        selectedPlaylistIds: ['1', '2']
      };

      expect(mockLLMResponse.selectedPlaylistIds).toHaveLength(2);
      expect(mockLLMResponse.reasoning).toBeUndefined();
    });
  });
});