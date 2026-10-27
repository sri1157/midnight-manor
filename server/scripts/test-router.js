import { ask, forceCooldown, getRouterStatus, onRouterEvent } from '../src/ai/router.js';

onRouterEvent((e) => {
  const tag = e.type === 'success' ? 'OK  ' : 'FAIL';
  console.log(`   [${tag}] ${e.task} -> ${e.provider}${e.kind ? ` (${e.kind})` : ''}${e.latencyMs ? ` ${e.latencyMs} ms` : ''}`);
});

const suspect = [
  {
    role: 'system',
    content:
      'You are Colonel Hargrove, a suspect in the murder of Lady Ashford at Midnight Manor. ' +
      'Facts you know: at 10 pm you were alone in the library. No one saw you there. ' +
      'Never invent other people or events. Stay in character, at most 2 sentences, never mention being an AI.',
  },
  { role: 'user', content: 'Can anyone confirm you were in the library?' },
];

/** A suspect reply must be real dialogue: not empty, not too long, not classifier output. */
const inCharacter = (text) =>
  text.trim().length > 0 &&
  text.length < 600 &&
  !/user safety|safety categor|as an ai/i.test(text);

function show(label, result) {
  console.log(`\n>> ${label}: answered by ${result.provider} (${result.latencyMs} ms)`);
  console.log(`   "${result.text.trim()}"`);
  console.log('   attempts:', result.attempts.map((a) => `${a.provider}=${a.ok ? 'ok' : a.error ?? a.skipped}`).join(', '));
}

console.log('\n1) Normal suspect question');
show('Scenario 1', await ask('suspect', { messages: suspect, maxTokens: 400, validate: inCharacter }));

console.log('\n2) Simulated Groq outage (forced 60 s cooldown)');
forceCooldown('groq', 60_000, 'simulated outage');
show('Scenario 2', await ask('suspect', { messages: suspect, maxTokens: 400, validate: inCharacter }));

console.log('\n3) Case task (Gemini first, real fallback if it is overloaded)');
show('Scenario 3', await ask('case', {
  messages: [{ role: 'user', content: 'In one sentence, invent a victim for a haunted-mansion murder mystery.' }],
  maxTokens: 1500,
}));

console.log('\nRouter health:');
console.table(getRouterStatus());
