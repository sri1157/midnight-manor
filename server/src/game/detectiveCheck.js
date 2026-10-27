import { z } from 'zod';
import { askJson } from '../ai/jsonGuard.js';
import { roomName, TIME_SLOTS } from './mansion.js';

/** Exactly what players can see. No truth, secrets, real whereabouts or clue labels. */
export function buildPlayerView(c) {
  return {
    title: c.title,
    setting: c.setting,
    intro: c.intro,
    victim: {
      name: c.victim.name,
      role: c.victim.role,
      foundIn: roomName(c.victim.room),
      causeOfDeath: c.victim.causeOfDeath,
      timeOfDeath: c.victim.timeOfDeath,
    },
    suspects: c.suspects.map((s) => ({
      name: s.name,
      occupation: s.occupation,
      personality: s.personality,
      says: s.publicStory,
      claims: Object.fromEntries(TIME_SLOTS.map((t) => [t, roomName(s.claimedWhereabouts[t])])),
    })),
    clues: c.clues.map((x) => ({ title: x.title, foundIn: roomName(x.room), description: x.description })),
  };
}

const VerdictSchema = z.object({
  killerName: z.string().min(2),
  reasoning: z.string().min(20),
  keyClues: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  contradictions: z.array(z.string()),
  singleClueGiveaway: z.string().nullish(),
});

const VERDICT_SHAPE = `{
  "killerName": string (one suspect's full name),
  "reasoning": string (step by step),
  "keyClues": [ clue titles you used ],
  "confidence": number 0-1,
  "contradictions": [ strings; empty array if none ],
  "singleClueGiveaway": clue title, or null
}`;

const TITLES = new Set(['dr', 'doctor', 'lady', 'lord', 'sir', 'mr', 'mrs', 'miss', 'ms', 'colonel', 'col', 'captain', 'madam', 'professor']);
const nameTokens = (name) =>
  name.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !TITLES.has(w));

/** Which suspect does the detective's answer refer to? */
function matchSuspect(answer, suspects) {
  const wanted = nameTokens(answer);
  let best = null;
  let bestScore = 0;
  for (const s of suspects) {
    const score = nameTokens(s.name).filter((t) => wanted.includes(t)).length;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

/** An AI detective tries to solve the case from the player view. Returns { ok, errors, verdict }. */
export async function detectiveCheck(c) {
  const view = buildPlayerView(c);
  const prompt = `You are a sharp detective playing a murder mystery game. Below is EVERYTHING the players can see. Solve it.
- Name the killer (one suspect's full name) and explain your reasoning step by step, citing clue titles and the suspects' claims.
- Look for lies: compare each suspect's claimed rooms and statements with the clues.
- contradictions: list only REAL logical contradictions between CLUES, or between clues and the case facts (for example, two clues placing the same object in different rooms). Suspects lying about where they were is EXPECTED and is NOT a contradiction. Empty array if none.
- singleClueGiveaway: if ONE clue alone names or obviously identifies the killer, give its title; otherwise null.

CASE:
${JSON.stringify(view, null, 2)}`;

  const result = await askJson('detective', {
    messages: [{ role: 'user', content: prompt }],
    schema: VerdictSchema,
    schemaHint: VERDICT_SHAPE,
    maxTokens: 4000,
    temperature: 0.2,
  });

  const v = result.data;
  const killer = c.suspects.find((s) => s.id === c.truth.killerId);
  const accused = matchSuspect(v.killerName, c.suspects);
  const errors = [];

  if (!accused) {
    errors.push(`A test detective accused "${v.killerName}", who is not a suspect. The clues may be unclear.`);
  } else if (accused.id !== c.truth.killerId) {
    errors.push(
      `A test detective wrongly accused ${accused.name}. Make the truth clues point more clearly at ${killer.name}: ` +
        `one clue must contradict ${killer.name}'s claimed room at ${c.truth.slot}.`,
    );
  }
  for (const issue of v.contradictions) errors.push(`Contradiction found by a test detective: ${issue}`);
  if (v.singleClueGiveaway) {
    errors.push(`The clue "${v.singleClueGiveaway}" gives away the killer on its own. Make the solution require combining 2 to 3 clues.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    verdict: { ...v, accusedId: accused?.id ?? null, correct: accused?.id === c.truth.killerId, provider: result.provider },
  };
}
