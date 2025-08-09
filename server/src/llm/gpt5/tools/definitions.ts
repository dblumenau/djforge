import { zodToJsonSchema } from 'zod-to-json-schema';
import { Tool } from '../types';
import { MusicAlternativesSchema, PlaySpecificSongSchema } from './schemas';

/**
 * Build tools array for GPT-5 Responses API
 * 
 * Provides tools for function calling including music alternatives
 * for rejection scenarios when users say "play something else"
 */
export function buildTools(): Tool[] {
  return [
    // Custom function tools - FunctionTool format
    // {
    //   type: "function",
    //   name: "get_weather",
    //   description: "Get current weather for a location",
    //   strict: false,
    //   parameters: {
    //       type: "object",
    //       properties: {
    //         location: { 
    //           type: "string", 
    //           description: "City and state, e.g. San Francisco, CA" 
    //         },
    //         unit: { 
    //           type: "string", 
    //           enum: ["celsius", "fahrenheit"],
    //           default: "celsius"
    //         }
    //       },
    //       required: ["location"]
    //     }
    // },
    // {
    //   type: "function",
    //   name: "search_music",
    //   description: "Search for music tracks or artists",
    //   strict: false,
    //   parameters: {
    //       type: "object",
    //       properties: {
    //         query: { 
    //           type: "string", 
    //           description: "Artist name, song title, or genre" 
    //         },
    //         type: { 
    //           type: "string", 
    //           enum: ["track", "artist", "album", "playlist"],
    //           default: "track"
    //         },
    //         limit: {
    //           type: "number",
    //           default: 10,
    //           minimum: 1,
    //           maximum: 50
    //         }
    //       },
    //       required: ["query"]
    //     }
    // },
    // {
    //   type: "function",
    //   name: "execute_code",
    //   description: "Execute code in various languages",
    //   strict: false,
    //   parameters: {
    //       type: "object",
    //       properties: {
    //         language: {
    //           type: "string",
    //           enum: ["python", "javascript", "typescript", "bash"]
    //         },
    //         code: {
    //           type: "string",
    //           description: "Code to execute"
    //         },
    //         timeout: {
    //           type: "number",
    //           default: 5000,
    //           description: "Execution timeout in ms"
    //         }
    //       },
    //       required: ["language", "code"]
    //     }
    // },
    {
      type: "function",
      name: "play_specific_song",
      description: "Play a specific song immediately on Spotify. Use this when the user requests a specific track by name and artist. This will search for the track and start playback, replacing the current queue. IMPORTANT: Always provide both artist and track name for accurate results. If unsure, you can provide alternatives that will be tried if the primary search fails.",
      strict: true,
      parameters: (() => {
        const schema = zodToJsonSchema(PlaySpecificSongSchema, {
          $refStrategy: "none",
          errorMessages: false,
          markdownDescription: false,
          target: "openAi"
        });
        const { $schema, ...cleanSchema } = schema as any;
        return cleanSchema;
      })()
    },
    {
      type: "function",
      name: "provide_music_alternatives",
      description: "When user rejects a song or says 'play something else', provide alternative music directions with emoji labels. IMPORTANT: Call this function ONCE per user rejection to provide a comprehensive set of alternatives. After receiving the alternatives, present them to the user and await their selection. Only call this function again if the user makes a NEW rejection request. You may still call OTHER functions as needed for complex workflows.",
      strict: true,
      parameters: (() => {
        const schema = zodToJsonSchema(MusicAlternativesSchema, {
          // Options for strict mode compatibility with OpenAI's strict function calling
          $refStrategy: "none",  // Don't use $ref, inline everything for strict mode
          errorMessages: false,
          markdownDescription: false,
          target: "openAi"  // Optimize for OpenAI's schema format (valid target!)
        });
        // Remove the top-level schema properties that OpenAI doesn't expect
        const { $schema, ...cleanSchema } = schema as any;
        return cleanSchema;
      })()
    },
    // Built-in tools
    { type: "web_search_preview" } as Tool
  ] as Tool[];
}