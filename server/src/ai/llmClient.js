import OpenAI from 'openai';
import { PROVIDERS, getApiKey } from './providers.js';

/** An AI call failure with a reason the router can act on. */
export class LLMError extends Error {
  constructor(message, { provider, kind, status, cause } = {}) {
    super(message);
    this.name = 'LLMError';
    this.provider = provider;
    this.kind = kind; // 'rate_limit' | 'auth' | 'server' | 'timeout' | 'empty' | 'bad_request' | 'unknown'
    this.status = status;
    this.cause = cause;
  }
}

function classify(err) {
  if (err?.name === 'APIConnectionTimeoutError') return 'timeout';
  const status = err?.status;
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  if (status >= 500) return 'server';
  if (status >= 400) return 'bad_request';
  return 'unknown';
}

const clients = new Map();

function getClient(providerId) {
  if (clients.has(providerId)) return clients.get(providerId);

  const provider = PROVIDERS[providerId];
  if (!provider) throw new LLMError(`Unknown provider: ${providerId}`, { provider: providerId, kind: 'bad_request' });

  const apiKey = getApiKey(providerId);
  if (!apiKey) throw new LLMError(`No API key set for ${provider.label}`, { provider: providerId, kind: 'auth' });

  const client = new OpenAI({
    apiKey,
    baseURL: provider.baseURL,
    timeout: 30_000,
    maxRetries: 0,
    defaultHeaders: provider.headers,
  });
  clients.set(providerId, client);
  return client;
}

/**
 * Send one chat request to one specific provider.
 * Returns { text, provider, model, latencyMs, usage } or throws LLMError.
 */
export async function chatWith(providerId, { messages, json = false, temperature = 0.8, maxTokens = 800, model } = {}) {
  const client = getClient(providerId);
  const useModel = model || PROVIDERS[providerId].model;
  const started = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: useModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    });

    const text = response.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      throw new LLMError('Provider returned an empty reply', { provider: providerId, kind: 'empty' });
    }

    return {
      text,
      provider: providerId,
      model: useModel,
      latencyMs: Date.now() - started,
      usage: response.usage ?? null,
    };
  } catch (err) {
    if (err instanceof LLMError) throw err;
    throw new LLMError(err.message, { provider: providerId, kind: classify(err), status: err.status, cause: err });
  }
}