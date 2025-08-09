import chalk from 'chalk';

/**
 * Handle errors from OpenAI API calls with detailed logging
 */
export function handleError(error: any, verbose: boolean = false): void {
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
      default:
        console.log(chalk.red(`HTTP ${error.status} error occurred.`));
        break;
    }
  }
  
  if (error.message) {
    console.log(chalk.red('Message:'), error.message);
  }
  
  if (verbose && error.response) {
    console.log(chalk.dim('\nError Response:'));
    console.log(JSON.stringify(error.response, null, 2));
  }

  if (error.stack && verbose) {
    console.log(chalk.dim('\nStack Trace:'));
    console.log(error.stack);
  }
}