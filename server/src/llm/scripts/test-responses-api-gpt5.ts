#!/usr/bin/env npx tsx

/**
 * ULTIMATE OpenAI Responses API Test Script - GPT-5 Edition
 * Complete TypeScript implementation with full type safety
 * 
 * Based on the latest OpenAI Node.js SDK documentation (v5+)
 * Features:
 * - Full TypeScript types from OpenAI SDK
 * - Redis session management for conversation continuity
 * - Streaming support
 * - Tool calling with Zod schemas
 * - Structured outputs
 * - Reasoning tokens tracking
 * - Built-in and custom tools
 */

import chalk from 'chalk';
import util from 'util';
import 'dotenv/config';
import * as fs from 'fs/promises';
import OpenAI from 'openai';
import * as path from 'path';
import * as readline from 'readline';
import { createClient } from 'redis';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MusicAlternativesSchema, ToolResponseSchemas } from '../schemas/v2/music-alternatives';

// Import response types from the responses module
import type {
  Response,
  ResponseCreateParams,
  ResponseErrorEvent,
  ResponseFormatTextConfig,
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseReasoningItem,
  ResponseStreamEvent,
  ResponseTextDeltaEvent,
  ResponseUsage,
  Tool
} from 'openai/resources/responses/responses';

// Session management types
interface SessionData {
  lastResponseId: string | null;
  conversationHistory: Array<{
    responseId: string;
    input: string;
    output: string;
    timestamp: string;
    model: string;
    usage?: ResponseUsage;
    hadFunctionCall?: boolean;  // Track if this response included function calls
  }>;
  metadata: Record<string, any>;
}

// Session validation schema - runtime validation for loaded sessions
const SessionDataSchema = z.object({
  lastResponseId: z.string().nullable(),
  conversationHistory: z.array(z.object({
    responseId: z.string(),
    input: z.string(),
    output: z.string(),
    timestamp: z.string(),
    model: z.string(),
    usage: z.any().optional(), // ResponseUsage type is complex, using any for now
    hadFunctionCall: z.boolean().optional() // Track if response had function calls
  })),
  metadata: z.record(z.any())
});

// Tool schemas using Zod
const WeatherSchema = z.object({
  location: z.string().describe("City and state, e.g. San Francisco, CA"),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius")
});

const MusicSearchSchema = z.object({
  query: z.string().describe("Artist name, song title, or genre"),
  type: z.enum(["track", "artist", "album", "playlist"]).default("track"),
  limit: z.number().min(1).max(50).default(10)
});

const CodeExecutionSchema = z.object({
  language: z.enum(["python", "javascript", "typescript", "bash"]),
  code: z.string().describe("Code to execute"),
  timeout: z.number().default(5000).describe("Execution timeout in ms")
});

/**
 * Music Alternatives Schema for Rejection Scenarios
 * 
 * This schema handles the "clarification_mode" intent when users reject
 * a song/artist and say things like "play something else", "not this", etc.
 * 
 * The function provides 4-5 alternative music directions, each with:
 * - An emoji label for visual distinction in UI
 * - A short descriptive label
 * - An internal value identifier
 * - A longer description of the alternative
 * - An example query that would be executed if selected
 * 
 * Example emojis: ⚡🎸🎹🎤🎵🎺🎷🕺💃📼☀️🎲
 * 
 * This enables smart contextual alternatives based on what was rejected,
 * such as offering "More upbeat indie" if user rejects "Phoebe Bridgers"
 */
// MusicAlternativesSchema is now imported from ../schemas/music-alternatives

// Tool validation map for runtime validation
const toolValidators: Record<string, z.ZodSchema<any>> = {
  get_weather: WeatherSchema,
  search_music: MusicSearchSchema,
  execute_code: CodeExecutionSchema,
  provide_music_alternatives: MusicAlternativesSchema
};

// Configuration interface
interface TestConfig {
  model: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
  reasoning: {
    effort: 'low' | 'medium' | 'high';
  };
  verbose: boolean;
  useTools: boolean;
  streaming: boolean;
  temperature: number;
  maxOutputTokens?: number;
  structuredOutput?: boolean;
}

// Config validation schema for runtime validation
const TestConfigSchema = z.object({
  model: z.enum(['gpt-5', 'gpt-5-mini', 'gpt-5-nano']),
  reasoning: z.object({
    effort: z.enum(['low', 'medium', 'high'])
  }),
  verbose: z.boolean(),
  useTools: z.boolean(),
  streaming: z.boolean(),
  temperature: z.number().min(0).max(2),
  maxOutputTokens: z.number().positive().optional(),
  structuredOutput: z.boolean().optional()
});

class GPT5ResponsesAPITester {
  private openai: OpenAI;
  private redisClient: ReturnType<typeof createClient> | null = null;
  private sessionData: SessionData;
  private rl: readline.Interface;
  private config: TestConfig;
  private sessionFile: string;
  public initializePromise: Promise<void>;
  private savingSession: boolean = false;
  private pendingSave: boolean = false;
  private processingCommand: boolean = false;

  constructor() {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      console.error(chalk.red.bold('ERROR: OPENAI_API_KEY not found in .env file'));
      console.log('Please add OPENAI_API_KEY=your-key-here to your .env file');
      process.exit(1);
    }

