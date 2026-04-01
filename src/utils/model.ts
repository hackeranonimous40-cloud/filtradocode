import { memoize } from 'lodash-es'
import { logError } from './log.js'

export const USE_OPENAI = !!process.env.OPENAI_API_KEY
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || undefined
export const USE_BEDROCK = false
export const USE_VERTEX = false

export interface ModelConfig {
  main: string
  small: string
}

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  main: 'gpt-4o',
  small: 'gpt-4o-mini',
}

export const MODEL = process.env.OPENAI_MODEL || DEFAULT_MODEL_CONFIG.main
export const SMALL_FAST_MODEL = process.env.OPENAI_SMALL_MODEL || DEFAULT_MODEL_CONFIG.small

export const getSlowAndCapableModel = memoize(async (): Promise<string> => {
  if (process.env.OPENAI_MODEL) {
    return process.env.OPENAI_MODEL
  }
  return DEFAULT_MODEL_CONFIG.main
})

export async function isDefaultSlowAndCapableModel(): Promise<boolean> {
  return (
    !process.env.OPENAI_MODEL ||
    process.env.OPENAI_MODEL === (await getSlowAndCapableModel())
  )
}
