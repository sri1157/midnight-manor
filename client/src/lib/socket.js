import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001', {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
});

/** Send an event and wait for the server's reply, with a timeout. */
export function request(event, payload = {}, timeoutMs = 8000) {
  return new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(event, payload, (err, reply) => {
      if (err) resolve({ ok: false, error: 'TIMEOUT', message: 'The manor is not answering. Try again.' });
      else resolve(reply);
    });
  });
}

const SESSION_KEY = 'mm.session';

export function saveSession(session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* storage blocked: game still works */ }
}

export function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
