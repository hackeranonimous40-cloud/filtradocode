import type { Message } from '../query.js'

export interface LogOption {
  fullPath: string
  date: string
  forkNumber: number
  sidechainNumber: number
  messages: Message[] | SerializedMessage[]
  modified?: Date
  created?: Date
  value?: number
  firstPrompt?: string
  messageCount?: number
}

export interface LogListProps {
  context: { unmount?: () => void }
  type: 'messages' | 'errors'
  logNumber?: number
}

export type SerializedMessage = {
  type: string
  message: {
    role: string
    content: string | unknown[]
  }
  uuid: string
  costUSD?: number
  durationMs?: number
  timestamp?: number
}
