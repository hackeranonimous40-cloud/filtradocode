// Quick test of the OpenAI API layer without Ink UI
import { querySonnet, formatSystemPromptWithContext } from './src/services/claude.js'
import { getSystemPrompt } from './src/constants/prompts.js'
import { getAllTools } from './src/tools.js'
import { enableConfigs } from './src/utils/config.js'

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('Error: OPENAI_API_KEY is required')
  console.error('Usage: OPENAI_API_KEY=your-key bun run test-api.ts')
  process.exit(1)
}

// Enable configs before anything else
enableConfigs()

const prompt = process.argv[2] || 'Hello, what can you do?'

console.log('Testing OpenAI API layer...')
console.log('Model:', process.env.OPENAI_MODEL || 'gpt-4o')
console.log('Prompt:', prompt)
console.log('---')

const systemPrompt = await getSystemPrompt()
const tools = getAllTools()

const messages = [{
  message: {
    role: 'user',
    content: prompt,
  },
  type: 'user',
  uuid: crypto.randomUUID(),
}]

const abortController = new AbortController()

try {
  const result = await querySonnet(
    messages,
    systemPrompt,
    0,
    tools,
    abortController.signal,
    {
      dangerouslySkipPermissions: false,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      prependCLISysprompt: true,
    },
  )

  console.log('\n=== Response ===')
  console.log('Cost: $', result.costUSD.toFixed(4))
  console.log('Duration:', result.durationMs, 'ms')
  
  for (const block of result.message.content) {
    if (block.type === 'text') {
      console.log('\n' + block.text)
    } else if (block.type === 'tool_use') {
      console.log('\n[Tool Call]', block.name, JSON.stringify(block.input, null, 2))
    }
  }
} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}
