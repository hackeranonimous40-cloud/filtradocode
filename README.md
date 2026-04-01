# OpenCarbo - AI Coding Assistant

![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

OpenCarbo is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows - all through natural language commands.

**Powered by OpenAI/OpenRouter** - Uses free models from OpenRouter for function calling.

## Features

- Edit files and fix bugs across your codebase
- Answer questions about your code's architecture and logic
- Execute and fix tests, lint, and other commands
- Search through git history, resolve merge conflicts, and create commits
- 16 built-in tools: Bash, File Edit, Glob, Grep, LS, Read, Notebook, Agent, etc.

## Quick Start

```bash
# Install dependencies
bun install

# Set your API key (OpenRouter - free tier available)
export OPENAI_API_KEY="your-key"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export OPENAI_MODEL="anthropic/claude-3-haiku"

# Run interactively
bun run start

# Or with a single prompt
bun run start -p "Explain src/Tool.ts"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API key for OpenRouter/OpenAI | Required |
| `OPENAI_BASE_URL` | API base URL | OpenRouter |
| `OPENAI_MODEL` | Main model (with function calling) | claude-3-haiku |
| `OPENAI_SMALL_MODEL` | Fast model for simple tasks | nemotron-nano |

## Free Models on OpenRouter

These models support function calling and work with OpenCarbo:

- `anthropic/claude-3-haiku` - Fast, capable
- `anthropic/claude-3.5-haiku` - Better reasoning
- `google/gemini-2.0-flash-exp` - Very fast
- `meta-llama/llama-3-8b-instruct` - Open source
- `mistralai/mistral-7b-instruct` - Good balance

## Slash Commands

- `/help` - Show help
- `/clear` - Clear conversation
- `/compact` - Compact context
- `/config` - Open config panel
- `/cost` - Show session cost
- `/init` - Initialize CLAUDE.md

## License

MIT - See LICENSE.md
