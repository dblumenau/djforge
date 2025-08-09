#!/usr/bin/env node

/**
 * REAL OpenAI Responses API Test Script
 * Using the ACTUAL Responses API with server-side conversation management
 * 
 * The Responses API maintains conversation state on OpenAI's servers
 * using previous_response_id - NO manual message history needed!
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
const SESSION_FILE = path.join(__dirname, '.responses-session-real.json');

class RealResponsesAPITester {
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

  async callResponsesAPI(input, useTools = false) {
    console.log(`\n${colors.blue}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}CALLING RESPONSES API:${colors.reset}`);
    console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}`);

    const requestBody = {
      model: "gpt-5-mini", // or gpt-5, gpt-5-nano
      input: input,
      store: true  // This tells OpenAI to store the conversation!
    };

    // If we have a previous response, include its ID
    // OpenAI handles ALL the context - we don't send messages!
    if (this.lastResponseId) {
      requestBody.previous_response_id = this.lastResponseId;
      console.log(`${colors.yellow}Continuing conversation from: ${this.lastResponseId}${colors.reset}`);
    }

    // Add tools if requested
    if (useTools) {
      requestBody.tools = [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get the current weather for a location",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string", description: "City name" },
                unit: { type: "string", enum: ["celsius", "fahrenheit"], default: "celsius" }
              },
              required: ["location"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "play_music",
            description: "Play a song or artist",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Song or artist name" },
                action: { type: "string", enum: ["play", "queue", "pause"], default: "play" }
              },
              required: ["query"]
            }
          }
        },
        { type: "web_search" }  // Built-in web search tool!
      ];
    }

    console.log(`${colors.dim}Request to Responses API:${colors.reset}`);
    console.log(JSON.stringify(requestBody, null, 2));

    try {
      console.log(`\n${colors.yellow}⏳ Calling OpenAI Responses API...${colors.reset}`);
      const startTime = Date.now();

      // Use the ACTUAL Responses API!
      const response = await this.openai.responses.create(requestBody);
      
      const duration = Date.now() - startTime;

      console.log(`\n${colors.green}${'═'.repeat(60)}${colors.reset}`);
      console.log(`${colors.bright}RESPONSE FROM OPENAI (${duration}ms):${colors.reset}`);
      console.log(`${colors.green}${'═'.repeat(60)}${colors.reset}`);
      console.log(`${colors.dim}Full Response:${colors.reset}`);
      console.log(JSON.stringify(response, null, 2));

      // Extract key information
      console.log(`\n${colors.bright}KEY INFORMATION:${colors.reset}`);
      console.log(`${colors.cyan}Response ID:${colors.reset} ${response.id}`);
      console.log(`${colors.cyan}Model:${colors.reset} ${response.model || 'Not specified'}`);
      if (response.created_at) {
        console.log(`${colors.cyan}Created:${colors.reset} ${new Date(response.created_at * 1000).toISOString()}`);
      }
      
      if (response.usage) {
        console.log(`${colors.cyan}Usage:${colors.reset}`);
        console.log(`  Input tokens: ${response.usage.input_tokens || 0}`);
        console.log(`  Output tokens: ${response.usage.output_tokens || 0}`);
        console.log(`  Total tokens: ${response.usage.total_tokens || 0}`);
        if (response.usage.output_tokens_details && response.usage.output_tokens_details.reasoning_tokens) {
          console.log(`  Reasoning tokens: ${response.usage.output_tokens_details.reasoning_tokens}`);
        }
      }

      // Handle the text output
      if (response.output_text) {
        console.log(`\n${colors.bright}ASSISTANT SAYS:${colors.reset}`);
        console.log(response.output_text);
      }

      // Handle tool calls
      if (response.output && response.output.tool_calls && response.output.tool_calls.length > 0) {
        console.log(`\n${colors.bright}TOOL CALLS:${colors.reset}`);
        for (const toolCall of response.output.tool_calls) {
          console.log(`${colors.yellow}Tool:${colors.reset} ${toolCall.function.name}`);
          console.log(`${colors.yellow}Arguments:${colors.reset} ${toolCall.function.arguments}`);
          
          // Parse and display arguments nicely
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`${colors.dim}Parsed:${colors.reset}`, args);
          } catch (e) {
            console.log(`${colors.red}Failed to parse arguments${colors.reset}`);
          }
        }
      }

      // Handle reasoning if present
      if (response.reasoning && response.reasoning.content) {
        console.log(`\n${colors.bright}REASONING:${colors.reset}`);
        console.log(`${colors.dim}${response.reasoning.content}${colors.reset}`);
      }

      // CRITICAL: Store the response ID for conversation continuity
      // OpenAI maintains the conversation on their servers!
      this.lastResponseId = response.id;
      this.saveSession();
      
      console.log(`\n${colors.green}✓ Response ID saved: ${response.id}${colors.reset}`);
      console.log(`${colors.green}OpenAI is maintaining the conversation context server-side!${colors.reset}`);

    } catch (error) {
      console.log(`\n${colors.red}${'═'.repeat(60)}${colors.reset}`);
      console.log(`${colors.red}ERROR:${colors.reset}`);
      console.log(`${colors.red}${'═'.repeat(60)}${colors.reset}`);
      
      if (error.response) {
        console.log(`${colors.red}Status:${colors.reset} ${error.response.status}`);
        console.log(`${colors.red}Headers:${colors.reset}`, error.response.headers);
        console.log(`${colors.red}Data:${colors.reset}`, error.response.data);
      } else if (error.message) {
        console.log(`${colors.red}Message:${colors.reset} ${error.message}`);
      } else {
        console.error(error);
      }

      // If it's a 404, the Responses API might not be available yet
      if (error.status === 404) {
        console.log(`\n${colors.yellow}Note: The Responses API might not be available yet.${colors.reset}`);
        console.log(`${colors.yellow}It was announced but may still be rolling out.${colors.reset}`);
        console.log(`${colors.yellow}Try using 'gpt-4o' with chat.completions for now.${colors.reset}`);
      }
    }
  }

  async interactiveMode() {
    console.log(`\n${colors.bright}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}REAL OpenAI Responses API Test Console${colors.reset}`);
    console.log(`${colors.bright}${'═'.repeat(60)}${colors.reset}`);
    console.log('\nThis uses the ACTUAL Responses API with server-side conversation management!');
    console.log('OpenAI maintains your conversation context - no manual history needed.\n');
    console.log('Commands:');
    console.log(`  ${colors.cyan}/tools${colors.reset}    - Enable tool calling in next request`);
    console.log(`  ${colors.cyan}/clear${colors.reset}    - Start a new conversation`);
    console.log(`  ${colors.cyan}/session${colors.reset}  - Show current session info`);
    console.log(`  ${colors.cyan}/exit${colors.reset}     - Exit the program`);
    console.log(`\nOr just type your message to send to OpenAI.\n`);

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const input = line.trim();

      if (input === '/exit') {
        console.log(`\n${colors.yellow}Goodbye!${colors.reset}`);
        this.rl.close();
        process.exit(0);
      }

      if (input === '/clear') {
        this.lastResponseId = null;
        this.saveSession();
        console.log(`${colors.green}✓ Starting new conversation${colors.reset}`);
        this.rl.prompt();
        return;
      }

      if (input === '/session') {
        console.log(`\n${colors.bright}SESSION INFO:${colors.reset}`);
        console.log(`${colors.cyan}Last Response ID:${colors.reset} ${this.lastResponseId || 'None (new conversation)'}`);
        console.log(`${colors.cyan}Session File:${colors.reset} ${SESSION_FILE}`);
        if (this.lastResponseId) {
          console.log(`${colors.green}Conversation is stored on OpenAI's servers!${colors.reset}`);
        }
        this.rl.prompt();
        return;
      }

      if (input.startsWith('/tools ')) {
        const message = input.substring(7);
        await this.callResponsesAPI(message, true);
        this.rl.prompt();
        return;
      }

      if (input === '/tools') {
        console.log(`${colors.yellow}Usage: /tools <your message>${colors.reset}`);
        console.log('Example: /tools What\'s the weather in Copenhagen?');
        console.log('Example: /tools Search the web for the latest on AI');
        this.rl.prompt();
        return;
      }

      if (input) {
        await this.callResponsesAPI(input, false);
      }

      this.rl.prompt();
    });
  }

  async runExamples() {
    console.log(`\n${colors.bright}Testing REAL Responses API conversation continuity...${colors.reset}\n`);

    // Example 1: Start conversation
    console.log(`${colors.yellow}Example 1: Starting conversation${colors.reset}`);
    await this.callResponsesAPI("Hello! My name is David and I love jazz music. Can you remember this?");

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 2: Test memory - OpenAI maintains context!
    console.log(`\n${colors.yellow}Example 2: Testing server-side memory${colors.reset}`);
    await this.callResponsesAPI("What's my name and what kind of music do I like?");

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 3: Continue conversation
    console.log(`\n${colors.yellow}Example 3: Continuing conversation${colors.reset}`);
    await this.callResponsesAPI("Can you recommend some jazz artists based on what you know about me?");

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 4: With tools and web search
    console.log(`\n${colors.yellow}Example 4: Using web search tool${colors.reset}`);
    await this.callResponsesAPI("Search for the latest jazz releases this week", true);
  }
}

// Main execution
async function main() {
  const tester = new RealResponsesAPITester();

  // Check for command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--examples')) {
    await tester.runExamples();
    process.exit(0);
  }

  if (args.length > 0 && !args[0].startsWith('--')) {
    // Single command mode
    const useTools = args.includes('--tools');
    await tester.callResponsesAPI(args.join(' ').replace('--tools', '').trim(), useTools);
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