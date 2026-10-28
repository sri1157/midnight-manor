import { config } from '../config.js';

const BLACKOUT_MS = 20_000;
const timers = new Map(); // room code -> timeout handles

const scaled = (ms) => Math.round(ms * config.timeScale);

function fireEvent(room, event) {
  const g = room.game;
  const c = room.case.data;
  g.firedEventIds.push(event.id);

  const newClueRooms = [...new Set(c.clues.filter((x) => x.unlockedByEventId === event.id).map((x) => x.room))];
  g.lastEvent = { id: event.id, type: event.type, line: event.narratorLine, newClueRooms, at: Date.now() };

  if (event.type === 'blackout') {
    g.blackoutUntil = Date.now() + BLACKOUT_MS;
  } else if (event.type === 'second_body') {
    g.secondVictim = event.secondVictimName ?? 'a member of staff';
  } else if (event.type === 'escape' && event.targetSuspectId in g.suspectRooms) {
    g.suspectRooms[event.targetSuspectId] = 'garden'; // caught at the garden gate
    g.caughtSuspectId = event.targetSuspectId;
  }
}

export function stopClock(code) {
  for (const handle of timers.get(code) ?? []) clearTimeout(handle);
  timers.delete(code);
}

/** Start the investigation clock. `onChange(room)` is called after every event and at time-up. */
export function startClock(room, onChange) {
  stopClock(room.code);
  const g = room.game;
  const total = scaled(config.gameMinutes * 60_000);
  g.startedAt = Date.now();
  g.endsAt = g.startedAt + total;
  g.timeUp = false;

  const handles = room.case.data.events.map((event) =>
    setTimeout(() => {
      fireEvent(room, event);
      onChange(room);
    }, scaled(event.minute * 60_000)),
  );

  handles.push(setTimeout(() => {
    g.timeUp = true;
    stopClock(room.code);
    onChange(room);
  }, total));

  timers.set(room.code, handles);
}
