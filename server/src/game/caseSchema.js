import { z } from 'zod';
import { ROOM_IDS, TIME_SLOTS, SUSPECT_IDS, EVENT_TYPES } from './mansion.js';

const RoomId = z.enum(ROOM_IDS);
const Slot = z.enum(TIME_SLOTS);
const SuspectId = z.enum(SUSPECT_IDS);

/** { "20:00": roomId, "20:30": roomId, ... } for every slot. */
const Whereabouts = z.object(Object.fromEntries(TIME_SLOTS.map((slot) => [slot, RoomId])));

export const SuspectSchema = z.object({
  id: SuspectId,
  name: z.string().min(2),
  occupation: z.string().min(2),
  personality: z.string().min(5),
  voice: z.object({
    pitch: z.number().min(0.5).max(2),
    rate: z.number().min(0.5).max(2),
  }),
  motive: z.string().min(10),
  secret: z.string().min(10),        // what they hide that is NOT the murder (or, for the killer, the murder)
  publicStory: z.string().min(10),   // what they tell detectives about their evening
  whereabouts: Whereabouts,          // where they REALLY were
  claimedWhereabouts: Whereabouts,   // where they SAY they were
  isKiller: z.boolean(),
});

export const ClueSchema = z.object({
  id: z.string().regex(/^c\d+$/),
  room: RoomId,
  title: z.string().min(2),
  description: z.string().min(10),
  type: z.enum(['object', 'document', 'testimony']),
  pointsTo: z.enum(['truth', 'red_herring']),
  proves: z.string().min(5),
  aboutSuspectId: SuspectId.nullish(),
  unlockedByEventId: z.string().nullish(),
});

export const EventSchema = z.object({
  id: z.string().regex(/^e\d+$/),
  type: z.enum(EVENT_TYPES),
  minute: z.number().int().min(2).max(14),
  narratorLine: z.string().min(10),
  targetSuspectId: SuspectId.nullish(),
  secondVictimName: z.string().nullish(),
});

export const CaseSchema = z.object({
  title: z.string().min(3),
  setting: z.string().min(10),
  intro: z.string().min(20),
  victim: z.object({
    name: z.string().min(2),
    role: z.string().min(2),
    room: RoomId,
    causeOfDeath: z.string().min(5),
    timeOfDeath: Slot,
  }),
  suspects: z.array(SuspectSchema).length(4),
  truth: z.object({
    killerId: SuspectId,
    motive: z.string().min(10),
    method: z.string().min(10),
    weapon: z.string().min(2),
    room: RoomId,
    slot: Slot,
  }),
  clues: z.array(ClueSchema).min(8).max(10),
  events: z.array(EventSchema).length(3),
  reveal: z.array(z.string().min(10)).min(4).max(8),
});

const slotMap = `{ ${TIME_SLOTS.map((s) => `"${s}": roomId`).join(', ')} }`;

/** The same shape as text, for the AI. */
export const CASE_SHAPE = `{
  "title": string,
  "setting": string (one sentence: the occasion and mood),
  "intro": string (2-3 sentences the narrator reads at the start),
  "victim": { "name": string, "role": string, "room": roomId, "causeOfDeath": string, "timeOfDeath": slot },
  "suspects": [ 4 x {
    "id": "s1" | "s2" | "s3" | "s4",
    "name": string, "occupation": string, "personality": string,
    "voice": { "pitch": number 0.5-2, "rate": number 0.5-2 },
    "motive": string, "secret": string, "publicStory": string,
    "whereabouts": ${slotMap},
    "claimedWhereabouts": ${slotMap},
    "isKiller": boolean
  } ],
  "truth": { "killerId": suspectId, "motive": string, "method": string, "weapon": string, "room": roomId, "slot": slot },
  "clues": [ 8-10 x {
    "id": "c1", "room": roomId, "title": string, "description": string,
    "type": "object" | "document" | "testimony",
    "pointsTo": "truth" | "red_herring",
    "proves": string, "aboutSuspectId": suspectId or null, "unlockedByEventId": eventId or null
  } ],
  "events": [ 3 x {
    "id": "e1", "type": "blackout" | "second_body" | "escape", "minute": integer,
    "narratorLine": string, "targetSuspectId": suspectId or null, "secondVictimName": string or null
  } ],
  "reveal": [ 4-7 strings ]
}`;
