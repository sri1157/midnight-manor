import { chatWith } from '../src/ai/llmClient.js';
import { PROVIDERS, configuredProviders } from '../src/ai/providers.js';

const messages = [
  {
    role: 'system',
    content:
      'You are Colonel Hargrove, a retired army officer and a suspect in the murder of Lady Ashford at Midnight Manor. ' +
      'You did not kill her, but you are hiding a large gambling debt you owed her, so you get defensive about money. ' +
      'Stay fully in character. Answer in at most 3 sentences. Never mention being an AI.',
  },
  { role: 'user', content: 'Where were you at 10 pm, when Lady Ashford was killed?' },
];

const ids = configuredProviders();
if (ids.length === 0) {
  console.error('No API keys found. Fill in server/.env first.');
  process.exit(1);
}

console.log(`Interrogating Colonel Hargrove on ${ids.length} provider(s)...\n`);

const results = await Promise.allSettled(ids.map((id) => chatWith(id, { messages, maxTokens: 600 })));

results.forEach((result, i) => {
  const label = PROVIDERS[ids[i]].label;
  if (result.status === 'fulfilled') {
    const { model, latencyMs, text } = result.value;
    console.log(`=== ${label} · ${model} · ${latencyMs} ms ===\n${text.trim()}\n`);
  } else {
    const err = result.reason;
    console.log(`=== ${label} · FAILED (${err.kind ?? 'unknown'}) ===\n${err.message}\n`);
  }
});