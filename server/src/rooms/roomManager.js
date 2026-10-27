import { randomInt, randomUUID } from 'node:crypto';
import { config } from '../config.js';

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

  room.status = 'playing';
  room.startedAt = Date.now();
  return room;
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
  };
}
