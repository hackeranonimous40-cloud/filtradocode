import OpenAI from 'openai'
import { APIConnectionError, APIUserAbortError } from 'openai/error.mjs'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat'
import chalk from 'chalk'
import { createHash, randomUUID } from 'crypto'
import 'dotenv/config'

import { addToTotalCost } from '../cost-tracker.js'
import type { AssistantMessage, UserMessage } from '../query.js'
import { Tool } from '../Tool.js'
import { getApiKey, getOrCreateUserID } from '../utils/config.js'
import { logError, SESSION_ID } from '../utils/log.js'
import {
  createAssistantAPIErrorMessage,
  normalizeContentFromAPI,
} from '../utils/messages.js'
import { countTokens } from '../utils/tokens.js'
import { withVCR } from './vcr.js'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type {
  ChatCompletion,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions'
import { MODEL, SMALL_FAST_MODEL } from '../utils/model.js'
import { getCLISyspromptPrefix } from '../constants/prompts.js'

interface StreamResponse {
  id: string
  content: Array<{ type: string; text?: string }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  stop_reason: string | null
  ttftMs?: number
}

export const API_ERROR_MESSAGE_PREFIX = 'API Error'
export const PROMPT_TOO_LONG_ERROR_MESSAGE = 'Prompt is too long'
export const CREDIT_BALANCE_TOO_LOW_ERROR_MESSAGE = 'Credit balance is too low'
export const INVALID_API_KEY_ERROR_MESSAGE =
  'Invalid API key · Please set OPENAI_API_KEY'
export const NO_CONTENT_MESSAGE = '(no content)'

// OpenAI pricing per million tokens (GPT-4o)
const INPUT_COST_PER_MILLION = 2.50
const OUTPUT_COST_PER_MILLION = 10.00

export const MAIN_QUERY_TEMPERATURE = 0.7

function getMetadata() {
  return {
    user_id: `${getOrCreateUserID()}_${SESSION_ID}`,
  }
}

const MAX_RETRIES = 10
const BASE_DELAY_MS = 500

interface RetryOptions {
  maxRetries?: number
}

function getRetryDelay(
  attempt: number,
  retryAfterHeader?: string | null,
): number {
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10)
    if (!isNaN(seconds)) {
      return seconds * 1000
    }
  }
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), 32000)
}

function shouldRetry(error: any): boolean {
  if (error instanceof APIConnectionError) {
    return true
  }

  if (error instanceof APIUserAbortError) {
    return false
  }

  const status = error?.status
  if (!status) return false
  if (status === 408) return true
  if (status === 409) return true
  if (status === 429) return true
  if (status >= 500) return true

  return false
}

async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES
  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error

      if (
        attempt > maxRetries ||
        !shouldRetry(error)
      ) {
        throw error
      }

      const retryAfter = error.headers?.['retry-after'] ?? null
      const delayMs = getRetryDelay(attempt, retryAfter)

      console.log(
        `  ⎿  ${chalk.red(`API ${error.name} (${error.message}) · Retrying in ${Math.round(delayMs / 1000)} seconds… (attempt ${attempt}/${maxRetries})`)}`,
      )

      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

export async function verifyApiKey(apiKey: string): Promise<boolean> {
  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 3,
  })

  try {
    await withRetry(
      async () => {
        await openai.chat.completions.create({
          model: SMALL_FAST_MODEL,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
          temperature: 0,
        })
        return true
      },
      { maxRetries: 2 },
    )
    return true
  } catch (error) {
    logError(error)
    if (
      error instanceof Error &&
      (error.message.includes('Incorrect API key') ||
       error.message.includes('invalid_api_key'))
    ) {
      return false
    }
    throw error
  }
}

let openaiClient: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    console.error(
      chalk.red(
        'Please set the OPENAI_API_KEY environment variable.',
      ),
    )
  }

  openaiClient = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
    timeout: parseInt(process.env.API_TIMEOUT_MS || String(60 * 1000), 10),
  })
  return openaiClient
}

export function resetOpenAIClient(): void {
  openaiClient = null
}

