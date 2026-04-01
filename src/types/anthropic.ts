// Anthropic SDK type compatibility layer
// These types match the Anthropic SDK interfaces so the rest of the codebase
// doesn't need to change

export interface TextBlock {
  type: 'text'
  text: string
  citations?: unknown[]
}

export interface ImageBlockParam {
  type: 'image'
  source: ImageBlockParamSource
}

export interface ImageBlockParamSource {
  type: 'base64' | 'url'
  media_type?: string
  data?: string
  url?: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlockParam {
  type: 'tool_result'
  tool_use_id: string
  content?: string | Array<TextBlock | ImageBlockParam>
  is_error?: boolean
}

export interface ToolUseBlockParam {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type ContentBlockParam = TextBlock | ImageBlockParam | ToolUseBlockParam | ToolResultBlockParam

export type ContentBlock = TextBlock | ToolUseBlock | ThinkingBlock | RedactedThinkingBlock

export interface MessageParam {
  role: 'user' | 'assistant'
  content: string | Array<TextBlock | ImageBlockParam | ToolResultBlockParam | ToolUseBlockParam>
}

export interface Usage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export interface Message {
  id: string
  type: 'message'
  role: 'assistant'
  content: Array<TextBlock | ToolUseBlock>
  model: string
  stop_reason: string | null
  stop_sequence: string | null
  usage: Usage
}

export interface TextBlockParam {
  type: 'text'
  text: string
}

export interface ThinkingBlockParam {
  type: 'thinking'
  thinking: string
}

export interface DocumentBlockParam {
  type: 'document'
  source: {
    type: 'text' | 'content'
    media_type?: string
    data?: string
  }
}

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
  signature?: string
}

export interface RedactedThinkingBlock {
  type: 'redacted_thinking'
  data?: string
}
