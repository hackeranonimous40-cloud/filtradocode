// Sentry stub - error tracking disabled for OpenAI version
export function initSentry(): void {
  // No-op
}

export async function captureException(error: unknown): Promise<void> {
  // No-op
  console.error(error)
}
