#!/usr/bin/env npx tsx

/**
 * Test script for OpenAI Responses API with Web Search
 * Tests the web_search_preview built-in tool with streaming support
 */

import chalk from 'chalk';
import 'dotenv/config';
import OpenAI from 'openai';
import type { ResponseCreateParams, ResponseStreamEvent } from 'openai/resources/responses/responses';

async function testWebSearchWithStreaming() {
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log(chalk.cyan('🔍 Testing Web Search with GPT-5 Responses API (Streaming)\n'));

  try {
    // Test 1: Basic web search with streaming
    console.log(chalk.yellow('Test 1: Basic web search for current news (with streaming)'));
    console.log(chalk.gray('Streaming response...\n'));
    
    const stream = await openai.responses.create({
      model: 'gpt-5-nano',
      tools: [
        { type: 'web_search_preview' }
      ],
      input: 'What are the latest developments in AI technology today? Search the web for recent news.',
      store: true,
      stream: true
    });

    let fullText = '';
    let responseId = '';
    const webSearchCalls: any[] = [];
    
    for await (const event of stream) {
      // Handle different event types
      if (event.type === 'response.created') {
        responseId = event.response.id;
        console.log(chalk.green(`📝 Response ID: ${responseId}\n`));
      } else if (event.type === 'response.text.delta') {
        // Stream text as it comes in
        process.stdout.write(event.text);
        fullText += event.text;
      } else if (event.type === 'response.web_search_call.completed') {
        const searchEvent = event as any;
        webSearchCalls.push(searchEvent);
        console.log(chalk.cyan('\n🔍 Web search completed'));
        // Debug: Log the full event to understand structure
        if (process.env.DEBUG_WEB_SEARCH) {
          console.log(chalk.dim('Debug - Full event:'), JSON.stringify(searchEvent, null, 2));
        }
        // Try to find the query in various places
        const query = searchEvent.query || 
                     searchEvent.web_search_call?.query ||
                     searchEvent.results?.[0]?.query ||
                     'Query details in results';
        if (query !== 'Query details in results') {
          console.log(chalk.gray(`   Query: "${query}"`));
        }
      } else if (event.type === 'response.web_search_call.searching') {
        const searchingEvent = event as any;
        console.log(chalk.yellow('\n⏳ Searching the web...'));
        // Debug: Log the full event to understand structure
        if (process.env.DEBUG_WEB_SEARCH) {
          console.log(chalk.dim('Debug - Full event:'), JSON.stringify(searchingEvent, null, 2));
        }
        // Try to find the query in various places
        const query = searchingEvent.query || 
                     searchingEvent.web_search_call?.query ||
                     searchingEvent.web_search_call?.action?.query ||
                     'Query not available yet';
        if (query !== 'Query not available yet') {
          console.log(chalk.gray(`   Query: "${query}"`));
        }
      } else if (event.type === 'response.done') {
        console.log(chalk.green('\n\n✅ Response complete!'));
      }
    }

    // Display summary
    if (webSearchCalls.length > 0) {
      console.log(chalk.cyan(`\n📊 Summary: ${webSearchCalls.length} web search(es) performed`));
      webSearchCalls.forEach((call, idx) => {
        const query = call.web_search_call?.action?.query || call.action?.query || 'Unknown query';
        console.log(`  [${idx + 1}] ${query}`);
      });
    }

    console.log(chalk.gray('\n' + '─'.repeat(50) + '\n'));

    // Test 2: Web search with location context (non-streaming for comparison)
    console.log(chalk.yellow('Test 2: Web search with location context (non-streaming)'));
    console.log(chalk.gray('Making standard API call...\n'));
    
    const response2 = await openai.responses.create({
      model: 'gpt-5-nano',
      tools: [
        {
          type: 'web_search_preview',
          user_location: {
            type: 'approximate',
            country: 'US',
            city: 'San Francisco',
            region: 'California'
          }
        } as any
      ],
      input: 'Find the best restaurants near me that are open now',
      store: true
    });

    console.log(chalk.green('✅ Response received:'));
    console.log(response2.output_text);
    
    // Parse web search details properly
    if (response2.output && Array.isArray(response2.output)) {
      const webSearchCalls = response2.output.filter(item => item.type === 'web_search_call');
      if (webSearchCalls.length > 0) {
        console.log(chalk.cyan(`\n📊 Web searches performed: ${webSearchCalls.length}`));
        webSearchCalls.forEach((call: any, idx) => {
          console.log(`  [${idx + 1}] Status: ${call.status}`);
          // Parse action object properly
          if (call.action) {
            if (call.action.query) {
              console.log(`      Query: "${call.action.query}"`);
            }
            if (call.action.domains && Array.isArray(call.action.domains)) {
              console.log(`      Domains: ${call.action.domains.join(', ')}`);
            }
          }
        });
      }
    }

    console.log(chalk.gray('\n' + '─'.repeat(50) + '\n'));

    // Test 3: Fast search with streaming
    console.log(chalk.yellow('Test 3: Fast web search with low context (streaming)'));
    console.log(chalk.gray('Streaming response...\n'));
    
    const stream3 = await openai.responses.create({
      model: 'gpt-5-nano',
      tools: [
        {
          type: 'web_search_preview',
          search_context_size: 'low'
        } as any
      ],
      input: 'What is the current stock price of Apple?',
      store: true,
      stream: true
    });

    let usage: any = null;
    
    for await (const event of stream3) {
      if (event.type === 'response.text.delta') {
        // Stream text as it comes in
        process.stdout.write(event.text);
      } else if (event.type === 'response.web_search_call.searching') {
        const searchingEvent = event as any;
        console.log(chalk.yellow('\n⏳ Searching for stock prices...'));
        // Try to find the query in various places
        const query = searchingEvent.web_search_call?.query || 
                     searchingEvent.web_search_call?.action?.query ||
                     searchingEvent.query ||
                     'Unknown query';
        console.log(chalk.gray(`   Query: "${query}"`));
      } else if (event.type === 'response.done') {
        const doneEvent = event as any;
        usage = doneEvent.response?.usage;
        console.log(chalk.green('\n\n✅ Response complete!'));
      }
    }

    // Display token usage
    if (usage) {
      console.log(chalk.blue('\n📊 Token Usage:'));
      console.log(`  Input: ${usage.input_tokens}`);
      console.log(`  Output: ${usage.output_tokens}`);
      console.log(`  Total: ${usage.total_tokens}`);
    }

  } catch (error) {
    console.error(chalk.red('❌ Error during test:'), error);
    if (error instanceof Error) {
      console.error(chalk.red('Details:'), error.message);
    }
  }
}

// Run the test
console.log(chalk.bold.cyan('=' + '='.repeat(60)));
console.log(chalk.bold.cyan('OpenAI GPT-5 Web Search Test (with Streaming)'));
console.log(chalk.bold.cyan('=' + '='.repeat(60) + '\n'));

testWebSearchWithStreaming().then(() => {
  console.log(chalk.green('\n✅ All tests completed!'));
  process.exit(0);
}).catch(error => {
  console.error(chalk.red('\n❌ Test failed:'), error);
  process.exit(1);
});