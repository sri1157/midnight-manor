/** The mansion as drawn on screen, in world units. Connections mirror the server's mansion.js. */
export const WORLD = { width: 1100, height: 460 };

export const MAP_ROOMS = [
  { id: 'library', name: 'Library',     x: 260, y: 30,  w: 220, h: 140, connects: ['hall', 'study'] },
  { id: 'study',   name: 'Study',       x: 560, y: 30,  w: 220, h: 140, connects: ['hall', 'library'] },
  { id: 'garden',  name: 'Garden',      x: 20,  y: 260, w: 200, h: 150, connects: ['hall'] },
  { id: 'hall',    name: 'Grand Hall',  x: 300, y: 240, w: 340, h: 190, connects: ['library', 'study', 'kitchen', 'garden'] },
  { id: 'kitchen', name: 'Kitchen',     x: 710, y: 260, w: 170, h: 150, connects: ['hall', 'cellar'] },
  { id: 'cellar',  name: 'Wine Cellar', x: 910, y: 260, w: 170, h: 150, connects: ['kitchen'] },
];

export const roomById = (id) => MAP_ROOMS.find((r) => r.id === id);
export const roomName = (id) => roomById(id)?.name ?? id;
export const centerOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Each doorway once: [['library', 'hall'], ...]. */
export const CORRIDORS = MAP_ROOMS.flatMap((r) =>
  r.connects.filter((other) => r.id < other).map((other) => [r.id, other]),
);
