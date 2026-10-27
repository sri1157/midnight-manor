import { useGame } from './lib/useGame.js';
import Home from './pages/Home.jsx';

export default function App() {
  const game = useGame();

  if (!game.room) {
    return <Home connected={game.connected} onCreate={game.createRoom} onJoin={game.joinRoom} />;
  }

  // Temporary until the lobby (Session 4)
  return (
    <main style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 16, textAlign: 'center' }}>
      <div>
        <p style={{ color: 'var(--text-dim)' }}>Room code</p>
        <h1 style={{ color: 'var(--gold)', fontSize: '3rem', letterSpacing: '0.3em' }}>{game.room.code}</h1>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {game.room.players.map((p) => (
            <li key={p.id} style={{ color: p.connected ? p.color : 'var(--text-dim)' }}>
              {p.name}{p.isHost ? ' (host)' : ''}{p.id === game.me?.id ? ' (you)' : ''}
            </li>
          ))}
        </ul>
        <button className="btn btn-ghost" onClick={game.leaveRoom}>Leave</button>
      </div>
    </main>
  );
}
