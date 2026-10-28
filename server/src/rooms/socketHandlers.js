import {
  createRoom, joinRoom, resumeSession, setConnected, leaveRoom, startGame, movePlayer, searchRoom, publicRoomState, RoomError,
} from './roomManager.js';
import { claimCase, peekCase } from '../db/caseStore.js';
import { isDbConfigured } from '../db/supabase.js';
import { config } from '../config.js';

const channel = (code) => `room:${code}`;

export function registerSocketHandlers(io) {
  const broadcast = (room) => io.to(channel(room.code)).emit('room:state', publicRoomState(room));

  /** Load a case for the room in the background, then tell everyone. */
  async function loadCase(room) {
    if (!isDbConfigured()) {
      room.case.status = 'none';
      return broadcast(room);
    }
    try {
      const found = config.isProduction ? await claimCase() : await peekCase();
      if (found) room.case = { status: 'ready', id: found.id, data: found.caseData };
      else room.case.status = 'none';
    } catch (err) {
      console.error('Loading case failed:', err.message);
      room.case.status = 'error';
    }
    broadcast(room);
  }

  io.on('connection', (socket) => {
    /** Wrap a handler: always reply { ok: true, ... } or { ok: false, error, message }. */
    const handle = (fn) => async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        reply({ ok: true, ...(await fn(payload ?? {})) });
      } catch (err) {
        if (err instanceof RoomError) {
          reply({ ok: false, error: err.code, message: err.message });
        } else {
          console.error(err);
          reply({ ok: false, error: 'SERVER_ERROR', message: 'Something went wrong in the manor.' });
        }
      }
    };

    const bind = (room, player) => {
      socket.data.code = room.code;
      socket.data.playerId = player.id;
      socket.join(channel(room.code));
    };

    socket.on('room:create', handle(async ({ name }) => {
      const { room, player, token } = createRoom(name);
      bind(room, player);
      broadcast(room);
      loadCase(room); // not awaited: runs in the background
      return { token, playerId: player.id, state: publicRoomState(room) };
    }));

    socket.on('room:join', handle(async ({ code, name }) => {
      const { room, player, token } = joinRoom(code, name);
      bind(room, player);
      broadcast(room);
      return { token, playerId: player.id, state: publicRoomState(room) };
    }));

    socket.on('room:resume', handle(async ({ token }) => {
      const { room, player } = resumeSession(token);
      bind(room, player);
      broadcast(room);
      return { playerId: player.id, state: publicRoomState(room) };
    }));

    /** The room and player this socket belongs to, from server-side data only. */
    const seat = () => {
      const { code, playerId } = socket.data;
      if (!code) throw new RoomError('NOT_IN_ROOM', 'You are not in a room.');
      return { code, playerId };
    };

    socket.on('room:leave', handle(async () => {
      const { code, playerId } = seat();
      socket.leave(channel(code));
      socket.data.code = null;
      socket.data.playerId = null;
      const room = leaveRoom(code, playerId);
      if (room) broadcast(room);
      return {};
    }));

    socket.on('game:start', handle(async () => {
      const { code, playerId } = seat();
      const room = startGame(code, playerId);
      broadcast(room);
      return {};
    }));

    socket.on('player:move', handle(async ({ to }) => {
      const { code, playerId } = seat();
      const room = movePlayer(code, playerId, to);
      broadcast(room);
      return {};
    }));

    socket.on('room:search', handle(async () => {
      const { code, playerId } = seat();
      const { room, added } = searchRoom(code, playerId);
      broadcast(room);
      return { added };
    }));

    socket.on('disconnect', () => {
      const { code, playerId } = socket.data;
      if (!code) return;
      const room = setConnected(code, playerId, false);
      if (room) broadcast(room);
    });
  });
}