    // Initialize OpenAI client with latest configuration
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 3,
      timeout: 60000, // 60 seconds
    });

    // Session file path
    this.sessionFile = path.join(process.cwd(), '.responses-session-real.json');

    // Initialize session data
    this.sessionData = {
      lastResponseId: null,
      conversationHistory: [],
      metadata: {}
    };

    // Default configuration
    this.config = {
      model: 'gpt-5-nano',
      reasoning: { effort: 'low' },
      verbose: false,
      useTools: true,  // Tools enabled by default
      streaming: true,
      temperature: 1,
      structuredOutput: true
    };

    // Setup readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('> ')
    });

    // Initialize connections and store the promise for external awaiting
    this.initializePromise = this.initialize();
  }

  private async initialize() {
    // Initialize Redis first, then load session
    await this.initRedis();
    await this.loadSession();
  }

  private async initRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redisClient = createClient({ url: redisUrl });
      
      this.redisClient.on('error', (err) => {
        console.log(chalk.yellow('Redis Client Error:'), err.message);
      });

      await this.redisClient.connect();
      console.log(chalk.green('✓ Connected to Redis for enhanced session management'));
    } catch (error) {
      console.log(chalk.yellow('Redis not available, using file-based sessions'));
      this.redisClient = null;
    }
  }

  private async loadSession() {
    try {
      // Try Redis first
      if (this.redisClient) {
        const redisData = await this.redisClient.get('gpt5-test-session');
        if (redisData) {
          const loadedData = JSON.parse(redisData as string);
          
          // Validate with Zod
          try {
            this.sessionData = SessionDataSchema.parse(loadedData);
            console.log(chalk.green('✓ Loaded and validated session from Redis'));
          } catch (validationError) {
            if (validationError instanceof z.ZodError) {
              console.log(chalk.yellow('Session validation failed:'));
              validationError.errors.forEach(err => {
                console.log(chalk.yellow(`  - ${err.path.join('.')}: ${err.message}`));
              });
              console.log(chalk.yellow('Starting with fresh session'));
              
              // Reset to valid empty session
              this.sessionData = {
                lastResponseId: null,
                conversationHistory: [],
                metadata: {}
              };
            } else {
              throw validationError;
            }
          }
          
          this.displaySessionInfo();
          return;
        }
      }

      // Fallback to file
      const fileData = await fs.readFile(this.sessionFile, 'utf8');
      const loadedData = JSON.parse(fileData);
      
      // Validate with Zod
      try {
        this.sessionData = SessionDataSchema.parse(loadedData);
        console.log(chalk.green('✓ Loaded and validated session from file'));
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.log(chalk.yellow('Session validation failed:'));
          validationError.errors.forEach(err => {
            console.log(chalk.yellow(`  - ${err.path.join('.')}: ${err.message}`));
          });
          console.log(chalk.yellow('Starting with fresh session'));
          
          // Reset to valid empty session
          this.sessionData = {
            lastResponseId: null,
            conversationHistory: [],
            metadata: {}
          };
        } else {
          throw validationError;
        }
      }
      
      this.displaySessionInfo();
    } catch (error) {
      console.log(chalk.yellow('Starting fresh session'));
    }
  }

  private async saveSession() {
    // Prevent concurrent saves to avoid race conditions
    if (this.savingSession) {
      this.pendingSave = true;
      return;
    }

    this.savingSession = true;

    try {
      // Save to Redis if available
      if (this.redisClient) {
        await this.redisClient.set(
          'gpt5-test-session',
          JSON.stringify(this.sessionData),
          { EX: 86400 } // Expire after 24 hours
        );
      }

      // Always save to file as backup
      await fs.writeFile(
        this.sessionFile,
        JSON.stringify(this.sessionData, null, 2)
      );
    } catch (error) {
      console.error(chalk.red('Failed to save session:'), error);
    } finally {
      this.savingSession = false;
      
      // If there was a pending save request, execute it now
      if (this.pendingSave) {
        this.pendingSave = false;
        await this.saveSession();
      }
    }
  }

  private displaySessionInfo() {
    if (this.sessionData.lastResponseId) {
      console.log(chalk.dim(`  Last Response ID: ${this.sessionData.lastResponseId}`));
      const historyCount = this.sessionData.conversationHistory?.length || 0;
      console.log(chalk.dim(`  History: ${historyCount} messages`));
    }
  }

  /**
   * Find the last response ID that didn't have function calls
   * This allows us to maintain conversation continuity while avoiding
   * the "No tool output found" error when streaming with function calls
   */
  private findLastValidResponseId(): string | null {
    if (!this.sessionData.conversationHistory || this.sessionData.conversationHistory.length === 0) {
      return null;
    }

    // Search backwards through history for a response without function calls
    for (let i = this.sessionData.conversationHistory.length - 1; i >= 0; i--) {
      const entry = this.sessionData.conversationHistory[i];
      if (!entry.hadFunctionCall) {
        console.log(chalk.yellow(`Found valid response ID from ${i === this.sessionData.conversationHistory.length - 1 ? 'last' : `${this.sessionData.conversationHistory.length - 1 - i} messages ago`}: ${entry.responseId}`));
        return entry.responseId;
      }
    }

    console.log(chalk.yellow('No responses without function calls found in history'));
    return null;
  }

  public async callResponsesAPI(input: string, options: Partial<TestConfig> = {}) {
    const config = { ...this.config, ...options };
    
    console.log(chalk.blue('\n' + '═'.repeat(80)));
    console.log(chalk.bold('CALLING GPT-5 RESPONSES API'));
    console.log(chalk.blue('═'.repeat(80)));

    // Build request parameters with proper typing
    const params: ResponseCreateParams = {
      model: config.model,
      input: input,
      store: true, // Enable server-side storage
      
      // Optional parameters
      instructions: `You are a music assistant integrated with DJ Forge, a Spotify control system.

CRITICAL RULES:
1. When user rejects music or asks for alternatives (examples: "I don't like that song", "play something else", "another please", "different music"), you MUST use the 'provide_music_alternatives' function.
2. You can provide BOTH a friendly text response AND call the function in the same response.
3. The function provides structured data for the UI, while your text message adds personality.

Example: User says "I don't like that song"
- Call provide_music_alternatives function with alternatives
- Also say something friendly like "No problem! Let me suggest some alternatives..."

This dual approach makes the experience both functional and conversational.`,
      max_output_tokens: config.maxOutputTokens,
      temperature: config.temperature,
      top_p: 1,
      
      // Reasoning configuration
      reasoning: {
        effort: config.reasoning.effort
      },
      
      // Text configuration
      text: {
        format: {
          type: "text"
        } as ResponseFormatTextConfig,
        verbosity: "medium"
      },
      
      // Tool configuration
      tool_choice: config.useTools ? "auto" : undefined,  // "auto" is PERFECT - model decides when functions make sense!
      parallel_tool_calls: true,
      
      // Truncation strategy
      truncation: "disabled",
      
      // Metadata - all values must be strings
      metadata: {
        test: "true",
        timestamp: new Date().toISOString(),
        session: this.sessionData.lastResponseId ? "continued" : "new"
      }
    };

    // Add conversation continuity with smart skip-back for function calls
    // This avoids the "No tool output found" error when streaming with function calls
    const validResponseId = this.findLastValidResponseId();
    if (validResponseId) {
      params.previous_response_id = validResponseId;
      console.log(chalk.yellow(`Continuing from: ${validResponseId}`));
      
      // Show context info in verbose mode
      if (this.config.verbose) {
        const lastMessage = this.sessionData.conversationHistory[this.sessionData.conversationHistory.length - 1];
        if (lastMessage?.hadFunctionCall) {
          console.log(chalk.dim('Last response had function calls, skipping back to maintain continuity'));
        }
        const usedMessage = this.sessionData.conversationHistory.find(m => m.responseId === validResponseId);
        if (usedMessage) {
          console.log(chalk.dim('Using response context:', usedMessage.output.substring(0, 100) + '...'));
        }
      }
    } else if (this.sessionData.conversationHistory.length > 0) {
      console.log(chalk.yellow('All previous responses had function calls, starting fresh context'));
    }

    // Add tools if enabled
    if (config.useTools) {
      params.tools = this.buildTools();
    }

    // Add structured output if enabled
    // Note: response_format is not directly supported in ResponseCreateParams
    // This would need to be handled differently based on the actual API
    if (config.structuredOutput) {
      const ResponseSchema = z.object({
        answer: z.string(),
        confidence: z.number().min(0).max(1),
        reasoning: z.string().optional(),
        sources: z.array(z.string()).optional()
      });
      
      // TODO: Structured output might need different handling
      // params.response_format = zodResponseFormat(ResponseSchema, 'structured_response');
    }

    if (config.verbose) {
      console.log(chalk.dim('Request Parameters:'));
      console.log(this.formatJSON(params));
    }

    try {
      const startTime = Date.now();
      
      if (config.streaming) {
        await this.handleStreamingResponse(params, startTime);
      } else {
        await this.handleStandardResponse(params, startTime, input);
      }
      
    } catch (error) {
      this.handleError(error);
    }
  }

  private buildTools(): Tool[] {
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
        name: "provide_music_alternatives",
        description: "When user rejects a song or says 'play something else', provide alternative music directions with emoji labels",
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
      }
      // Built-in tools - commented out for now as they may not be supported
      // { type: "web_search" },
      // { type: "code_interpreter" },
      // { type: "file_search" }
    ] as Tool[];
  }

  private async handleStandardResponse(
    params: ResponseCreateParams, 
    startTime: number,
    input: string
  ) {
    console.log(chalk.yellow('\n⏳ Calling OpenAI Responses API...'));
    
    const response = await this.openai.responses.create(params) as Response;
    const duration = Date.now() - startTime;

    console.log(chalk.green('\n' + '═'.repeat(80)));
    console.log(chalk.bold(`RESPONSE RECEIVED (${duration}ms)`));
    console.log(chalk.green('═'.repeat(80)));

    this.parseResponse(response);

    // Check if response had function calls
    const hadFunctionCall = this.checkForFunctionCalls(response);

    // Update session
    this.sessionData.lastResponseId = response.id;
    
    // Ensure conversationHistory exists
    if (!this.sessionData.conversationHistory) {
      this.sessionData.conversationHistory = [];
    }
    
    this.sessionData.conversationHistory.push({
      responseId: response.id,
      input: input,
      output: response.output_text || '',
      timestamp: new Date().toISOString(),
      model: response.model,
      usage: response.usage,
      hadFunctionCall: hadFunctionCall
    });
    
    await this.saveSession();
    console.log(chalk.green(`\n✓ Session saved with ID: ${response.id}${hadFunctionCall ? ' (with function calls)' : ''}`));
  }

  private async handleStreamingResponse(params: ResponseCreateParams, startTime: number) {
    console.log(chalk.yellow('\n⏳ Streaming from OpenAI Responses API...'));
    
    const stream = await this.openai.responses.create({
      ...params,
      stream: true
    });

    console.log(chalk.green('\n' + '═'.repeat(80)));
    console.log(chalk.bold('STREAMING RESPONSE'));
    console.log(chalk.green('═'.repeat(80) + '\n'));

    let fullText = '';
    let responseId = '';
    let toolCalls: any[] = [];
    let functionCalls: any[] = [];
    let responseData: any = null;  // Store full response for session

    for await (const event of stream) {
      this.handleStreamEvent(event as ResponseStreamEvent);
      
      // Collect text for session
      if ('output_text' in event && event.output_text) {
        fullText += event.output_text;
      }
      if ('id' in event && typeof event.id === 'string') {
        responseId = event.id;
      }
      
      // Collect tool calls if present
      if ('tool_calls' in event && event.tool_calls) {
        toolCalls = event.tool_calls;
      }
      
      // Store complete response data
      if ('response' in event && event.response) {
        responseData = event.response;
      }
      
      // Collect function calls from completion event
      if ('response' in event && event.response?.output) {
        const output = event.response.output;
        if (Array.isArray(output)) {
          output.forEach((item: any) => {
            if (item.type === 'function_call' || (item.content && Array.isArray(item.content))) {
              item.content?.forEach((content: any) => {
                if (content.type === 'tool_use') {
                  functionCalls.push(content);
                }
              });
            }
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(chalk.green(`\n\nStream completed (${duration}ms)`));
    
    // Display tool calls if any were made
    if (toolCalls.length > 0) {
      console.log(chalk.cyan('\n📦 Tool Calls Made:'));
      console.log(this.formatJSON(toolCalls));
    }
    
    // Display function calls if any were made
    if (functionCalls.length > 0) {
      console.log(chalk.cyan('\n🔧 Function Calls Made:'));
      console.log(this.formatJSON(functionCalls));
    }

    // Check if response had function calls
    const hadFunctionCall = toolCalls.length > 0 || functionCalls.length > 0;

    // Update session for streaming with function call tracking
    if (responseId) {
      this.sessionData.lastResponseId = responseId;
      
      // Ensure conversationHistory exists
      if (!this.sessionData.conversationHistory) {
        this.sessionData.conversationHistory = [];
      }
      
      // Get input from params (a bit hacky but works for this test)
      const input = typeof params.input === 'string' ? params.input : JSON.stringify(params.input);
      
      this.sessionData.conversationHistory.push({
        responseId: responseId,
        input: input,
        output: fullText || '',
        timestamp: new Date().toISOString(),
        model: params.model,
        usage: responseData?.usage,
        hadFunctionCall: hadFunctionCall
      });
      
      await this.saveSession();
      console.log(chalk.green(`\n✓ Session saved with ID: ${responseId}${hadFunctionCall ? ' (with function calls)' : ''}`));
    }
  }

  private handleStreamEvent(event: ResponseStreamEvent) {
    // Log all events in verbose mode to debug
    if (this.config.verbose) {
      console.log(chalk.dim('\n[Event Debug]:'), this.formatJSON(event));
    }
    
    // Handle different event types based on their structure
    // Note: The actual events don't have a 'type' field, they are different interfaces
    if ('delta' in event && 'content_index' in event) {
      // This is a text delta event
      const textEvent = event as ResponseTextDeltaEvent;
      process.stdout.write(textEvent.delta || '');
    } else if ('function_tool_call' in event) {
      // Function tool call event - ALWAYS show these
      console.log(chalk.cyan('\n📦 Function Call:'));
      console.log(this.formatJSON(event));
    } else if ('tool_calls' in event) {
      // Tool calls event - ALWAYS show these
      console.log(chalk.cyan('\n🔧 Tool Calls:'));
      console.log(this.formatJSON(event));
    } else if ('status' in event) {
      // This is a completion event
      if (this.config.verbose) {
        console.log(chalk.dim('\n[Status Update]'));
      }
    } else if ('error' in event || (event as any).type === 'error') {
      // This is an error event - ALWAYS show errors
      const errorEvent = event as ResponseErrorEvent;
      console.error(chalk.red('[Error]'), errorEvent.message || errorEvent);
    } else if ((event as any).type === 'response.content_part.done') {
      // Check if this is a tool use
      const part = (event as any).part;
      if (part?.type === 'tool_use') {
        console.log(chalk.cyan('\n🔧 Tool Use:'));
        console.log(chalk.cyan(`  Tool: ${part.name}`));
        console.log(chalk.cyan(`  Input:`), this.formatJSON(part.input));
      }
    } else if ((event as any).type === 'response.completed') {
      // Response completed - check for function calls in output
      const response = (event as any).response;
      if (response?.output) {
        response.output.forEach((item: any) => {
          if (item.type === 'message' && item.content) {
            item.content.forEach((content: any) => {
              if (content.type === 'tool_use') {
                console.log(chalk.cyan('\n📦 Function Call in Response:'));
                console.log(chalk.cyan(`  Function: ${content.name}`));
                console.log(chalk.cyan(`  ID: ${content.id}`));
                console.log(chalk.cyan(`  Input:`), this.formatJSON(content.input));
              }
            });
          }
        });
      }
    } else {
      // Unknown event type - handle specific cases
      const eventType = (event as any).type;
      
      // Show function/tool completion events but NOT deltas (unless verbose)
      if (eventType === 'response.function_call_arguments.done') {
        // Function call arguments complete - show this
        const args = (event as any).arguments;
        console.log(chalk.cyan('\n🔧 Function Call Complete:'));
        try {
          const parsed = JSON.parse(args);
          console.log(chalk.cyan(`  Function: ${parsed.responseMessage ? 'provide_music_alternatives' : 'unknown'}`));
          console.log(chalk.cyan('  Arguments:'), this.formatJSON(parsed));
        } catch (e) {
          console.log(chalk.cyan('  Raw Arguments:'), args);
        }
      } else if (eventType === 'response.function_call_arguments.delta') {
        // Skip deltas unless verbose mode
        if (this.config.verbose) {
          console.log(chalk.dim(`[${eventType}]:`), this.formatJSON(event));
        }
      } else if (eventType?.includes('tool') || (eventType?.includes('function') && !eventType.includes('delta'))) {
        // Show other tool/function events that aren't deltas
        console.log(chalk.yellow(`\n[${eventType}]:`), this.formatJSON(event));
      } else if (this.config.verbose) {
        console.log(chalk.dim('[Unknown Event]:'), this.formatJSON(event));
      }
    }
  }

  /**
   * Format JSON with beautiful colors for console output
   */
  private formatJSON(obj: any): string {
    // Use util.inspect for deep, colorful output
    return util.inspect(obj, {
      colors: true,
      depth: null,
      maxArrayLength: null,
      breakLength: 80,
      compact: false,
      sorted: true
    });
  }

  /**
   * Alternative JSON formatter with custom colors
   */
  private formatJSONCustom(obj: any): string {
    const json = JSON.stringify(obj, null, 2);
    return json
      .replace(/(".*?")\s*:/g, chalk.cyan('$1:'))  // Keys in cyan
      .replace(/:\s*"(.*?)"/g, ': ' + chalk.green('"$1"'))  // String values in green
      .replace(/:\s*(\d+)/g, ': ' + chalk.yellow('$1'))  // Numbers in yellow
      .replace(/:\s*(true|false)/g, ': ' + chalk.magenta('$1'))  // Booleans in magenta
      .replace(/:\s*(null)/g, ': ' + chalk.red('$1'))  // Null in red
      .replace(/(\[|\])/g, chalk.blue('$1'))  // Arrays in blue
      .replace(/(\{|\})/g, chalk.white('$1'));  // Objects in white
  }

  private parseResponse(response: Response) {
    console.log(chalk.bold('\nRESPONSE DETAILS:'));
    console.log(chalk.cyan('ID:'), response.id);
    console.log(chalk.cyan('Model:'), response.model);
    console.log(chalk.cyan('Status:'), response.status);
    
    // Parse usage with proper types
    if (response.usage) {
      console.log(chalk.bold('\nTOKEN USAGE:'));
      console.log(`  Input tokens: ${response.usage.input_tokens || 0}`);
      console.log(`  Output tokens: ${response.usage.output_tokens || 0}`);
      console.log(`  Total tokens: ${response.usage.total_tokens || 0}`);
      
      // Detailed breakdown
      if (response.usage.input_tokens_details?.cached_tokens) {
        console.log(`  Cached tokens: ${response.usage.input_tokens_details.cached_tokens}`);
      }
      
      if (response.usage.output_tokens_details?.reasoning_tokens) {
        console.log(chalk.magenta(`  Reasoning tokens: ${response.usage.output_tokens_details.reasoning_tokens}`));
      }
    }

    // Parse output items
    if (response.output && Array.isArray(response.output)) {
      console.log(chalk.bold(`\nOUTPUT ITEMS (${response.output.length}):`));
      
      response.output.forEach((item: ResponseOutputItem, index: number) => {
        if (item.type === 'reasoning') {
          const reasoning = item as ResponseReasoningItem;
          console.log(chalk.magenta(`\n[${index + 1}] Reasoning:`));
          if (reasoning.summary && reasoning.summary.length > 0) {
            console.log(`  Summary: ${reasoning.summary.join(' ')}`);
          } else {
            console.log(chalk.dim(`  (Internal reasoning: ${response.usage?.output_tokens_details?.reasoning_tokens || 0} tokens)`));
          }
        } else if (item.type === 'message') {
          const message = item as ResponseOutputMessage;
          console.log(chalk.yellow(`\n[${index + 1}] Message:`));
          console.log(`  Role: ${message.role}`);
          console.log(`  Status: ${message.status}`);
          
          if (message.content) {
            message.content.forEach(content => {
              if ('text' in content && content.text) {
                console.log(`  Text: ${content.text}`);
              }
            });
          }
        }
      });
    }

    // Display the main output text
    if (response.output_text) {
      console.log(chalk.bold('\nASSISTANT RESPONSE:'));
      console.log(response.output_text);
    }

    // Handle tool calls
    this.parseToolCalls(response);
  }

  /**
   * Check if a response contains function calls
   */
  private checkForFunctionCalls(response: Response): boolean {
    if (!response.output) return false;

    const toolCalls = response.output.filter(item => 
      item.type === 'function_call' || 
      item.type === 'file_search_call' || 
      item.type === 'web_search_call' ||
      item.type === 'computer_call' ||
      item.type === 'code_interpreter_call'
    );

    // Also check for tool_use in message content
    let hasToolUse = false;
    response.output.forEach((item: any) => {
      if (item.type === 'message' && item.content) {
        if (Array.isArray(item.content)) {
          item.content.forEach((content: any) => {
            if (content.type === 'tool_use') {
              hasToolUse = true;
            }
          });
        }
      }
    });

    return toolCalls.length > 0 || hasToolUse;
  }

  private parseToolCalls(response: Response) {
    if (!response.output) return;

    const toolCalls = response.output.filter(item => 
      item.type === 'function_call' || 
      item.type === 'file_search_call' || 
      item.type === 'web_search_call' ||
      item.type === 'computer_call' ||
      item.type === 'code_interpreter_call'
    );

    if (toolCalls.length === 0) return;

    console.log(chalk.bold('\nTOOL CALLS:'));
    
    toolCalls.forEach((toolCall, idx) => {
      console.log(chalk.cyan(`\n[${idx + 1}] ${toolCall.type}`));
      
      // Handle function calls specifically
      if (toolCall.type === 'function_call') {
        const functionCall = toolCall as any; // Type assertion since ResponseFunctionToolCall is complex
        console.log(`  Function: ${functionCall.name}`);
        console.log(`  Arguments: ${functionCall.arguments}`);
        
        try {
          const args = JSON.parse(functionCall.arguments);
          console.log(`  Parsed:`, args);
          
          // Runtime validation with Zod
          const validator = toolValidators[functionCall.name];
          if (validator) {
            try {
              const validated = validator.parse(args);
              console.log(chalk.green('  ✓ Validated successfully'));
              console.log(`  Validated args:`, validated);
            } catch (validationError) {
              if (validationError instanceof z.ZodError) {
                console.log(chalk.red('  ✗ Validation failed:'));
                validationError.errors.forEach(err => {
                  console.log(chalk.red(`    - ${err.path.join('.')}: ${err.message}`));
                });
              }
            }
          } else {
            console.log(chalk.dim('  No validator available for this function'));
          }
        } catch (e) {
          console.log(chalk.red('  Failed to parse arguments as JSON'));
        }
      }
    });
  }

  private handleError(error: any) {
    console.log(chalk.red('\n' + '═'.repeat(80)));
    console.log(chalk.red.bold('ERROR OCCURRED'));
    console.log(chalk.red('═'.repeat(80)));
    
    if (error.status) {
      console.log(chalk.red('Status Code:'), error.status);
      
      switch (error.status) {
        case 404:
          console.log(chalk.yellow('The Responses API endpoint was not found.'));
          console.log(chalk.yellow('Note: GPT-5 models may still be rolling out.'));
          break;
        case 401:
          console.log(chalk.red('Authentication failed. Check your API key.'));
          break;
        case 429:
          console.log(chalk.yellow('Rate limit exceeded. Please wait before retrying.'));
          break;
        case 400:
          console.log(chalk.red('Bad request. Check your parameters.'));
          break;
      }
    }
    
    if (error.message) {
      console.log(chalk.red('Message:'), error.message);
    }
    
    if (this.config.verbose && error.response) {
      console.log(chalk.dim('\nError Response:'));
      console.log(JSON.stringify(error.response, null, 2));
    }
  }

  async interactiveMode() {
    console.log(chalk.bold('\n' + '═'.repeat(80)));
    console.log(chalk.bold('OpenAI Responses API - Complete Test Console'));
    console.log(chalk.bold('═'.repeat(80)));
    console.log('\nThis console uses the ACTUAL Responses API with full feature support.');
    console.log('Server-side conversation management via previous_response_id.\n');
    
    console.log(chalk.bold('Commands:'));
    console.log(`  ${chalk.cyan('/tools')}       - Enable all tools for next message`);
    console.log(`  ${chalk.cyan('/model <name>')} - Switch model (gpt-5, gpt-5-mini, gpt-5-nano)`);
    console.log(`  ${chalk.cyan('/reasoning <level>')} - Set reasoning effort (low, medium, high)`);
    console.log(`  ${chalk.cyan('/stream')}      - Toggle streaming mode`);
    console.log(`  ${chalk.cyan('/structured')}  - Toggle structured output`);
    console.log(`  ${chalk.cyan('/verbose')}     - Toggle verbose output`);
    console.log(`  ${chalk.cyan('/clear')}       - Start new conversation`);
    console.log(`  ${chalk.cyan('/reset')}       - Reset response ID only (keep history)`);
    console.log(`  ${chalk.cyan('/history')}     - Show conversation history`);
    console.log(`  ${chalk.cyan('/session')}     - Show session info`);
    console.log(`  ${chalk.cyan('/skiptest')}    - Test skip-back strategy with function calls`);
    console.log(`  ${chalk.cyan('/examples')}    - Run example conversations`);
    console.log(`  ${chalk.cyan('/test')}        - Run comprehensive test series`);
    console.log(`  ${chalk.cyan('/help')}        - Show this help`);
    console.log(`  ${chalk.cyan('/exit')}        - Exit program`);
    console.log(`\nOr just type your message to send to OpenAI.\n`);

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const input = line.trim();
      
      // Prevent concurrent command processing
      if (this.processingCommand) {
        console.log(chalk.yellow('Still processing previous command, please wait...'));
        return;
      }

      this.processingCommand = true;

      try {
        if (input.startsWith('/')) {
          await this.handleCommand(input);
        } else if (input) {
          await this.callResponsesAPI(input, this.config);
        }
      } catch (error) {
        console.error(chalk.red('Error processing command:'), error);
      } finally {
        this.processingCommand = false;
        this.rl.prompt();
      }
    });
  }

  private async handleCommand(input: string) {
    const [command, ...args] = input.split(' ');
    
    switch (command) {
      case '/exit':
        console.log(chalk.yellow('\nGoodbye!'));
        if (this.redisClient) {
          await this.redisClient.quit();
        }
        this.rl.close();
        process.exit(0);
        break;

      case '/clear':
        this.sessionData = {
          lastResponseId: null,
          conversationHistory: [],
          metadata: {}
        };
        await this.saveSession();
        console.log(chalk.green('✓ Started new conversation'));
        break;
        
      case '/reset':
        // Just reset the response ID, keep history
        this.sessionData.lastResponseId = null;
        await this.saveSession();
        console.log(chalk.green('✓ Response ID reset (history preserved)'));
        console.log(chalk.dim('Use this if you encounter streaming errors with function calls'));
        break;

      case '/history':
        this.showHistory();
        break;

      case '/session':
        this.showSessionInfo();
        break;

      case '/tools':
        this.config.useTools = !this.config.useTools;
        console.log(chalk.green(`Tools ${this.config.useTools ? 'enabled' : 'disabled'}`));
        break;

      case '/stream':
        this.config.streaming = !this.config.streaming;
        console.log(chalk.green(`Streaming ${this.config.streaming ? 'enabled' : 'disabled'}`));
        break;

      case '/structured':
        this.config.structuredOutput = !this.config.structuredOutput;
        console.log(chalk.green(`Structured output ${this.config.structuredOutput ? 'enabled' : 'disabled'}`));
        break;

      case '/verbose':
        this.config.verbose = !this.config.verbose;
        console.log(chalk.green(`Verbose mode ${this.config.verbose ? 'on' : 'off'}`));
        break;

      case '/model':
        if (args[0] && ['gpt-5', 'gpt-5-mini', 'gpt-5-nano'].includes(args[0])) {
          this.config.model = args[0] as any;
          console.log(chalk.green(`Model set to: ${this.config.model}`));
        } else {
          console.log(chalk.yellow('Usage: /model <gpt-5|gpt-5-mini|gpt-5-nano>'));
        }
        break;

      case '/reasoning':
        if (args[0] && ['low', 'medium', 'high'].includes(args[0])) {
          this.config.reasoning.effort = args[0] as any;
          console.log(chalk.green(`Reasoning effort set to: ${this.config.reasoning.effort}`));
        } else {
          console.log(chalk.yellow('Usage: /reasoning <low|medium|high>'));
        }
        break;

      case '/examples':
        await this.runExamples();
        break;

      case '/test':
        await this.runTestSeries();
        break;

      case '/skiptest':
        await this.runSkipBackTest();
        break;

      case '/help':
        this.showHelp();
        break;

      default:
        console.log(chalk.red(`Unknown command: ${command}`));
    }
  }

  private showHistory() {
    if (this.sessionData.conversationHistory.length === 0) {
      console.log(chalk.yellow('No conversation history yet.'));
      return;
    }

    console.log(chalk.bold('\nCONVERSATION HISTORY:'));
    this.sessionData.conversationHistory.forEach((entry, idx) => {
      console.log(chalk.cyan(`\n[${idx + 1}] ${entry.timestamp}`));
      console.log(`  Model: ${entry.model}`);
      console.log(`  Response ID: ${entry.responseId}`);
      if (entry.hadFunctionCall) {
        console.log(chalk.yellow(`  ⚡ Had Function Calls`));
      }
      console.log(`  Input: ${entry.input.substring(0, 100)}...`);
      console.log(`  Output: ${entry.output.substring(0, 100)}...`);
      if (entry.usage) {
        console.log(`  Tokens: ${entry.usage.total_tokens}`);
      }
    });
  }

  private showSessionInfo() {
    console.log(chalk.bold('\nSESSION INFO:'));
    console.log(chalk.cyan('Response ID:'), this.sessionData.lastResponseId || 'None');
    console.log(chalk.cyan('History:'), `${this.sessionData.conversationHistory.length} messages`);
    console.log(chalk.cyan('Model:'), this.config.model);
    console.log(chalk.cyan('Reasoning:'), this.config.reasoning.effort);
    console.log(chalk.cyan('Tools:'), this.config.useTools ? 'Enabled' : 'Disabled');
    console.log(chalk.cyan('Streaming:'), this.config.streaming ? 'Enabled' : 'Disabled');
    console.log(chalk.cyan('Structured:'), this.config.structuredOutput ? 'Enabled' : 'Disabled');
    console.log(chalk.cyan('Redis:'), this.redisClient ? 'Connected' : 'Not available');
  }

  private showHelp() {
    console.log(chalk.bold('\nAVAILABLE OPTIONS:'));
    console.log('\nModels:');
    console.log('  • gpt-5      - Full model with maximum capabilities');
    console.log('  • gpt-5-mini - Balanced performance and cost');
    console.log('  • gpt-5-nano - Fastest, most economical');
    console.log('\nReasoning Levels:');
    console.log('  • low    - Quick responses, minimal reasoning');
    console.log('  • medium - Balanced reasoning (default)');
    console.log('  • high   - Deep reasoning, more thoughtful');
    console.log('\nFeatures:');
    console.log('  • Streaming      - Real-time token streaming');
    console.log('  • Tools          - Function calling and built-in tools');
    console.log('  • Structured     - JSON schema-validated outputs');
    console.log('  • Redis Session  - Persistent conversation storage');
  }

  async runExamples() {
    console.log(chalk.bold('\nRunning Comprehensive Examples...\n'));

    // Example 1: Basic conversation
    console.log(chalk.yellow('Example 1: Starting conversation with memory'));
    await this.callResponsesAPI(
      "Hello! My name is David and I'm interested in jazz music. Please remember this.",
      { verbose: false }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 2: Test memory
    console.log(chalk.yellow('\nExample 2: Testing server-side memory'));
    await this.callResponsesAPI(
      "What's my name and what music do I like?",
      { verbose: false }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 3: With tools
    console.log(chalk.yellow('\nExample 3: Using tools (web search)'));
    await this.callResponsesAPI(
      "Search for the latest news about jazz festivals in 2025",
      { useTools: true, verbose: false }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 4: High reasoning
    console.log(chalk.yellow('\nExample 4: High reasoning effort'));
    await this.callResponsesAPI(
      "Explain the musical evolution from bebop to modern jazz",
      { reasoning: { effort: 'high' as const }, verbose: false }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 5: Different model
    console.log(chalk.yellow('\nExample 5: Using different model (gpt-5)'));
    await this.callResponsesAPI(
      "Compose a haiku about artificial intelligence",
      { model: 'gpt-5' as const, verbose: false }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 6: Music alternatives (rejection scenario)
    console.log(chalk.yellow('\nExample 6: Music alternatives with emoji labels'));
    await this.callResponsesAPI(
      "I don't like Phoebe Bridgers, play something else",
      { useTools: true, verbose: false }
    );
  }

  async runSkipBackTest() {
    console.log(chalk.bold('\n🔬 Testing Skip-Back Strategy for Function Calls...\n'));
    console.log(chalk.dim('This test demonstrates how we maintain conversation continuity'));
    console.log(chalk.dim('by skipping back to the last response without function calls.\n'));

    const tests = [
      {
        name: 'Step 1: Start conversation (no function call)',
        input: 'Hello! My name is David and I love jazz music.',
        expectFunctionCall: false
      },
      {
        name: 'Step 2: Continue conversation (no function call)',
        input: 'Tell me about Miles Davis.',
        expectFunctionCall: false
      },
      {
        name: 'Step 3: Trigger function call',
        input: "I don't like that song, play something else please",
        expectFunctionCall: true
      },
      {
        name: 'Step 4: Test continuity (should skip back to Step 2)',
        input: 'What was I asking about before?',
        expectFunctionCall: false
      },
      {
        name: 'Step 5: Another function call',
        input: 'Actually, different music please',
        expectFunctionCall: true
      },
      {
        name: 'Step 6: Test memory (should remember Miles Davis from Step 2)',
        input: 'You were telling me about that jazz musician?',
        expectFunctionCall: false
      }
    ];

    for (const test of tests) {
      console.log(chalk.yellow(`\n📝 ${test.name}`));
      if (test.expectFunctionCall) {
        console.log(chalk.dim('  Expected: Function call (will not affect continuity)'));
      } else {
        console.log(chalk.dim('  Expected: Text response (will be used for continuity)'));
      }
      
      await this.callResponsesAPI(test.input, { 
        useTools: true,
        streaming: true 
      });
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(chalk.green.bold('\n✅ Skip-back test complete!'));
    console.log(chalk.dim('\nUse /history to see how responses were linked'));
  }

  async runTestSeries() {
    console.log(chalk.bold('\n🧪 Running Comprehensive Test Series...\n'));

    const tests = [
      {
        name: 'Basic Conversation',
        input: 'Hello! My name is David. Remember this for our conversation.',
        config: {}
      },
      {
        name: 'Memory Test',
        input: 'What is my name?',
        config: {}
      },
      {
        name: 'Streaming Test',
        input: 'Count from 1 to 5 slowly.',
        config: { streaming: true }
      },
      {
        name: 'Tool Usage',
        input: 'What\'s the weather in San Francisco?',
        config: { useTools: true }
      },
      {
        name: 'High Reasoning',
        input: 'Explain the implications of quantum computing on cryptography.',
        config: { reasoning: { effort: 'high' as const } }
      },
      {
        name: 'Structured Output',
        input: 'What is the capital of France?',
        config: { structuredOutput: true }
      },
      {
        name: 'Code Generation',
        input: 'Write a TypeScript function to validate email addresses.',
        config: { useTools: true }
      },
      {
        name: 'Web Search',
        input: 'What are the latest developments in AI as of 2025?',
        config: { useTools: true }
      },
      {
        name: 'Music Alternatives (Rejection)',
        input: 'Not this song, I want something different from Taylor Swift',
        config: { useTools: true }
      }
    ];

    for (const test of tests) {
      console.log(chalk.yellow(`\n📝 Test: ${test.name}`));
      await this.callResponsesAPI(test.input, test.config);
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(chalk.green.bold('\n✅ Test series complete!'));
  }
}

// Main execution
async function main() {
  const tester = new GPT5ResponsesAPITester();
  
  // CRITICAL: Wait for initialization to complete before proceeding
  // This ensures Redis and session are fully loaded
  await tester.initializePromise;

  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--examples')) {
    await tester.runExamples();
    process.exit(0);
  }

  if (args.includes('--test')) {
    await tester.runTestSeries();
    process.exit(0);
  }

  if (args.includes('--help')) {
    console.log('\nUsage: node test-responses-api-gpt5.js [options]');
    console.log('\nOptions:');
    console.log('  --examples    Run example conversations');
    console.log('  --test        Run comprehensive test series');
    console.log('  --stream      Use streaming mode');
    console.log('  --tools       Enable tools');
    console.log('  --verbose     Verbose output');
    console.log('  --help        Show this help message');
    console.log('  <message>     Send a single message');
    console.log('\nWithout options, starts interactive mode.');
    process.exit(0);
  }

  // Single message mode
  if (args.length > 0 && !args[0].startsWith('--')) {
    const message = args.join(' ');
    const config: Partial<TestConfig> = {
      streaming: args.includes('--stream'),
      useTools: args.includes('--tools'),
      verbose: args.includes('--verbose'),
      model: (process.env.MODEL as any) || 'gpt-5-nano'
    };
    await tester.callResponsesAPI(message, config);
    process.exit(0);
  }

  // Interactive mode
  await tester.interactiveMode();
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error(chalk.red.bold('Unhandled Promise Rejection:'), error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nGracefully shutting down...'));
  process.exit(0);
});

// Run the application
main().catch((error) => {
  console.error(chalk.red.bold('Fatal error:'), error);
  process.exit(1);
});