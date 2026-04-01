import type { Tool } from '../Tool.js'
import type { UserMessage, AssistantMessage } from '../query.js'

export async function loadMessagesFromLog(
  logPath: string,
  tools: Tool[],
): Promise<(UserMessage | AssistantMessage)[]> {
  return []
}

export function deserializeMessages(
  messages: any[],
  tools: Tool[],
): (UserMessage | AssistantMessage)[] {
  return []
}
