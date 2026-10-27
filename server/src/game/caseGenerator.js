import { askJson } from '../ai/jsonGuard.js';
import { CaseSchema, CASE_SHAPE } from './caseSchema.js';
import { describeMansion, TIME_SLOTS, SUSPECT_IDS } from './mansion.js';

const THEMES = [
  'a 1920s jazz-age birthday party during a thunderstorm',
  'a séance that goes horribly wrong',
  'the reading of a rich old aristocrat\'s will',
  'a masquerade ball where everyone wears a mask',
  'a stormy family reunion with old grudges',
  'a monsoon-night dinner in a colonial-era mansion',
  'an engagement party hiding a scandal',
];

export const pickTheme = () => THEMES[Math.floor(Math.random() * THEMES.length)];

export function buildCasePrompt(theme, feedback = [], previousCase = null) {
  const revisionBlock = previousCase
    ? `\nYOU ARE REVISING A CASE YOU WROTE BEFORE. It broke the rules below. Keep the same characters and story where possible, and fix ONLY these problems:
- ${feedback.join('\n- ')}

PREVIOUS CASE:
${JSON.stringify(previousCase)}
`
    : '';

  return `You are a master mystery novelist designing a FAIR, SOLVABLE murder mystery for a party game called Midnight Manor.

THEME: ${theme}

THE MANSION (use ONLY these room ids):
${describeMansion()}

TIME SLOTS (use ONLY these): ${TIME_SLOTS.join(', ')}

RULES (every rule must hold):
1. Exactly 4 suspects with ids ${SUSPECT_IDS.join(', ')}. Exactly one has isKiller true, and truth.killerId is that suspect's id.
2. victim.room equals truth.room, and victim.timeOfDeath equals truth.slot.
3. The killer's whereabouts at truth.slot is truth.room. NO other suspect's whereabouts at truth.slot is truth.room.
4. "whereabouts" is where each suspect REALLY was. "claimedWhereabouts" is what they will tell detectives.
   - The killer's claimedWhereabouts at truth.slot is NOT truth.room (the killer lies about the murder).
   - Each innocent suspect lies about at most 2 slots, only to hide their personal "secret", which is NOT the murder.
5. Clues: 8 to 10, ids c1, c2, c3 and so on. Every clue's room is a real room id.
   - At least 4 clues have pointsTo "truth"; at least 2 of them have aboutSuspectId equal to the killer's id.
   - 2 or 3 clues have pointsTo "red_herring"; each one's aboutSuspectId is an INNOCENT suspect.
   - "proves" states, in plain words, the fact the clue shows.
6. Exactly 2 clues are hidden until an event: set their unlockedByEventId to that event's id. All other clues: null.
7. Events: exactly 3, in this order:
   - e1: type "blackout" at minute 4. targetSuspectId null.
   - e2: type "second_body" at minute 8. A household staff member who is NOT one of the 4 suspects is found dead (set secondVictimName); the killer silenced them.
   - e3: type "escape" at minute 11. An INNOCENT suspect tries to flee (set targetSuspectId) to create false suspicion.
   Each narratorLine is one dramatic sentence.
8. reveal: 4 to 7 short steps the narrator reads at the end, explaining how the clues prove the truth.
9. voice pitch and rate are between 0.5 and 2 and fit each personality (low and slow for an old colonel, high and fast for a nervous maid).
10. Fictional people only. Violence stays non-graphic.
11. The title is unique and evocative (for example "The Last Toast at Ravenscroft"), never just "Midnight Manor Murder".
12. publicStory is in FIRST PERSON, exactly as the suspect would say it: "I was in the study all evening...".
13. The 3 events happen NOW, during the detectives' investigation, AFTER the evening of the murder. No clue may say something happened "before the blackout" or link the evening's times to the events.
14. Never write internal ids (s1, c3, e2) in any text. Use people's names and clue titles.
15. No single clue may identify the killer on its own. BANNED in truth clues: fingerprints, initials, monograms, signatures, a note "signed" by anyone, a name written on an object, a confession, or a witness who saw the murder itself.
    The solution must COMBINE clues, like this recipe:
    - one clue quietly contradicts the killer's claimed room at truth.slot (an item from their claimed room's activity found in the murder room, a witness who saw them heading there, a detail only someone present would know);
    - one clue reveals the motive WITHOUT naming the killer directly (a debt ledger with an amount, a torn letter whose recipient must be deduced);
    - one clue connects the method or weapon to the killer's occupation, habits or skills.
16. Every clue must be consistent with the truth and with every other clue. Double-check who wrote what, who blackmailed whom, and who was where.
17. A clue that makes an innocent suspect look guilty is ALWAYS "red_herring", never "truth".
${revisionBlock}`;
}

/** Generate (or revise) one case. Shape is guaranteed by the schema; logic is checked by the engine. */
export async function generateCase({ theme = pickTheme(), feedback = [], previousCase = null } = {}) {
  const result = await askJson('case', {
    messages: [{ role: 'user', content: buildCasePrompt(theme, feedback, previousCase) }],
    schema: CaseSchema,
    schemaHint: CASE_SHAPE,
    maxTokens: 8000,
    temperature: previousCase ? 0.5 : 0.9,
  });

  return {
    caseData: result.data,
    meta: {
      theme,
      provider: result.provider,
      model: result.model,
      repaired: result.repaired,
      generatedAt: new Date().toISOString(),
    },
  };
}
