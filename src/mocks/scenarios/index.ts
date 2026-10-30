import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/shared/contracts'

/**
 * Network/failure scenarios, selected by `?scenario=<name>` (persisted in localStorage)
 * so dev, demo build and Playwright share the exact same, reproducible behavior.
 */
export type ScenarioName = 'default' | 'slow' | 'server-error' | 'offline'

interface Scenario {
  /** Fixed latency (ms) — deterministic. */
  latencyMs: number
  /** Forces this outcome on every non-control endpoint. */
  failure?: 'http-500' | 'network'
}

const SCENARIOS: Record<ScenarioName, Scenario> = {
  default: { latencyMs: 150 },
  slow: { latencyMs: 2500 },
  'server-error': { latencyMs: 150, failure: 'http-500' },
  offline: { latencyMs: 0, failure: 'network' },
}

const STORAGE_KEY = 'jungle-mock-scenario'

function isScenarioName(value: string | null): value is ScenarioName {
  return value !== null && value in SCENARIOS
}

/** Called once at worker start: `?scenario=` on the initial URL selects and persists the scenario. */
export function initScenarioFromUrl() {
  const fromUrl = new URLSearchParams(window.location.search).get('scenario')
  if (isScenarioName(fromUrl)) localStorage.setItem(STORAGE_KEY, fromUrl)
}

export function getActiveScenarioName(): ScenarioName {
  const stored = localStorage.getItem(STORAGE_KEY)
  return isScenarioName(stored) ? stored : 'default'
}

export function setActiveScenario(name: ScenarioName) {
  localStorage.setItem(STORAGE_KEY, name)
}

export function errorResponse(status: number, code: ApiErrorCode, message: string, fieldErrors?: Record<string, string>) {
  const body: ApiErrorBody = { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }
  return HttpResponse.json(body, { status })
}

/**
 * Applies latency/failure of the active scenario.
 * Returns a Response to short-circuit the handler, or undefined to continue normally.
 */
export async function applyScenario(): Promise<Response | undefined> {
  const scenario = SCENARIOS[getActiveScenarioName()]
  if (scenario.latencyMs > 0) await delay(scenario.latencyMs)
  if (scenario.failure === 'network') return HttpResponse.error()
  if (scenario.failure === 'http-500') return errorResponse(500, 'TRANSIENT_FAILURE', 'Serviço temporariamente indisponível.')
  return undefined
}
