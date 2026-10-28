import { randomInt } from 'node:crypto';
import { ROOMS } from './mansion.js';

export const ASK_COOLDOWN_MS = 8000; // per player, between questions: protects the free AI quota

const SUSPECT_ROOMS = ROOMS.map((r) => r.id).filter((id) => id !== 'hall'); // players start in the hall

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Called once when the host starts the game. */
export function setupGame(room) {
  const c = room.case.data;
  const rooms = shuffle(SUSPECT_ROOMS);
  room.game = {
    gameId: `${room.code}-${Date.now()}`,
    suspectRooms: Object.fromEntries(c.suspects.map((s, i) => [s.id, rooms[i]])),
    found: [],          // [{ id, by, at }]
    searchedRooms: [],
    firedEventIds: [],  // filled by the event director in Session 6
    conversations: {}, // suspectId -> [{ asker, q, a }]
    busy: {},          // suspectId -> true while answering
  };
}

/** Reveal the clues in the player's current room. Returns how many are new. */
export function revealClues(room, player) {
  const c = room.case.data;
  const g = room.game;
  const here = player.location;

  const fresh = c.clues.filter(
    (clue) =>
      clue.room === here &&
      !g.found.some((f) => f.id === clue.id) &&
      (!clue.unlockedByEventId || g.firedEventIds.includes(clue.unlockedByEventId)),
  );

  for (const clue of fresh) g.found.push({ id: clue.id, by: player.name, at: Date.now() });
  if (!g.searchedRooms.includes(here)) g.searchedRooms.push(here);
  return fresh.length;
}

/** What browsers may see during the game. No truth, secrets, real whereabouts or clue labels. */
export function gameView(room) {
  const c = room.case.data;
  const g = room.game;
  return {
    setting: c.setting,
    intro: c.intro,
    victim: {
      name: c.victim.name,
      role: c.victim.role,
      room: c.victim.room,
      causeOfDeath: c.victim.causeOfDeath,
      timeOfDeath: c.victim.timeOfDeath,
    },
    suspects: c.suspects.map((s) => ({
      id: s.id,
      name: s.name,
      occupation: s.occupation,
      personality: s.personality,
      says: s.publicStory,
      claims: s.claimedWhereabouts,
      voice: s.voice,
      location: g.suspectRooms[s.id],
    })),
    clues: g.found.map((f) => {
      const clue = c.clues.find((x) => x.id === f.id);
      return { id: clue.id, title: clue.title, description: clue.description, room: clue.room, foundBy: f.by };
    }),
    searchedRooms: g.searchedRooms,
    interrogations: Object.fromEntries(
      c.suspects.map((s) => [s.id, (g.conversations[s.id] ?? []).slice(-20).map(({ asker, q, a }) => ({ asker, q, a }))]),
    ),
    thinking: Object.keys(g.busy).filter((id) => g.busy[id]),
    askCooldownMs: ASK_COOLDOWN_MS,
    clock: g.endsAt ? { endsAt: g.endsAt, serverNow: Date.now() } : null,
    blackoutUntil: g.blackoutUntil ?? 0,
    lastEvent: g.lastEvent ?? null,
    secondVictim: g.secondVictim ?? null,
    timeUp: Boolean(g.timeUp),
  };
}
