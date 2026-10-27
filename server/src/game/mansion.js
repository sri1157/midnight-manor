/** The fixed Midnight Manor map. The AI places people and clues; it never invents rooms. */
export const ROOMS = [
  { id: 'hall',    name: 'Grand Hall',  connects: ['library', 'study', 'kitchen', 'garden'] },
  { id: 'library', name: 'Library',     connects: ['hall', 'study'] },
  { id: 'study',   name: 'Study',       connects: ['hall', 'library'] },
  { id: 'kitchen', name: 'Kitchen',     connects: ['hall', 'cellar'] },
  { id: 'cellar',  name: 'Wine Cellar', connects: ['kitchen'] },
  { id: 'garden',  name: 'Garden',      connects: ['hall'] },
];

export const ROOM_IDS = ROOMS.map((r) => r.id);

/** The evening of the murder, in half-hour slots. */
export const TIME_SLOTS = ['20:00', '20:30', '21:00', '21:30', '22:00', '22:30'];

export const SUSPECT_IDS = ['s1', 's2', 's3', 's4'];

export const EVENT_TYPES = ['blackout', 'second_body', 'escape'];

export const roomName = (id) => ROOMS.find((r) => r.id === id)?.name ?? id;

/** The map as text, for AI prompts. */
export function describeMansion() {
  return ROOMS.map((r) => `- ${r.id} (${r.name}): connects to ${r.connects.join(', ')}`).join('\n');
}
