import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { askSuspect } from '../src/game/suspectAgent.js';

const dir = path.resolve('output/cases');
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
if (!files.length) {
  console.error('No saved cases. Run: npm run case');
  process.exit(1);
}
const { case: c } = JSON.parse(await fs.readFile(path.join(dir, files.at(-1)), 'utf8'));

console.log(`\n=== ${c.title} ===`);
c.suspects.forEach((s) => console.log(`  ${s.id}: ${s.name}, ${s.occupation}`));

const id = process.argv[2] ?? 's1';
const suspect = c.suspects.find((s) => s.id === id);
if (!suspect) {
  console.error(`No suspect "${id}". Use one of: ${c.suspects.map((s) => s.id).join(', ')}`);
  process.exit(1);
}

console.log(`\nYou sit down across from ${suspect.name}. Type a question, or "quit".\n`);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const history = [];

while (true) {
  const q = (await rl.question('You: ')).trim();
  if (!q || q.toLowerCase() === 'quit') break;
  try {
    const r = await askSuspect({ caseData: c, suspectId: id, history, askerName: 'Shreya', question: q });
    history.push({ asker: 'Shreya', q: r.question, a: r.answer });
    console.log(`${suspect.name}: ${r.answer}   [${r.provider}, ${r.latencyMs} ms]\n`);
  } catch (err) {
    console.log(`(${suspect.name} stares at you in silence: ${err.message})\n`);
  }
}
rl.close();
