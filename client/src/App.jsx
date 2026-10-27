import { useGame } from './lib/useGame.js';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';

export default function App() {
  const game = useGame();

  if (!game.room) {
    return <Home connected={game.connected} onCreate={game.createRoom} onJoin={game.joinRoom} />;
  }

  if (game.room.status === 'lobby') {
    return <Lobby room={game.room} me={game.me} onStart={game.startGame} onLeave={game.leaveRoom} />;
  }

  // Temporary until the mansion map (Session 5)
  return (
    <main style={{ display: 'grid', placeItems: 'center', height: '100%', textAlign: 'center', padding: 16 }}>
      <div>
        <h1 style={{ color: 'var(--gold)' }}>The doors are locked.</h1>
        <p style={{ color: 'var(--text-dim)' }}>The investigation begins... (map coming in Session 5)</p>
      </div>
    </main>
  );
}
