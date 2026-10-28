import { randomInt, randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { ROOMS } from '../game/mansion.js';
import { setupGame, revealClues, gameView, ASK_COOLDOWN_MS } from '../game/gameState.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: easy to read aloud
const MAX_PLAYERS = 8;
const AVATAR_COLORS = ['#e4572e', '#f3a712', '#669bbc', '#a8c686', '#c06c84', '#8e7dbe', '#f67280', '#4ecdc4'];

const rooms = new Map();  // code -> room
const tokens = new Map(); // secret token -> { code, playerId }

export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}

function newCode() {
  for (let i = 0; i < 50; i++) {
    let code = '';
    for (let j = 0; j < 4; j++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    if (!rooms.has(code)) return code;
  }
  throw new RoomError('NO_CODES', 'Could not create a room right now. Try again.');
}

function cleanName(name) {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 20);
  if (!clean) throw new RoomError('BAD_NAME', 'Please enter your name.');
  return clean;
}

function addPlayer(room, rawName, isHost) {
  const name = cleanName(rawName);
  if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new RoomError('NAME_TAKEN', 'Someone in this room already has that name.');
  }
  const player = {
    id: randomUUID(),
    name,
    isHost,
    color: AVATAR_COLORS.find((c) => !room.players.some((p) => p.color === c)) ?? AVATAR_COLORS[0],
    connected: true,
    location: 'hall',
  };
  room.players.push(player);
  const token = randomUUID();
  tokens.set(token, { code: room.code, playerId: player.id });
  return { player, token };
}

export function getRoom(rawCode) {
  const room = rooms.get(String(rawCode ?? '').trim().toUpperCase());
  if (!room) throw new RoomError('NOT_FOUND', 'No room with that code.');
  return room;
}

export function createRoom(hostName) {
  const code = newCode();
  const room = {
    code,
    status: 'lobby',
    createdAt: Date.now(),
    players: [],
    case: { status: 'loading', id: null, data: null }, // data stays on the server, always
  };
  rooms.set(code, room);
  try {
    const { player, token } = addPlayer(room, hostName, true);
    return { room, player, token };
  } catch (err) {
    rooms.delete(code); // bad host name: don't leave an empty room behind
    throw err;
  }
}

export function joinRoom(rawCode, name) {
  const room = getRoom(rawCode);
  if (room.status !== 'lobby') throw new RoomError('GAME_STARTED', 'This game has already started.');
  if (room.players.length >= MAX_PLAYERS) throw new RoomError('ROOM_FULL', `This room is full (${MAX_PLAYERS} players).`);
  const { player, token } = addPlayer(room, name, false);
  return { room, player, token };
}

export function resumeSession(token) {
  const ref = tokens.get(token);
  if (!ref) throw new RoomError('BAD_TOKEN', 'Your session has expired. Please join again.');
  const room = rooms.get(ref.code);
  const player = room?.players.find((p) => p.id === ref.playerId);
  if (!room || !player) {
    tokens.delete(token);
    throw new RoomError('BAD_TOKEN', 'That game no longer exists. Please join again.');
  }
  player.connected = true;
  return { room, player };
}

/** Mark a player online or offline. Returns the room, or null if it no longer exists. */
export function setConnected(code, playerId, connected) {
  const room = rooms.get(code);
  const player = room?.players.find((p) => p.id === playerId);
  if (!player) return null;
  player.connected = connected;
  return room;
}

/** Remove a player for good. Hands the host role on; deletes the room if empty. */
export function leaveRoom(code, playerId) {
  const room = rooms.get(code);
  if (!room) return null;

  room.players = room.players.filter((p) => p.id !== playerId);
  for (const [token, ref] of tokens) {
    if (ref.playerId === playerId) tokens.delete(token);
  }

  if (room.players.length === 0) {
    rooms.delete(code);
    return null;
  }
  if (!room.players.some((p) => p.isHost)) {
    const next = room.players.find((p) => p.connected) ?? room.players[0];
    next.isHost = true;
  }
  return room;
}

