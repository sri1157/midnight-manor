import { useState } from 'react';
import './Lobby.css';

const CASE_TEXT = {
  loading: 'The AI is preparing your mystery...',
  none: 'No mysteries are ready yet.',
  error: 'The mystery could not be loaded.',
};

export default function Lobby({ room, me, onStart, onLeave }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const present = room.players.filter((p) => p.connected).length;
  const host = room.players.find((p) => p.isHost);
  const caseReady = room.case.status === 'ready';
  const missing = Math.max(0, room.minPlayers - present);

  let hint = 'Everyone is here. Ready when you are.';
  if (!caseReady) hint = 'Waiting for the mystery...';
  else if (missing > 0) hint = `Need ${missing} more detective${missing > 1 ? 's' : ''} to start.`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy. Share the code by hand.');
    }
  }

  async function start() {
    setError('');
    setBusy(true);
    const reply = await onStart();
    setBusy(false);
    if (!reply.ok) setError(reply.message);
  }

  return (
    <main className="lobby">
      <section className="lobby-card">
        <p className="lobby-eyebrow">Invite your fellow detectives</p>
        <div className="lobby-code-row">
          <h1 className="lobby-code">{room.code}</h1>
          <button className="btn btn-ghost lobby-copy" onClick={copyCode}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className={`lobby-case is-${room.case.status}`}>
          {caseReady ? (
            <>
              <span className="lobby-case-label">Tonight's mystery</span>
              <strong className="lobby-case-title">{room.case.title}</strong>
            </>
          ) : (
            <span>{CASE_TEXT[room.case.status] ?? CASE_TEXT.loading}</span>
          )}
        </div>

        <div className="lobby-players-head">
          <h2>Detectives</h2>
          <span>{room.players.length} / {room.maxPlayers}</span>
        </div>

        <ul className="lobby-players">
          {room.players.map((p) => (
            <li key={p.id} className={`lobby-player ${p.connected ? '' : 'is-offline'}`}>
              <span className="lobby-avatar" style={{ background: p.color }}>{p.name[0]?.toUpperCase()}</span>
              <span className="lobby-name">{p.name}</span>
              {p.isHost && <span className="lobby-badge">Host</span>}
              {p.id === me?.id && <span className="lobby-badge is-you">You</span>}
              {!p.connected && <span className="lobby-badge is-off">Away</span>}
            </li>
          ))}
        </ul>

        {me?.isHost ? (
          <div className="lobby-start">
            <button className="btn" onClick={start} disabled={busy || !caseReady || missing > 0}>
              {busy ? 'Locking the doors...' : 'Start the investigation'}
            </button>
            <p className="lobby-hint">{hint}</p>
          </div>
        ) : (
          <p className="lobby-hint">Waiting for {host?.name ?? 'the host'} to start the game.</p>
        )}

        {error && <p className="home-error" role="alert">{error}</p>}

        <button className="lobby-leave" onClick={onLeave}>Leave room</button>
      </section>
    </main>
  );
}
