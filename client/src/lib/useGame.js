import { useCallback, useEffect, useState } from 'react';
import { socket, request, saveSession, loadSession, clearSession } from './socket.js';

export function useGame() {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    const onConnect = async () => {
      setConnected(true);
      const saved = loadSession();
      if (!saved?.token) return;
      const reply = await request('room:resume', { token: saved.token });
      if (reply.ok) {
        setPlayerId(reply.playerId);
        setRoom(reply.state);
      } else {
        clearSession(); // stale token: back to the home screen
      }
    };
    const onDisconnect = () => setConnected(false);
    const onState = (state) => setRoom(state);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);

    if (socket.connected) onConnect(); // hot reload: already connected, no new event
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
    };
  }, []);

  /** After a successful create or join: remember the session and enter the room. */
  const enter = useCallback((reply) => {
    if (reply.ok) {
      saveSession({ token: reply.token, code: reply.state.code });
      setPlayerId(reply.playerId);
      setRoom(reply.state);
    }
    return reply;
  }, []);

  const createRoom = useCallback(async (name) => enter(await request('room:create', { name })), [enter]);
  const joinRoom = useCallback(async (code, name) => enter(await request('room:join', { code, name })), [enter]);

  const leaveRoom = useCallback(async () => {
    await request('room:leave'); // tell the server, so others see you leave
    clearSession();
    setRoom(null);
    setPlayerId(null);
  }, []);

  const startGame = useCallback(() => request('game:start'), []);
  const movePlayer = useCallback((to) => request('player:move', { to }), []);
  const searchRoom = useCallback(() => request('room:search'), []);
  const askSuspect = useCallback(
    (suspectId, question) => request('suspect:ask', { suspectId, question }, 30000),
    [],
  );

  const me = room?.players.find((p) => p.id === playerId) ?? null;

  return { connected, room, me, createRoom, joinRoom, leaveRoom, startGame, movePlayer, searchRoom, askSuspect };
}
