import { TIME_SLOTS, EVENT_TYPES } from './mansion.js';

const ID_PATTERN = /\b[cse]\d{1,2}\b/i;                 // c3, s2, e1 ...
const FIRST_PERSON = /\b(I|I'm|I've|I'd|I'll|me|my|My)\b/;
const GENERIC_TITLE = /^(the )?midnight manor( murders?)?$/i;
const EVENT_WORDS = /\b(blackout|lights (went|go) out|second body|power cut)\b/i;
const GIVEAWAY_WORDS = /\b(fingerprints?|initials|monogram(med)?|signed|signature)\b/i;

/** Code-level logic checks. Returns { ok, errors }; errors are written for the AI to fix. */
export function validateCase(c) {
  const errors = [];
  const fail = (msg) => errors.push(msg);
  const { room, slot, killerId } = c.truth;

  // --- suspects and the killer ---
  const ids = c.suspects.map((s) => s.id);
  if (new Set(ids).size !== ids.length) fail('Suspect ids must be unique: s1, s2, s3, s4.');

  const killers = c.suspects.filter((s) => s.isKiller);
  if (killers.length !== 1) fail(`Exactly one suspect must have isKiller true (found ${killers.length}).`);

  const killer = c.suspects.find((s) => s.id === killerId);
  if (!killer) fail(`truth.killerId "${killerId}" does not match any suspect.`);
  else if (!killer.isKiller) fail(`truth.killerId points to ${killer.name}, but ${killer.name} does not have isKiller true.`);

  if (c.victim.room !== room) fail('victim.room must equal truth.room.');
  if (c.victim.timeOfDeath !== slot) fail('victim.timeOfDeath must equal truth.slot.');

  if (killer) {
    if (killer.whereabouts[slot] !== room) {
      fail(`The killer, ${killer.name}, must really be in ${room} at ${slot} (whereabouts).`);
    }
    if (killer.claimedWhereabouts[slot] === room) {
      fail(`The killer, ${killer.name}, must lie about ${slot}: claimedWhereabouts at ${slot} must not be ${room}.`);
    }
  }

  for (const s of c.suspects) {
    if (!FIRST_PERSON.test(s.publicStory)) {
      fail(`${s.name}'s publicStory must be in first person, as they would say it ("I was...").`);
    }
    if (s.id === killerId) continue;
    if (s.whereabouts[slot] === room) {
      fail(`Innocent ${s.name} must not be in ${room} at ${slot}, the time and place of the murder.`);
    }
    const lies = TIME_SLOTS.filter((t) => s.whereabouts[t] !== s.claimedWhereabouts[t]);
    if (lies.length > 2) fail(`Innocent ${s.name} lies about ${lies.length} slots; the maximum is 2.`);
  }

  // --- clues ---
  const clueIds = c.clues.map((x) => x.id);
  if (new Set(clueIds).size !== clueIds.length) fail('Clue ids must be unique.');

  const truthClues = c.clues.filter((x) => x.pointsTo === 'truth');
  const herrings = c.clues.filter((x) => x.pointsTo === 'red_herring');
  if (truthClues.length < 4) fail(`At least 4 clues must point to the truth (found ${truthClues.length}).`);
  if (herrings.length < 2 || herrings.length > 3) fail(`There must be 2 or 3 red herrings (found ${herrings.length}).`);

  const aboutKiller = truthClues.filter((x) => x.aboutSuspectId === killerId).length;
  if (aboutKiller < 2) fail(`At least 2 truth clues must have aboutSuspectId set to the killer (found ${aboutKiller}).`);

  for (const h of herrings) {
    if (h.aboutSuspectId === killerId) {
      fail(`Red herring "${h.title}" must point at an innocent suspect, not the killer.`);
    }
  }

  for (const x of truthClues) {
    if (x.aboutSuspectId && x.aboutSuspectId !== killerId) {
      fail(`Clue "${x.title}" is about an innocent suspect, so it must be "red_herring", not "truth".`);
    }
    if (GIVEAWAY_WORDS.test(`${x.title} ${x.description}`)) {
      fail(`Clue "${x.title}" uses a banned giveaway (fingerprints, initials, monograms or signatures). Make the killer deducible only by combining clues.`);
    }
  }

  for (const x of c.clues) {
    if (EVENT_WORDS.test(x.description)) {
      fail(`Clue "${x.title}" mentions a game event (like the blackout). Events happen during the investigation, not on the night of the murder.`);
    }
  }

  // --- events and locked clues ---
  c.events.forEach((e, i) => {
    if (e.type !== EVENT_TYPES[i]) fail(`Event ${i + 1} must be type "${EVENT_TYPES[i]}" (got "${e.type}").`);
    if (i > 0 && e.minute <= c.events[i - 1].minute) fail('Event minutes must increase: blackout, then second_body, then escape.');
  });

  const eventIds = new Set(c.events.map((e) => e.id));
  const locked = c.clues.filter((x) => x.unlockedByEventId);
  if (locked.length !== 2) fail(`Exactly 2 clues must be unlocked by events (found ${locked.length}).`);
  for (const x of locked) {
    if (!eventIds.has(x.unlockedByEventId)) {
      fail(`Clue "${x.title}" is unlocked by event "${x.unlockedByEventId}", which does not exist.`);
    }
  }

  const escape = c.events.find((e) => e.type === 'escape');
  if (!escape?.targetSuspectId) fail('The escape event must set targetSuspectId to an innocent suspect.');
  else if (escape.targetSuspectId === killerId) fail('The escape event must target an INNOCENT suspect, not the killer.');
  else if (!ids.includes(escape.targetSuspectId)) fail('The escape event targets a suspect who does not exist.');

  const body = c.events.find((e) => e.type === 'second_body');
  if (!body?.secondVictimName) fail('The second_body event must set secondVictimName.');
  else if (c.suspects.some((s) => s.name === body.secondVictimName)) {
    fail('The second victim must be a staff member, not one of the 4 suspects.');
  }

  // --- player-visible text ---
  if (GENERIC_TITLE.test(c.title.trim())) fail('Give the case a unique, evocative title, not just "Midnight Manor".');

  const visibleText = [
    ['title', c.title],
    ['setting', c.setting],
    ['intro', c.intro],
    ...c.suspects.map((s) => [`${s.name}'s publicStory`, s.publicStory]),
    ...c.clues.flatMap((x) => [[`clue "${x.title}"`, x.title], [`clue "${x.title}"`, x.description]]),
    ...c.events.map((e) => [`event ${e.type} narratorLine`, e.narratorLine]),
    ...c.reveal.map((r, i) => [`reveal step ${i + 1}`, r]),
  ];
  for (const [where, text] of visibleText) {
    if (ID_PATTERN.test(text)) fail(`Internal id found in ${where}. Use names and clue titles instead of ids like c1 or s2.`);
  }

  return { ok: errors.length === 0, errors };
}