// Alias for backwards compatibility
export function resetAnthropicClient(): void {
  resetOpenAIClient()
}

export function userMessageToMessageParam(
  message: UserMessage,
): ChatCompletionMessageParam | ChatCompletionMessageParam[] {
  if (typeof message.message.content === 'string') {
    return {
      role: 'user',
      content: message.message.content,
    }
  }

  // Handle tool_result blocks - these need to be sent as 'tool' role messages
  const toolResults = message.message.content.filter(
    (block: any) => block.type === 'tool_result',
  )
  const otherBlocks = message.message.content.filter(
    (block: any) => block.type !== 'tool_result',
  )

  const messages: ChatCompletionMessageParam[] = []

  if (otherBlocks.length > 0) {
    messages.push({
      role: 'user',
      content: otherBlocks as any,
    })
  }

  for (const block of toolResults as any[]) {
    messages.push({
      role: 'tool',
      tool_call_id: block.tool_use_id,
      content:
        typeof block.content === 'string'
          ? block.content
          : JSON.stringify(block.content),
    })
  }

  return messages.length === 1 ? messages[0]! : messages
}

export function assistantMessageToMessageParam(
  message: AssistantMessage,
): ChatCompletionMessageParam {
  const textContent = message.message.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n')

  const toolCalls = message.message.content
    .filter((block: any) => block.type === 'tool_use')
    .map((block: any, index: number) => ({
      id: block.id,
      type: 'function' as const,
      function: {
        name: block.name,
        arguments: JSON.stringify(block.input),
      },
    }))

  if (toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: textContent || undefined,
      tool_calls: toolCalls,
    }
  }

  return {
    role: 'assistant',
    content: textContent || undefined,
  }
}

function splitSysPrompt(systemPrompt: string[]): string {
  return systemPrompt.join('\n')
}

function convertToolUseToToolCall(block: any): any {
  return {
    id: block.id,
    type: 'function' as const,
    function: {
      name: block.name,
      arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input),
    },
  }
}

function convertToolCallToToolUse(toolCall: any): any {
  return {
    type: 'tool_use' as const,
    id: toolCall.id,
    name: toolCall.function.name,
    input: JSON.parse(toolCall.function.arguments),
  }
}

export async function querySonnet(
  messages: (UserMessage | AssistantMessage)[],
  systemPrompt: string[],
  maxThinkingTokens: number,
  tools: Tool[],
  signal: AbortSignal,
  options: {
    dangerouslySkipPermissions: boolean
    model: string
    prependCLISysprompt: boolean
  },
): Promise<AssistantMessage> {
  return await withVCR(messages, () =>
    queryWithOpenAI(
      messages,
      systemPrompt,
      maxThinkingTokens,
      tools,
      signal,
      options,
    ),
  )
}

export function formatSystemPromptWithContext(
  systemPrompt: string[],
  context: { [k: string]: string },
): string[] {
  if (Object.entries(context).length === 0) {
    return systemPrompt
  }

  return [
    ...systemPrompt,
    `\nAs you answer the user's questions, you can use the following context:\n`,
    ...Object.entries(context).map(
      ([key, value]) => `<context name="${key}">${value}</context>`,
    ),
  ]
}

