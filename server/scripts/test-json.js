import { z } from 'zod';
import { askJson, extractJson } from '../src/ai/jsonGuard.js';
import { getUsage } from '../src/ai/usageTracker.js';

console.log('1) extractJson offline checks');
console.log('   fenced :', extractJson('```json\n{"ok": true}\n```'));
console.log('   chatty :', extractJson('Sure! Here it is: {"ok": true} Hope that helps.'));

const SuspectCard = z.object({
  name: z.string().min(2),
  occupation: z.string().min(2),
  motive: z.string().min(10),
  alibi: z.string().min(10),
  voice: z.object({
    pitch: z.number().min(0.5).max(2),
    rate: z.number().min(0.5).max(2),
  }),
});

const hint = `{
  "name": string,
  "occupation": string,
  "motive": string (one sentence),
  "alibi": string (one sentence),
  "voice": { "pitch": number between 0.5 and 2, "rate": number between 0.5 and 2 }
}`;

console.log('\n2) Generating one suspect card...');
const result = await askJson('case', {
  messages: [
    {
      role: 'user',
      content: 'Invent one suspect for a murder at a haunted mansion called Midnight Manor. The victim is Lady Ashford.',
    },
  ],
  schema: SuspectCard,
  schemaHint: hint,
  maxTokens: 1500,
});

console.log(`   answered by ${result.provider} (${result.model}), repaired: ${result.repaired}`);
console.log(result.data);

console.log('\n3) Usage so far');
console.table(getUsage());
