import { useState } from 'react';
import './Home.css';

const loadName = () => {
  try { return localStorage.getItem('mm.name') ?? ''; } catch { return ''; }
};

export default function Home({ connected, onCreate, onJoin }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(null); // 'create' | 'join' | null
  const [error, setError] = useState('');

  async function run(kind, action) {
    setError('');
    if (!name.trim()) return setError('Tell the butler your name first.');
    try { localStorage.setItem('mm.name', name.trim()); } catch { /* ignore */ }
    setBusy(kind);
    const reply = await action();
    setBusy(null);
    if (!reply.ok) setError(reply.message);
  }

  const handleCreate = (e) => {
    e.preventDefault();
    run('create', () => onCreate(name));
  };

  const handleJoin = (e) => {
    e.preventDefault();
    run('join', () => onJoin(code, name));
  };

  return (
    <main className="home">
      <div className="fog fog-a" aria-hidden="true" />
      <div className="fog fog-b" aria-hidden="true" />

      <section className="home-card">
        <div className="candle" aria-hidden="true">
          <span className="flame" />
        </div>

        <h1 className="home-title">Midnight Manor</h1>
        <p className="home-tagline">Every guest has a secret. One of them is a killer.</p>

        <form onSubmit={handleCreate} className="home-form">
          <label className="home-label" htmlFor="name">Your name</label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Detective..."
            autoComplete="nickname"
          />
          <button className="btn" type="submit" disabled={!connected || busy !== null}>
            {busy === 'create' ? 'Opening the doors...' : 'Create a room'}
          </button>
        </form>

        <div className="home-divider"><span>or join your friends</span></div>

        <form onSubmit={handleJoin} className="home-join">
          <input
            className="input home-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
            placeholder="CODE"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <button className="btn btn-ghost" type="submit" disabled={!connected || busy !== null || code.length !== 4}>
            {busy === 'join' ? 'Knocking...' : 'Join'}
          </button>
        </form>

        {error && <p className="home-error" role="alert">{error}</p>}

        <p className={`home-status ${connected ? 'is-on' : ''}`}>
          {connected ? 'The manor awaits' : 'Knocking on the door...'}
        </p>
      </section>
    </main>
  );
}
