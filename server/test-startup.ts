console.log('Testing startup...');

try {
  console.log('1. Testing openai-flattened schema import...');
  const flattened = require('./src/llm/schemas/openai-flattened');
  console.log('   - Flattened schema OK');
  
  console.log('2. Testing openai-schemas import...');
  const openaiSchemas = require('./src/llm/openai-schemas');
  console.log('   - OpenAI schemas OK');
  
  console.log('3. Testing simple-llm-interpreter import...');
  const simpleLLM = require('./src/routes/simple-llm-interpreter');
  console.log('   - Simple LLM interpreter OK');
  
  console.log('\n✅ All imports successful!');
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('Stack:', error.stack);
}