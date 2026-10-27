import { env } from '../config.js';

/**
 * Every AI provider Midnight Manor can use.
 * All of them speak the OpenAI chat format, so one client works for all.
 * limits = conservative free-tier estimates; update from each provider's console.
 */
export const PROVIDERS = {
  groq: {
    label: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    model: env('GROQ_MODEL', 'openai/gpt-oss-120b'),
    free: true,
    strengths: ['fast'],
    limits: { rpm: 30, rpd: 1000 },
  },
  gemini: {
    label: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    keyEnv: 'GEMINI_API_KEY',
    model: env('GEMINI_MODEL', 'gemini-2.5-flash'),
    free: true,
    strengths: ['long-structured', 'vision'],
    limits: { rpm: 10, rpd: 250 },
  },
  mistral: {
    label: 'Mistral',
    baseURL: 'https://api.mistral.ai/v1',
    keyEnv: 'MISTRAL_API_KEY',
    model: env('MISTRAL_MODEL', 'mistral-small-latest'),
    free: true,
    strengths: ['balanced'],
    limits: { rpm: 50, rpd: null },
  },
  openrouter: {
    label: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    model: env('OPENROUTER_MODEL', 'nvidia/nemotron-3-ultra-550b-a55b:free'),
    free: true,
    strengths: ['variety'],
    limits: { rpm: 20, rpd: 50 },
    headers: {
      'HTTP-Referer': 'https://github.com/sri1157/midnight-manor',
      'X-Title': 'Midnight Manor',
    },
  },
};

export function getApiKey(providerId) {
  const provider = PROVIDERS[providerId];
  return provider ? env(provider.keyEnv) : undefined;
}

/** Providers that actually have a key set, in registry order. */
export function configuredProviders() {
  return Object.keys(PROVIDERS).filter((id) => getApiKey(id));
}