async function queryWithOpenAI(
  messages: (UserMessage | AssistantMessage)[],
  systemPrompt: string[],
  maxThinkingTokens: number,
  tools: Tool[],
  signal: AbortSignal,
  options: {
    dangerouslySkipPermissions: boolean
    model: string
    prependCLISysprompt: boolean
  },
): Promise<AssistantMessage> {
  const openai = getOpenAIClient()

  let fullSystemPrompt = systemPrompt
  if (options.prependCLISysprompt) {
    const [firstSyspromptBlock] = splitSysPromptPrefix(systemPrompt)
    fullSystemPrompt = [getCLISyspromptPrefix(), ...systemPrompt]
  }

  const systemPromptText = splitSysPrompt(fullSystemPrompt)

  const toolSchemas: ChatCompletionTool[] = await Promise.all(
    tools.map(async _ => ({
      type: 'function' as const,
      function: {
        name: _.name,
        description: await _.prompt({
          dangerouslySkipPermissions: options.dangerouslySkipPermissions,
        }),
        parameters: ('inputJSONSchema' in _ && _.inputJSONSchema
          ? _.inputJSONSchema
          : zodToJsonSchema(_.inputSchema)) as any,
      },
    })),
  )

  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPromptText },
    ...(messages.flatMap(msg =>
      msg.type === 'user'
        ? Array.isArray(userMessageToMessageParam(msg))
          ? userMessageToMessageParam(msg)
          : [userMessageToMessageParam(msg)]
        : [assistantMessageToMessageParam(msg)],
    ) as ChatCompletionMessageParam[]),
  ]

  const startIncludingRetries = Date.now()
  let start = Date.now()
  let attemptNumber = 0
  let response: StreamResponse | undefined

  try {
    response = await withRetry(async attempt => {
      attemptNumber = attempt
      start = Date.now()

      const completion = await openai.chat.completions.create(
        {
          model: options.model,
          max_tokens: Math.max(
            maxThinkingTokens + 1,
            getMaxTokensForModel(options.model),
          ),
          messages: openaiMessages,
          temperature: MAIN_QUERY_TEMPERATURE,
          tools: toolSchemas.length > 0 ? toolSchemas : undefined,
          tool_choice: toolSchemas.length > 0 ? 'auto' : undefined,
          user: getMetadata().user_id,
        },
        { signal },
      )
      const toolCalls = (completion as any).choices?.[0]?.message?.tool_calls
      if (process.env.DEBUG) {
        console.error('[DEBUG] completion finish_reason:', (completion as any).choices?.[0]?.finish_reason, 'tool_calls:', toolCalls?.map((t: any) => t.function.name).join(', '))
      }

      return parseOpenAIResponse(completion)
    })
  } catch (error) {
    logError(error)
    return getAssistantMessageFromError(error)
  }

  const durationMs = Date.now() - start
  const durationMsIncludingRetries = Date.now() - startIncludingRetries

  const inputTokens = response.usage.prompt_tokens
  const outputTokens = response.usage.completion_tokens
  const costUSD =
    (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION

  addToTotalCost(costUSD, durationMsIncludingRetries)

  // Convert OpenAI response to Anthropic-compatible format
  const content: any[] = []

  if (response.content.length > 0) {
    const text = response.content.map((c: any) => c.text).join('\n')
    if (text) {
      content.push({ type: 'text', text })
    }
  }

  // Convert tool calls from OpenAI format to Anthropic format
  const toolCalls = (response as any).tool_calls || []
  for (const toolCall of toolCalls) {
    content.push(convertToolCallToToolUse(toolCall))
  }

  return {
    message: {
      id: response.id,
      content,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      role: 'assistant',
      type: 'message',
      model: options.model,
      stop_reason: response.stop_reason,
      stop_sequence: null,
    },
    costUSD,
    durationMs,
    type: 'assistant',
    uuid: randomUUID(),
  }
}

function parseOpenAIResponse(completion: any): StreamResponse {
  const content: Array<{ type: string; text?: string }> = []
  const toolCalls: any[] = []

  if (!completion || !completion.choices || !completion.choices[0]) {
    throw new Error(`Invalid API response: ${JSON.stringify(completion).slice(0, 200)}`)
  }

  const choice = completion.choices[0]
  
  if (choice.message?.content) {
    content.push({
      type: 'text',
      text: choice.message.content,
    })
  }

  if (choice.message?.tool_calls) {
    toolCalls.push(...choice.message.tool_calls)
  }

  return {
    id: completion.id,
    content,
    usage: completion.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
    stop_reason: choice.finish_reason || null,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  }
}

