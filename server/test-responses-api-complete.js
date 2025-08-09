#!/usr/bin/env node

/**
 * COMPLETE & ACCURATE OpenAI Responses API Test Script
 * Based on the ACTUAL API documentation from OpenAI Node.js SDK
 * 
 * Key Facts from Documentation:
 * - Responses API uses `store: true` for server-side conversation storage
 * - Uses `previous_response_id` for conversation continuity
 * - Response structure includes `output` array with items
 * - Usage tokens: `input_tokens`, `output_tokens` (NOT prompt/completion)
 * - Reasoning tokens nested in `output_tokens_details.reasoning_tokens`
 * - Built-in tools include `web_search`, `code_interpreter`, `file_search`
 * - Models: gpt-5, gpt-5-mini, gpt-5-nano (as of 2025)
 */

require('dotenv').config();
const OpenAI = require('openai');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Colors for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Session file to persist response IDs between runs
const SESSION_FILE = path.join(__dirname, '.responses-session.json');

class CompleteResponsesAPITester {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.error(`${colors.red}ERROR: OPENAI_API_KEY not found in .env file${colors.reset}`);
      console.log('Please add OPENAI_API_KEY=your-key-here to your .env file');
      process.exit(1);
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.lastResponseId = null;
    this.loadSession();

    // Setup readline for interactive input
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.cyan}> ${colors.reset}`
    });
  }

  loadSession() {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        this.lastResponseId = session.lastResponseId;
        console.log(`${colors.green}✓ Loaded previous session${colors.reset}`);
        console.log(`${colors.dim}  Last Response ID: ${this.lastResponseId}${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.yellow}Starting fresh session${colors.reset}`);
    }
  }

  saveSession() {
    try {
      fs.writeFileSync(SESSION_FILE, JSON.stringify({
        lastResponseId: this.lastResponseId,
        timestamp: new Date().toISOString()
      }, null, 2));
    } catch (error) {
      console.error(`${colors.red}Failed to save session:${colors.reset}`, error.message);
    }
  }

  async callResponsesAPI(input, options = {}) {
    console.log(`\n${colors.blue}${'═'.repeat(80)}${colors.reset}`);
    console.log(`${colors.bright}CALLING OPENAI RESPONSES API${colors.reset}`);
    console.log(`${colors.blue}${'═'.repeat(80)}${colors.reset}`);

    // Build request based on actual API spec
    const requestBody = {
      model: options.model || "gpt-5-mini", // gpt-5, gpt-5-mini, gpt-5-nano
      input: input,
      store: true, // Server-side conversation storage
      
      // Optional parameters from documentation
      instructions: options.instructions || null,
      max_output_tokens: options.max_output_tokens || null,
      max_tool_calls: options.max_tool_calls || null,
      temperature: options.temperature || 1,
      top_p: options.top_p || 1,
      
      // Reasoning configuration
      reasoning: {
        effort: options.reasoning_effort || "medium" // low, medium, high
      },
      
      // Text output configuration
      text: {
        format: {
          type: "text"
        },
        verbosity: options.verbosity || "medium" // low, medium, high
      },
      
      // Tool configuration
      tool_choice: options.tool_choice || "auto",
      parallel_tool_calls: true,
      
      // Truncation strategy for long conversations
      truncation: options.truncation || "disabled"
    };

    // Add previous_response_id for conversation continuity
    if (this.lastResponseId) {
      requestBody.previous_response_id = this.lastResponseId;
      console.log(`${colors.yellow}Continuing from: ${this.lastResponseId}${colors.reset}`);
    }

    // Add tools if requested
    if (options.useTools) {
      requestBody.tools = [
        // Custom function tools
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get current weather for a location",
            parameters: {
              type: "object",
              properties: {
                location: { 
                  type: "string", 
                  description: "City and state, e.g. San Francisco, CA" 
                },
                unit: { 
                  type: "string", 
                  enum: ["celsius", "fahrenheit"],
                  default: "celsius"
                }
              },
              required: ["location"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "search_music",
            description: "Search for music tracks or artists",
            parameters: {
              type: "object",
              properties: {
                query: { 
                  type: "string", 
                  description: "Artist name, song title, or genre" 
                },
                type: { 
                  type: "string", 
                  enum: ["track", "artist", "album", "playlist"],
                  default: "track"
                },
                limit: {
                  type: "number",
                  default: 10,
                  minimum: 1,
                  maximum: 50
                }
              },
              required: ["query"]
            }
          }
        },
        // Built-in tools from Responses API
        { type: "web_search" },     // Web search capability
        { type: "code_interpreter" }, // Code execution
        { type: "file_search" }      // File search
      ];
    }

    // Add metadata if provided
    if (options.metadata) {
      requestBody.metadata = options.metadata;
    }

    console.log(`${colors.dim}Request Parameters:${colors.reset}`);
    console.log(JSON.stringify(requestBody, null, 2));

    try {
      console.log(`\n${colors.yellow}⏳ Calling OpenAI Responses API...${colors.reset}`);
      const startTime = Date.now();

      // Call the ACTUAL Responses API
      const response = await this.openai.responses.create(requestBody);
      
      const duration = Date.now() - startTime;

      console.log(`\n${colors.green}${'═'.repeat(80)}${colors.reset}`);
      console.log(`${colors.bright}RESPONSE RECEIVED (${duration}ms)${colors.reset}`);
      console.log(`${colors.green}${'═'.repeat(80)}${colors.reset}`);

      // Log full response for transparency
      if (options.verbose) {
        console.log(`${colors.dim}Full Response Object:${colors.reset}`);
        console.log(JSON.stringify(response, null, 2));
      }

      // Parse response structure based on actual API
      this.parseResponse(response);

      // Save response ID for continuity
      this.lastResponseId = response.id;
      this.saveSession();
      
      console.log(`\n${colors.green}✓ Session saved with ID: ${response.id}${colors.reset}`);

      return response;

    } catch (error) {
      this.handleError(error);
    }
  }

  parseResponse(response) {
    console.log(`\n${colors.bright}RESPONSE DETAILS:${colors.reset}`);
    console.log(`${colors.cyan}ID:${colors.reset} ${response.id}`);
    console.log(`${colors.cyan}Object:${colors.reset} ${response.object}`);
    console.log(`${colors.cyan}Model:${colors.reset} ${response.model}`);
    console.log(`${colors.cyan}Status:${colors.reset} ${response.status}`);
    
    // Timestamp handling
    if (response.created_at) {
      const date = new Date(response.created_at * 1000);
      console.log(`${colors.cyan}Created:${colors.reset} ${date.toISOString()}`);
    }

    // Usage information (correct field names from API)
    if (response.usage) {
      console.log(`\n${colors.bright}TOKEN USAGE:${colors.reset}`);
      console.log(`  Input tokens: ${response.usage.input_tokens || 0}`);
      console.log(`  Output tokens: ${response.usage.output_tokens || 0}`);
      console.log(`  Total tokens: ${response.usage.total_tokens || 0}`);
      
      // Detailed token breakdown
      if (response.usage.input_tokens_details) {
        console.log(`  Input details:`);
        if (response.usage.input_tokens_details.cached_tokens) {
          console.log(`    Cached: ${response.usage.input_tokens_details.cached_tokens}`);
        }
      }
      
      if (response.usage.output_tokens_details) {
        console.log(`  Output details:`);
        if (response.usage.output_tokens_details.reasoning_tokens) {
          console.log(`    Reasoning: ${response.usage.output_tokens_details.reasoning_tokens}`);
        }
      }
    }

    // Parse output array (actual API structure)
    if (response.output && Array.isArray(response.output)) {
      console.log(`\n${colors.bright}OUTPUT ITEMS (${response.output.length}):${colors.reset}`);
      
      response.output.forEach((item, index) => {
        console.log(`\n${colors.yellow}[${index + 1}] Type: ${item.type}${colors.reset}`);
        
        switch (item.type) {
          case 'reasoning':
            console.log(`  ID: ${item.id}`);
            if (item.summary && item.summary.length > 0) {
              console.log(`  Summary: ${item.summary.join(' ')}`);
            }
            break;
            
          case 'message':
            console.log(`  ID: ${item.id}`);
            console.log(`  Role: ${item.role}`);
            console.log(`  Status: ${item.status}`);
            
            if (item.content && Array.isArray(item.content)) {
              item.content.forEach(content => {
                if (content.type === 'output_text') {
                  console.log(`  Text: ${content.text}`);
                }
              });
            }
            break;
            
          default:
            console.log(`  Unknown item type: ${JSON.stringify(item)}`);
        }
      });
    }

    // Direct output_text field (convenience field)
    if (response.output_text) {
      console.log(`\n${colors.bright}ASSISTANT RESPONSE:${colors.reset}`);
      console.log(response.output_text);
    }

    // Handle tool calls if present
    if (response.output) {
      response.output.forEach(item => {
        if (item.type === 'message' && item.content) {
          item.content.forEach(content => {
            if (content.tool_calls && content.tool_calls.length > 0) {
              console.log(`\n${colors.bright}TOOL CALLS:${colors.reset}`);
              content.tool_calls.forEach((toolCall, idx) => {
                console.log(`\n${colors.yellow}[${idx + 1}] ${toolCall.type}${colors.reset}`);
                if (toolCall.function) {
                  console.log(`  Function: ${toolCall.function.name}`);
                  console.log(`  Arguments: ${toolCall.function.arguments}`);
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`  Parsed:`, args);
                  } catch (e) {
                    // Arguments might not be JSON
                  }
                }
              });
            }
          });
        }
      });
    }

    // Reasoning information
    if (response.reasoning) {
      console.log(`\n${colors.bright}REASONING:${colors.reset}`);
      console.log(`  Effort: ${response.reasoning.effort}`);
      if (response.reasoning.summary) {
        console.log(`  Summary: ${response.reasoning.summary}`);
      }
      if (response.reasoning.content) {
        console.log(`  Content: ${response.reasoning.content}`);
      }
    }

    // Additional metadata
    if (response.metadata && Object.keys(response.metadata).length > 0) {
      console.log(`\n${colors.bright}METADATA:${colors.reset}`);
      console.log(JSON.stringify(response.metadata, null, 2));
    }

    // Service tier and other info
    if (response.service_tier) {
      console.log(`\n${colors.dim}Service Tier: ${response.service_tier}${colors.reset}`);
    }
  }

  handleError(error) {
    console.log(`\n${colors.red}${'═'.repeat(80)}${colors.reset}`);
    console.log(`${colors.red}ERROR OCCURRED${colors.reset}`);
    console.log(`${colors.red}${'═'.repeat(80)}${colors.reset}`);
    
    // Check for specific error types
    if (error.status) {
      console.log(`${colors.red}Status Code:${colors.reset} ${error.status}`);
      
      switch (error.status) {
        case 404:
          console.log(`${colors.yellow}The Responses API endpoint was not found.${colors.reset}`);
          console.log(`${colors.yellow}Note: The Responses API may still be rolling out.${colors.reset}`);
          break;
        case 401:
          console.log(`${colors.red}Authentication failed. Check your API key.${colors.reset}`);
          break;
        case 429:
          console.log(`${colors.yellow}Rate limit exceeded. Please wait before retrying.${colors.reset}`);
          break;
        case 400:
          console.log(`${colors.red}Bad request. Check your parameters.${colors.reset}`);
          break;
        default:
          console.log(`${colors.red}HTTP Error ${error.status}${colors.reset}`);
      }
    }
    
    if (error.message) {
      console.log(`${colors.red}Message:${colors.reset} ${error.message}`);
    }
    
    if (error.response) {
      console.log(`\n${colors.dim}Error Response:${colors.reset}`);
      console.log(JSON.stringify(error.response, null, 2));
    }
    
    // Log full error in verbose mode
    if (process.env.DEBUG) {
      console.log(`\n${colors.dim}Full Error:${colors.reset}`);
      console.error(error);
    }
  }

  async interactiveMode() {
    console.log(`\n${colors.bright}${'═'.repeat(80)}${colors.reset}`);
    console.log(`${colors.bright}OpenAI Responses API - Complete Test Console${colors.reset}`);
    console.log(`${colors.bright}${'═'.repeat(80)}${colors.reset}`);
    console.log('\nThis console uses the ACTUAL Responses API with full feature support.');
    console.log('Server-side conversation management via previous_response_id.\n');
    
    console.log(`${colors.bright}Commands:${colors.reset}`);
    console.log(`  ${colors.cyan}/tools${colors.reset}       - Enable all tools for next message`);
    console.log(`  ${colors.cyan}/model <name>${colors.reset} - Switch model (gpt-5, gpt-5-mini, gpt-5-nano)`);
    console.log(`  ${colors.cyan}/reasoning <level>${colors.reset} - Set reasoning effort (low, medium, high)`);
    console.log(`  ${colors.cyan}/verbose${colors.reset}     - Toggle verbose output`);
    console.log(`  ${colors.cyan}/clear${colors.reset}       - Start new conversation`);
    console.log(`  ${colors.cyan}/session${colors.reset}     - Show session info`);
    console.log(`  ${colors.cyan}/help${colors.reset}        - Show this help`);
    console.log(`  ${colors.cyan}/exit${colors.reset}        - Exit program`);
    console.log(`\nOr just type your message to send to OpenAI.\n`);

    // Configuration state
    this.config = {
      model: "gpt-5-mini",
      reasoning_effort: "medium",
      verbose: false,
      useTools: false
    };

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const input = line.trim();

      // Handle commands
      if (input.startsWith('/')) {
        const [command, ...args] = input.split(' ');
        
        switch (command) {
          case '/exit':
            console.log(`\n${colors.yellow}Goodbye!${colors.reset}`);
            this.rl.close();
            process.exit(0);
            break;

          case '/clear':
            this.lastResponseId = null;
            this.saveSession();
            console.log(`${colors.green}✓ Started new conversation${colors.reset}`);
            break;

          case '/session':
            console.log(`\n${colors.bright}SESSION INFO:${colors.reset}`);
            console.log(`${colors.cyan}Response ID:${colors.reset} ${this.lastResponseId || 'None (new conversation)'}`);
            console.log(`${colors.cyan}Model:${colors.reset} ${this.config.model}`);
            console.log(`${colors.cyan}Reasoning:${colors.reset} ${this.config.reasoning_effort}`);
            console.log(`${colors.cyan}Tools:${colors.reset} ${this.config.useTools ? 'Enabled' : 'Disabled'}`);
            console.log(`${colors.cyan}Verbose:${colors.reset} ${this.config.verbose ? 'On' : 'Off'}`);
            break;

          case '/tools':
            this.config.useTools = !this.config.useTools;
            console.log(`${colors.green}Tools ${this.config.useTools ? 'enabled' : 'disabled'}${colors.reset}`);
            break;

          case '/verbose':
            this.config.verbose = !this.config.verbose;
            console.log(`${colors.green}Verbose mode ${this.config.verbose ? 'on' : 'off'}${colors.reset}`);
            break;

          case '/model':
            if (args[0]) {
              this.config.model = args[0];
              console.log(`${colors.green}Model set to: ${this.config.model}${colors.reset}`);
            } else {
              console.log(`${colors.yellow}Usage: /model <gpt-5|gpt-5-mini|gpt-5-nano>${colors.reset}`);
            }
            break;

          case '/reasoning':
            if (args[0] && ['low', 'medium', 'high'].includes(args[0])) {
              this.config.reasoning_effort = args[0];
              console.log(`${colors.green}Reasoning effort set to: ${this.config.reasoning_effort}${colors.reset}`);
            } else {
              console.log(`${colors.yellow}Usage: /reasoning <low|medium|high>${colors.reset}`);
            }
            break;

          case '/help':
            this.showHelp();
            break;

          default:
            console.log(`${colors.red}Unknown command: ${command}${colors.reset}`);
        }
      } else if (input) {
        // Send message to API
        await this.callResponsesAPI(input, this.config);
      }

      this.rl.prompt();
    });
  }

  showHelp() {
    console.log(`\n${colors.bright}AVAILABLE OPTIONS:${colors.reset}`);
    console.log('\nModels:');
    console.log('  • gpt-5      - Full model with maximum capabilities');
    console.log('  • gpt-5-mini - Balanced performance and cost');
    console.log('  • gpt-5-nano - Fastest, most economical');
    console.log('\nReasoning Levels:');
    console.log('  • low    - Quick responses, minimal reasoning');
    console.log('  • medium - Balanced reasoning (default)');
    console.log('  • high   - Deep reasoning, more thoughtful');
    console.log('\nBuilt-in Tools:');
    console.log('  • web_search       - Search the internet');
    console.log('  • code_interpreter - Execute code');
    console.log('  • file_search      - Search files');
    console.log('  • Custom functions - Weather, music search');
  }

  async runExamples() {
    console.log(`\n${colors.bright}Running Comprehensive Examples...${colors.reset}\n`);

    // Example 1: Basic conversation
    console.log(`${colors.yellow}Example 1: Starting conversation with memory${colors.reset}`);
    await this.callResponsesAPI(
      "Hello! My name is David and I'm interested in jazz music. Please remember this.",
      { verbose: false }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 2: Test memory
    console.log(`\n${colors.yellow}Example 2: Testing server-side memory${colors.reset}`);
    await this.callResponsesAPI(
      "What's my name and what music do I like?",
      { verbose: false }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 3: With tools
    console.log(`\n${colors.yellow}Example 3: Using tools (web search)${colors.reset}`);
    await this.callResponsesAPI(
      "Search for the latest news about jazz festivals in 2025",
      { useTools: true, verbose: false }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 4: High reasoning
    console.log(`\n${colors.yellow}Example 4: High reasoning effort${colors.reset}`);
    await this.callResponsesAPI(
      "Explain the musical evolution from bebop to modern jazz",
      { reasoning_effort: "high", verbose: false }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 5: Different model
    console.log(`\n${colors.yellow}Example 5: Using different model (gpt-5)${colors.reset}`);
    await this.callResponsesAPI(
      "Compose a haiku about artificial intelligence",
      { model: "gpt-5", verbose: false }
    );
  }
}

// Main execution
async function main() {
  const tester = new CompleteResponsesAPITester();

  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--examples')) {
    await tester.runExamples();
    process.exit(0);
  }

  if (args.includes('--help')) {
    console.log('\nUsage: node test-responses-api-complete.js [options]');
    console.log('\nOptions:');
    console.log('  --examples    Run example conversations');
    console.log('  --help        Show this help message');
    console.log('  <message>     Send a single message');
    console.log('\nWithout options, starts interactive mode.');
    process.exit(0);
  }

  if (args.length > 0 && !args[0].startsWith('--')) {
    // Single message mode
    const message = args.join(' ');
    const options = {
      useTools: args.includes('--tools'),
      verbose: args.includes('--verbose'),
      model: process.env.MODEL || "gpt-5-mini"
    };
    await tester.callResponsesAPI(message, options);
    process.exit(0);
  }

  // Interactive mode
  await tester.interactiveMode();
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});