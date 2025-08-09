import chalk from 'chalk';
import { TestConfig } from '../core/config';

/**
 * Run comprehensive test series to validate all OpenAI Responses API features
 * @param callResponsesAPI Function to call the API
 */
export async function runTestSeries(
  callResponsesAPI: (input: string, options?: Partial<TestConfig>) => Promise<void>
): Promise<void> {
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
    await callResponsesAPI(test.input, test.config);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(chalk.green.bold('\n✅ Test series complete!'));
}