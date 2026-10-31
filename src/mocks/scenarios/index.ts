import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/shared/contracts'

/**
 * Network/failure scenarios, selected by `?scenario=<name>` (persisted in localStorage)
 * so dev, demo build and Playwright share the exact same, reproducible behavior.
 */
export type ScenarioName = 'default' | 'slow' | 'server-error' | 'offline' | 'empty' | 'out-of-order' | 'favorites-error' | 'cart-error' | 'payment-rejected' | 'payment-pending' | 'order-timeout' | 'wallet-reject'

interface Scenario {
  /** Fixed latency (ms) — deterministic. */
  latencyMs: number
  /**
   * Per-endpoint latency sequence, cycled by call count (overrides latencyMs).
   * [2000, 100] makes each odd call slower than the next one: responses arrive out of order.
   */
  latencySequenceMs?: number[]
  /** Forces this outcome on every non-control endpoint (or only on `failingEndpoints`). */
  failure?: 'http-500' | 'network'
  failingEndpoints?: string[]
  /** List endpoints return no results. */
  emptyLists?: boolean
}

const SCENARIOS: Record<ScenarioName, Scenario> = {
  default: { latencyMs: 150 },
  slow: { latencyMs: 2500 },
  'server-error': { latencyMs: 150, failure: 'http-500' },
  offline: { latencyMs: 0, failure: 'network' },
  empty: { latencyMs: 150, emptyLists: true },
  'out-of-order': { latencyMs: 150, latencySequenceMs: [2000, 100] },
  // Favorite add/remove fail with 500 after a visible delay (optimistic update + rollback).
  'favorites-error': { latencyMs: 800, failure: 'http-500', failingEndpoints: ['favorite-write'] },
  // Cart writes (add, quantity, remove, merge) fail with 500 after a visible delay; reads work.
  'cart-error': { latencyMs: 800, failure: 'http-500', failingEndpoints: ['cart-write'] },
  // Checkout outcomes (read by the order/wallet handlers; normal latency).
  'payment-rejected': { latencyMs: 150 },
  'payment-pending': { latencyMs: 150 },
  'order-timeout': { latencyMs: 150 },
  'wallet-reject': { latencyMs: 150 },
}

/** Call counters per endpoint (in memory: reset on reload, like a fresh server connection). */
const callCounts = new Map<string, number>()

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

export function isEmptyListScenario() {
  return SCENARIOS[getActiveScenarioName()].emptyLists === true
}

/**
 * Applies latency/failure of the active scenario to one endpoint.
 * Returns a Response to short-circuit the handler, or undefined to continue normally.
 */
export async function applyScenario(endpoint: string): Promise<Response | undefined> {
  const scenario = SCENARIOS[getActiveScenarioName()]
  const call = callCounts.get(endpoint) ?? 0
  callCounts.set(endpoint, call + 1)
  const sequence = scenario.latencySequenceMs
  const latency = sequence?.length ? (sequence[call % sequence.length] ?? scenario.latencyMs) : scenario.latencyMs
  if (latency > 0) await delay(latency)
  const fails = !scenario.failingEndpoints || scenario.failingEndpoints.includes(endpoint)
  if (fails && scenario.failure === 'network') return HttpResponse.error()
  if (fails && scenario.failure === 'http-500') return errorResponse(500, 'TRANSIENT_FAILURE', 'Serviço temporariamente indisponível.')
  return undefined
}
