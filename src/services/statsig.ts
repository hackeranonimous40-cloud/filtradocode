// Statsig stub - feature flags and analytics disabled for OpenAI version
export async function checkGate(gate: string): Promise<boolean> {
  return false
}

export async function getExperimentValue(
  experiment: string,
  defaultValue: any,
): Promise<any> {
  return defaultValue
}

export async function getDynamicConfig<T>(
  config: string,
  defaultValue: T,
): Promise<T> {
  return defaultValue
}

export function logEvent(event: string, data: Record<string, string>): void {
  // No-op
}

export async function initializeStatsig(): Promise<void> {
  // No-op
}

export function useStatsigGate(gateName: string, defaultValue = false): boolean {
  return defaultValue
}

export function getGateValues(): Record<string, boolean> {
  return {}
}
