import chalk from 'chalk';
import { TestConfig } from '../core/config';

/**
 * Run comprehensive examples to demonstrate OpenAI Responses API features
 * @param callResponsesAPI Function to call the API
 */
export async function runExamples(
  callResponsesAPI: (input: string, options?: Partial<TestConfig>) => Promise<void>
): Promise<void> {
  console.log(chalk.bold('\nRunning Comprehensive Examples...\n'));

  // Example 1: Basic conversation
  console.log(chalk.yellow('Example 1: Starting conversation with memory'));
  await callResponsesAPI(
    "Hello! My name is David and I'm interested in jazz music. Please remember this.",
    { verbose: false }
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Example 2: Test memory
  console.log(chalk.yellow('\nExample 2: Testing server-side memory'));
  await callResponsesAPI(
    "What's my name and what music do I like?",
    { verbose: false }
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Example 3: With tools
  console.log(chalk.yellow('\nExample 3: Using tools (web search)'));
  await callResponsesAPI(
    "Search for the latest news about jazz festivals in 2025",
    { useTools: true, verbose: false }
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Example 4: High reasoning
  console.log(chalk.yellow('\nExample 4: High reasoning effort'));
  await callResponsesAPI(
    "Explain the musical evolution from bebop to modern jazz",
    { reasoning: { effort: 'high' as const }, verbose: false }
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Example 5: Different model
  console.log(chalk.yellow('\nExample 5: Using different model (gpt-5)'));
  await callResponsesAPI(
    "Compose a haiku about artificial intelligence",
    { model: 'gpt-5' as const, verbose: false }
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Example 6: Music alternatives (rejection scenario)
  console.log(chalk.yellow('\nExample 6: Music alternatives with emoji labels'));
  await callResponsesAPI(
    "I don't like Phoebe Bridgers, play something else",
    { useTools: true, verbose: false }
  );
}