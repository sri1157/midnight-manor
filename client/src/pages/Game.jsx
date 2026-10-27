import { useState } from 'react';
import MansionMap from '../map/MansionMap.jsx';
import { roomName } from '../map/layout.js';
import './Game.css';

export default function Game({ room, me, onMove, onLeave }) {
  const [notice, setNotice] = useState('');

  return (
    <main className="game">
      <header className="game-bar">
        <h1 className="game-title">{room.case.title ?? 'Midnight Manor'}</h1>
        <p className="game-where">
          You are in the <strong>{roomName(me?.location)}</strong>
        </p>
        <button className="lobby-leave" onClick={onLeave}>Leave</button>
      </header>

      <div className="game-map">
        <MansionMap
          players={room.players}
          meId={me?.id}
          onMove={onMove}
          onBlocked={setNotice}
        />
      </div>

      <p className="game-hint">Tap a connected room to walk there.</p>

      {notice && <p className="game-toast" role="status">{notice}</p>}
    </main>
  );
}
