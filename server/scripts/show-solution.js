import fs from 'node:fs/promises';
import path from 'node:path';
import { roomName, TIME_SLOTS } from '../src/game/mansion.js';

const dir = path.resolve('output/cases');
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
if (!files.length) {
  console.error('No saved cases. Run: npm run case');
  process.exit(1);
}

const { case: c, validation } = JSON.parse(await fs.readFile(path.join(dir, files.at(-1)), 'utf8'));
const killer = c.suspects.find((s) => s.id === c.truth.killerId);

console.log(`=== SOLUTION: ${c.title} ===\n`);
console.log(`KILLER: ${killer?.name ?? c.truth.killerId}`);
console.log(`Motive: ${c.truth.motive}`);
console.log(`Method: ${c.truth.method} (weapon: ${c.truth.weapon})`);
console.log(`Where and when: ${roomName(c.truth.room)} at ${c.truth.slot}\n`);

console.log('--- LIES (real room vs claimed room) ---');
for (const s of c.suspects) {
  const lies = TIME_SLOTS.filter((t) => s.whereabouts[t] !== s.claimedWhereabouts[t]);
  const detail = lies.length
    ? lies.map((t) => `${t}: really ${roomName(s.whereabouts[t])}, claimed ${roomName(s.claimedWhereabouts[t])}`).join('; ')
    : 'told the truth';
  console.log(`${s.isKiller ? '[KILLER] ' : ''}${s.name}: ${detail}`);
  console.log(`  Secret: ${s.secret}`);
}

console.log('\n--- CLUES ---');
for (const cl of c.clues) {
  console.log(`${cl.pointsTo === 'truth' ? 'TRUE  ' : 'HERRING'} ${cl.title}: ${cl.proves}`);
}

console.log('\n--- THE NARRATOR REVEALS ---');
c.reveal.forEach((step, i) => console.log(`${i + 1}. ${step}`));

if (validation) {
  console.log('\n--- AI DETECTIVE TEST ---');
  const d = validation.detective;
  if (d) {
    console.log(`Accused: ${d.killerName} (${d.correct ? 'correct' : 'WRONG'}), confidence ${d.confidence}, via ${d.provider}`);
    console.log(`Reasoning: ${d.reasoning}`);
  } else {
    console.log('Skipped.');
  }
  console.log(`Attempts: ${validation.attempts}`);
  for (const entry of validation.log) {
    console.log(`  attempt ${entry.attempt} [${entry.stage}]${entry.errors ? `: ${entry.errors.length} problem(s)` : ''}`);
    if (entry.error) console.log(`    error: ${entry.error}`);
    if (entry.issues) entry.issues.forEach((i) => console.log(`    - ${i}`));
  }
  if (validation.warnings.length) {
    console.log('Warnings:');
    validation.warnings.forEach((w) => console.log(`  - ${w}`));
  }
}
