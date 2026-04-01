import type { ReactNode } from 'react'
import type { z } from 'zod'
import type { CanUseToolFn } from './hooks/useCanUseTool.js'

export interface ToolUseContext {
  abortController: AbortController
  options: {
    dangerouslySkipPermissions: boolean
    tools: Tool[]
    slowAndCapableModel?: string
    maxThinkingTokens: number
    commands?: any[]
    forkNumber?: number
    messageLogName?: string
    verbose?: boolean
  }
  setToolJSX?: SetToolJSXFn
  readFileTimestamps?: Record<string, number>
  setForkConvoWithMessagesOnTheNextRender?: (forkConvoWithMessages: unknown[]) => void
  messageId?: string
}

export type SetToolJSXFn = (jsx: ReactNode | { jsx: ReactNode; shouldHidePromptInput: boolean }) => void

export type ValidationResult =
  | { result: true }
  | { result: false; message: string; meta?: Record<string, unknown> }

export type ToolCallResult =
  | { type: 'result'; resultForAssistant: unknown; data?: unknown }
  | { type: 'progress'; content: ReactNode; normalizedMessages: unknown[]; tools: Tool[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Tool<Input = any, Output = unknown> {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  description: ((...args: any[]) => Promise<string>)
  prompt: (options: { dangerouslySkipPermissions: boolean }) => Promise<string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any
  inputJSONSchema?: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call: ((...args: any[]) => AsyncGenerator<ToolCallResult, void>)
  isEnabled: () => Promise<boolean>
  isReadOnly: () => boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  needsPermissions: ((...args: any[]) => boolean)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateInput?: ((...args: any[]) => Promise<ValidationResult>)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userFacingName: ((...args: any[]) => string)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderToolUseMessage: ((...args: any[]) => string)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderToolResultMessage: ((...args: any[]) => ReactNode)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderToolUseRejectedMessage: ((...args: any[]) => ReactNode)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderResultForAssistant: ((...args: any[]) => unknown)
}

export type { CanUseToolFn } from './hooks/useCanUseTool.js'
