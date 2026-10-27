import fs from 'node:fs/promises';
import path from 'node:path';
import { createCase } from '../src/game/caseEngine.js';
import { roomName, TIME_SLOTS, ROOMS } from '../src/game/mansion.js';
import { saveCase, countReadyCases } from '../src/db/caseStore.js';
import { isDbConfigured } from '../src/db/supabase.js';

console.log('Creating a mystery...\n');
const started = Date.now();
const { caseData: c, meta, validation } = await createCase({
  onProgress: (msg) => console.log(`  ... ${msg}`),
});

const dir = path.resolve('output/cases');
await fs.mkdir(dir, { recursive: true });
const file = path.join(dir, `case-${Date.now()}.json`);
await fs.writeFile(file, JSON.stringify({ meta, validation, case: c }, null, 2));

console.log(`=== ${c.title.toUpperCase()} ===`);
console.log(`Theme: ${meta.theme}`);
console.log(`Written by ${meta.provider} (${meta.model}) in ${((Date.now() - started) / 1000).toFixed(1)} s${meta.repaired ? ', after one JSON repair' : ''}\n`);
const d = validation.detective;
console.log(`Checks: passed on attempt ${validation.attempts}` +
  (d ? ` | AI detective ${d.correct ? 'solved it' : 'was fooled'} (confidence ${d.confidence})` : ' | detective skipped'));
if (validation.warnings.length) console.log(`Warnings: ${validation.warnings.length} (see npm run solution)`);
console.log();
console.log(c.setting);
console.log(`\n"${c.intro}"\n`);
console.log(`VICTIM: ${c.victim.name}, ${c.victim.role}. Found in the ${roomName(c.victim.room)}. ${c.victim.causeOfDeath}. Time of death: ${c.victim.timeOfDeath}.\n`);

console.log('--- SUSPECTS (what they tell you) ---');
for (const s of c.suspects) {
  console.log(`\n${s.name}, ${s.occupation} (${s.personality})`);
  console.log(`  Says: "${s.publicStory}"`);
  console.log(`  Claims: ${TIME_SLOTS.map((t) => `${t} ${roomName(s.claimedWhereabouts[t])}`).join(' | ')}`);
}

console.log('\n--- CLUES, ROOM BY ROOM ---');
for (const room of ROOMS) {
  const clues = c.clues.filter((cl) => cl.room === room.id);
  if (!clues.length) continue;
  console.log(`\n${room.name}:`);
  for (const cl of clues) {
    const locked = cl.unlockedByEventId ? ` [appears after event ${cl.unlockedByEventId}]` : '';
    console.log(`  - ${cl.title}: ${cl.description}${locked}`);
  }
}

console.log('\n--- EVENTS ---');
for (const e of c.events) console.log(`  minute ${e.minute}: ${e.narratorLine}`);

console.log(`\nSaved to ${path.relative(process.cwd(), file)}`);
if (isDbConfigured()) {
  const id = await saveCase({ caseData: c, meta, validation });
  console.log(`Saved to Supabase: ${id} (${await countReadyCases()} case(s) ready in the pool)`);
} else {
  console.log('Supabase not configured, skipped database save.');
}
console.log('Try to solve it! Then run: npm run solution');