/** The host starts the game. Every rule is checked here, not just in the browser. */
export function startGame(code, playerId) {
  const room = getRoom(code);
  const player = room.players.find((p) => p.id === playerId);

  if (!player?.isHost) throw new RoomError('NOT_HOST', 'Only the host can start the game.');
  if (room.status !== 'lobby') throw new RoomError('GAME_STARTED', 'The game has already started.');

  const present = room.players.filter((p) => p.connected).length;
  if (present < config.minPlayers) {
    throw new RoomError('NOT_ENOUGH_PLAYERS', `You need at least ${config.minPlayers} detectives to start.`);
  }
  if (room.case.status !== 'ready') throw new RoomError('CASE_NOT_READY', 'The mystery is not ready yet.');

  setupGame(room);
  room.status = 'playing';
  room.startedAt = Date.now();
  return room;
}

/** Move a player through a doorway. The server checks the doors, not the browser. */
export function movePlayer(code, playerId, to) {
  const room = getRoom(code);
  if (room.status !== 'playing') throw new RoomError('NOT_PLAYING', 'The investigation has not started yet.');

  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new RoomError('NOT_IN_ROOM', 'You are not in this game.');

  const target = ROOMS.find((r) => r.id === to);
  if (!target) throw new RoomError('BAD_ROOM', 'That room does not exist.');
  if (to === player.location) return room;

  const here = ROOMS.find((r) => r.id === player.location);
  if (!here?.connects.includes(to)) throw new RoomError('NO_DOOR', 'No door leads there from here.');

  player.location = to;
  return room;
}

/** Search the player's current room for clues. */
export function searchRoom(code, playerId) {
  const room = getRoom(code);
  if (room.status !== 'playing') throw new RoomError('NOT_PLAYING', 'The investigation has not started yet.');
  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new RoomError('NOT_IN_ROOM', 'You are not in this game.');
  const added = revealClues(room, player);
  return { room, added };
}

/** Check a question and record it as pending. The AI answers afterwards. */
export function beginQuestion(code, playerId, suspectId, question) {
  const room = getRoom(code);
  if (room.status !== 'playing') throw new RoomError('NOT_PLAYING', 'The investigation has not started yet.');
  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new RoomError('NOT_IN_ROOM', 'You are not in this game.');

  const g = room.game;
  if (!(suspectId in g.suspectRooms)) throw new RoomError('BAD_SUSPECT', 'No such suspect.');
  if (g.suspectRooms[suspectId] !== player.location) throw new RoomError('NOT_HERE', 'That suspect is not in this room.');
  if (g.busy[suspectId]) throw new RoomError('SUSPECT_BUSY', 'They are already answering someone. Wait a moment.');

  const waitMs = (player.lastAskAt ?? 0) + ASK_COOLDOWN_MS - Date.now();
  if (waitMs > 0) {
    throw new RoomError('COOLDOWN', `Catch your breath. You can ask again in ${Math.ceil(waitMs / 1000)}s.`);
  }

  const q = String(question ?? '').trim().slice(0, 300);
  if (!q) throw new RoomError('EMPTY_QUESTION', 'Ask them something first.');

  const entry = { asker: player.name, q, a: null };
  (g.conversations[suspectId] ??= []).push(entry);
  g.busy[suspectId] = true;
  player.lastAskAt = Date.now();
  return { room, entry };
}

/** Store the answer, or remove the question if the suspect could not answer. */
export function finishQuestion(room, suspectId, entry, answer) {
  const conv = room.game.conversations[suspectId];
  if (answer) entry.a = answer;
  else conv.splice(conv.indexOf(entry), 1);
  room.game.busy[suspectId] = false;
}

/** The ONLY room data ever sent to browsers. No case contents, no tokens. */
export function publicRoomState(room) {
  return {
    code: room.code,
    status: room.status,
    minPlayers: config.minPlayers,
    maxPlayers: MAX_PLAYERS,
    players: room.players.map(({ id, name, isHost, color, connected, location }) => ({
      id, name, isHost, color, connected, location,
    })),
    case: { status: room.case.status, title: room.case.data?.title ?? null },
    game: room.game ? gameView(room) : null,
  };
}
