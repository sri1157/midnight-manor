/** The mansion as drawn on screen, in world units. Connections mirror the server's mansion.js. */
export const WORLD = { width: 1100, height: 500 };

export const MAP_ROOMS = [
  { id: 'garden',  name: 'Garden',      floor: 'grass',  x: 10,  y: 20,  w: 210, h: 460, connects: ['hall'] },
  { id: 'library', name: 'Library',     floor: 'wood',   x: 250, y: 20,  w: 270, h: 200, connects: ['hall', 'study'] },
  { id: 'study',   name: 'Study',       floor: 'wood',   x: 580, y: 20,  w: 270, h: 200, connects: ['hall', 'library'] },
  { id: 'cellar',  name: 'Wine Cellar', floor: 'stone',  x: 880, y: 20,  w: 210, h: 200, connects: ['kitchen'] },
  { id: 'hall',    name: 'Grand Hall',  floor: 'marble', x: 250, y: 260, w: 600, h: 220, connects: ['library', 'study', 'kitchen', 'garden'] },
  { id: 'kitchen', name: 'Kitchen',     floor: 'tiles',  x: 880, y: 260, w: 210, h: 220, connects: ['hall', 'cellar'] },
];

export const roomById = (id) => MAP_ROOMS.find((r) => r.id === id);
export const roomName = (id) => roomById(id)?.name ?? id;
export const centerOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Each doorway once: [['library', 'hall'], ...]. */
export const CORRIDORS = MAP_ROOMS.flatMap((r) =>
  r.connects.filter((other) => r.id < other).map((other) => [r.id, other]),
);
