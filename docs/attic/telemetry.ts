export type TelemetryEvent = {
  id: string;
  name: string;
  timestamp: number;
  properties: Record<string, unknown>;
};

export type FeatureFlag = 'alpha-dashboard' | 'new-ingestion-flow' | 'onboarding-v2';

// In-memory store for local testing/development (would be IndexedDB in production)
const eventStore: TelemetryEvent[] = [];
const activeFlags: Set<FeatureFlag> = new Set();

export function trackEvent(name: string, properties: Record<string, unknown> = {}): void {
  const event: TelemetryEvent = {
    id: crypto.randomUUID(),
    name,
    timestamp: Date.now(),
    properties,
  };
  eventStore.push(event);
  console.log(`[Telemetry] Tracked: ${name}`, properties);
}

export function getLocalEvents(): TelemetryEvent[] {
  return [...eventStore];
}

export function getFunnelMetrics() {
  const totalOnboardingStarts = eventStore.filter(e => e.name === 'onboarding_start').length;
  const totalOnboardingCompletes = eventStore.filter(e => e.name === 'onboarding_complete').length;
  
  return {
    onboardingStart: totalOnboardingStarts,
    onboardingComplete: totalOnboardingCompletes,
    completionRate: totalOnboardingStarts > 0 ? (totalOnboardingCompletes / totalOnboardingStarts) * 100 : 0
  };
}

export function toggleFeatureFlag(flag: FeatureFlag, enabled: boolean): void {
  if (enabled) {
    activeFlags.add(flag);
  } else {
    activeFlags.delete(flag);
  }
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return activeFlags.has(flag);
}

export function getActiveFlags(): FeatureFlag[] {
  return Array.from(activeFlags);
}

// Mock clear for testing
export function clearTelemetryStore(): void {
  eventStore.length = 0;
}
