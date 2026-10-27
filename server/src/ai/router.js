import { chatWith, LLMError } from './llmClient.js';
import { PROVIDERS, configuredProviders } from './providers.js';

/** Which providers handle each task, in order of preference. */
export const ROUTES = {
  case:    ['gemini', 'mistral', 'groq', 'openrouter'],   // quality + long structured output
  suspect: ['groq', 'mistral', 'openrouter', 'gemini'],   // speed, many calls per game
  reveal:  ['gemini', 'groq', 'mistral', 'openrouter'],   // storytelling, once per game
};

/** How long a provider rests after each kind of failure. */
const COOLDOWN_MS = {
  rate_limit: 60_000,
  server: 30_000,
  timeout: 30_000,
  empty: 10_000,
  invalid: 30_000,   // answered, but the answer was unusable
  truncated: 0,      // reply cut off by the token limit
  unknown: 15_000,
  bad_request: 0, // this request was bad; others may be fine
};

export class RouterError extends Error {
  constructor(task, attempts) {
    const summary = attempts.map((a) => `${a.provider}: ${a.error ?? a.skipped}`).join(', ');
    super(`All providers failed for task "${task}" (${summary || 'no providers configured'})`);
    this.name = 'RouterError';
    this.task = task;
    this.attempts = attempts;
  }
}

// ---- provider health ----------------------------------------------------

const health = new Map();

function getHealth(id) {
  if (!health.has(id)) {
    health.set(id, { cooldownUntil: 0, disabled: false, lastError: null, successes: 0, failures: 0 });
  }
  return health.get(id);
}

function skipReason(id) {
  const h = getHealth(id);
  if (h.disabled) return 'disabled';
  if (Date.now() < h.cooldownUntil) return 'cooldown';
  return null;
}

function markSuccess(id) {
  const h = getHealth(id);
  h.successes += 1;
  h.cooldownUntil = 0;
}

function markFailure(id, kind) {
  const h = getHealth(id);
  h.failures += 1;
  h.lastError = kind;
  if (kind === 'auth') h.disabled = true;
  else h.cooldownUntil = Date.now() + (COOLDOWN_MS[kind] ?? COOLDOWN_MS.unknown);
}

/** Rest a provider on purpose (used by the usage tracker and by tests). */
export function forceCooldown(id, ms, reason = 'manual') {
  const h = getHealth(id);
  h.cooldownUntil = Date.now() + ms;
  h.lastError = reason;
}

/** Snapshot of every provider's health, for the debug panel. */
export function getRouterStatus() {
  const now = Date.now();
  return Object.keys(PROVIDERS).map((id) => {
    const h = getHealth(id);
    return {
      provider: id,
      configured: configuredProviders().includes(id),
      disabled: h.disabled,
      coolingForMs: Math.max(0, h.cooldownUntil - now),
      lastError: h.lastError,
      successes: h.successes,
      failures: h.failures,
    };
  });
}

export function resetRouter() {
  health.clear();
}

// ---- events -------------------------------------------------------------

const listeners = new Set();

/** Subscribe to every success/failure. Returns an unsubscribe function. */
export function onRouterEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(event) {
  for (const fn of listeners) {
    try { fn(event); } catch { /* a broken listener must never break the game */ }
  }
}

// ---- the one function the game calls ------------------------------------

/**
 * Run an AI task on the best available provider, falling back on failure.
 * Returns { text, provider, model, latencyMs, finishReason, usage, task, attempts }.
 */
export async function ask(task, options = {}) {
  const route = ROUTES[task];
  if (!route) throw new Error(`Unknown AI task: ${task}`);

  const { model, validate, ...requestOptions } = options; // model names are provider-specific
  const available = new Set(configuredProviders());
  const candidates = route.filter((id) => available.has(id));
  const attempts = [];
  const coolingDown = [];

  const tryProvider = async (id) => {
    try {
      const result = await chatWith(id, requestOptions);
      if (validate && !validate(result.text)) {
        throw new LLMError('Reply failed validation', { provider: id, kind: 'invalid' });
      }
      if (result.finishReason === 'length') {
        throw new LLMError('Reply was cut off by the token limit', { provider: id, kind: 'truncated' });
      }
      markSuccess(id);
      attempts.push({ provider: id, ok: true, latencyMs: result.latencyMs });
      emit({ type: 'success', task, provider: id, model: result.model, latencyMs: result.latencyMs });
      return { ...result, task, attempts };
    } catch (err) {
      const kind = err instanceof LLMError ? err.kind : 'unknown';
      markFailure(id, kind);
      attempts.push({ provider: id, error: kind, message: err.message });
      emit({ type: 'failure', task, provider: id, kind, message: err.message });
      return null;
    }
  };

  // Pass 1: healthy providers, in route order.
  for (const id of candidates) {
    const skip = skipReason(id);
    if (skip) {
      attempts.push({ provider: id, skipped: skip });
      if (skip === 'cooldown') coolingDown.push(id);
      continue;
    }
    const result = await tryProvider(id);
    if (result) return result;
  }

  // Pass 2: last resort, retry providers that were only cooling down.
  for (const id of coolingDown) {
    const result = await tryProvider(id);
    if (result) return result;
  }

  throw new RouterError(task, attempts);
}