function getAssistantMessageFromError(error: unknown): AssistantMessage {
  if (error instanceof Error && error.message.includes('maximum context length')) {
    return createAssistantAPIErrorMessage(PROMPT_TOO_LONG_ERROR_MESSAGE)
  }
  if (
    error instanceof Error &&
    (error.message.includes('insufficient_quota') ||
     error.message.includes('billing'))
  ) {
    return createAssistantAPIErrorMessage(CREDIT_BALANCE_TOO_LOW_ERROR_MESSAGE)
  }
  if (
    error instanceof Error &&
    (error.message.includes('Incorrect API key') ||
     error.message.includes('invalid_api_key'))
  ) {
    return createAssistantAPIErrorMessage(INVALID_API_KEY_ERROR_MESSAGE)
  }
  if (error instanceof Error) {
    return createAssistantAPIErrorMessage(
      `${API_ERROR_MESSAGE_PREFIX}: ${error.message}`,
    )
  }
  return createAssistantAPIErrorMessage(API_ERROR_MESSAGE_PREFIX)
}

function splitSysPromptPrefix(systemPrompt: string[]): string[] {
  const systemPromptFirstBlock = systemPrompt[0] || ''
  const systemPromptRest = systemPrompt.slice(1)
  return [systemPromptFirstBlock, systemPromptRest.join('\n')].filter(Boolean)
}

async function queryHaikuWithPromptCaching({
  systemPrompt,
  userPrompt,
  assistantPrompt,
  signal,
}: {
  systemPrompt: string[]
  userPrompt: string
  assistantPrompt?: string
  signal?: AbortSignal
}): Promise<AssistantMessage> {
  const openai = getOpenAIClient()
  const model = SMALL_FAST_MODEL

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: splitSysPrompt(systemPrompt) },
    { role: 'user', content: userPrompt },
    ...(assistantPrompt ? [{ role: 'assistant' as const, content: assistantPrompt }] : []),
  ]

  let attemptNumber = 0
  let start = Date.now()
  const startIncludingRetries = Date.now()
  let response: StreamResponse

  try {
    response = await withRetry(async attempt => {
      attemptNumber = attempt
      start = Date.now()

      const completion = await openai.chat.completions.create(
        {
          model,
          max_tokens: 512,
          messages,
          temperature: 0,
          user: getMetadata().user_id,
        },
        { signal },
      )

      return parseOpenAIResponse(completion)
    })
  } catch (error) {
    logError(error)
    return getAssistantMessageFromError(error)
  }

  const inputTokens = response.usage.prompt_tokens
  const outputTokens = response.usage.completion_tokens
  const costUSD =
    (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION

  const durationMs = Date.now() - start
  const durationMsIncludingRetries = Date.now() - startIncludingRetries
  addToTotalCost(costUSD, durationMsIncludingRetries)

  return {
    durationMs,
    message: {
      id: response.id,
      content: response.content.map(c => ({ type: 'text', text: c.text })),
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      role: 'assistant',
      type: 'message',
      model,
      stop_reason: response.stop_reason,
      stop_sequence: null,
    },
    costUSD,
    uuid: randomUUID(),
    type: 'assistant',
  }
}

async function queryHaikuWithoutPromptCaching({
  systemPrompt,
  userPrompt,
  assistantPrompt,
  signal,
}: {
  systemPrompt: string[]
  userPrompt: string
  assistantPrompt?: string
  signal?: AbortSignal
}): Promise<AssistantMessage> {
  return queryHaikuWithPromptCaching({
    systemPrompt,
    userPrompt,
    assistantPrompt,
    signal,
  })
}

export async function queryHaiku({
  systemPrompt = [],
  userPrompt,
  assistantPrompt,
  enablePromptCaching = false,
  signal,
}: {
  systemPrompt: string[]
  userPrompt: string
  assistantPrompt?: string
  enablePromptCaching?: boolean
  signal?: AbortSignal
}): Promise<AssistantMessage> {
  return enablePromptCaching
    ? queryHaikuWithPromptCaching({
        systemPrompt,
        userPrompt,
        assistantPrompt,
        signal,
      })
    : queryHaikuWithoutPromptCaching({
        systemPrompt,
        userPrompt,
        assistantPrompt,
        signal,
      })
}

function getMaxTokensForModel(model: string): number {
  if (model.includes('gpt-4')) {
    return 8192
  }
  if (model.includes('gpt-3.5')) {
    return 4096
  }
  return 8192
}
