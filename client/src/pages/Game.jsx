import { useRef, useState } from 'react';
import MansionMap from '../map/MansionMap.jsx';
import { roomName } from '../map/layout.js';
import { shortName } from '../lib/names.js';
import './Game.css';

export default function Game({ room, me, onMove, onSearch, onLeave }) {
  const [toast, setToast] = useState('');
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);
  const game = room.game;

  const showToast = (message) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 2500);
  };

  async function move(to) {
    const reply = await onMove(to);
    if (!reply.ok) showToast(reply.message);
  }

  async function search() {
    setSearching(true);
    const reply = await onSearch();
    setSearching(false);
    if (!reply.ok) return showToast(reply.message);
    showToast(reply.added > 0 ? `You found ${reply.added} clue${reply.added > 1 ? 's' : ''}!` : 'Nothing new here.');
  }

  if (!game) return null;

  const here = me?.location;
  const suspectHere = game.suspects.find((s) => s.location === here);
  const searched = game.searchedRooms.includes(here);
  const clues = [...game.clues].reverse();

  return (
    <main className="game">
      <div className="fog fog-a" aria-hidden="true" />
      <div className="fog fog-b" aria-hidden="true" />
      <header className="game-bar">
        <h1 className="game-title">{room.case.title}</h1>
        <p className="game-victim">
          {game.victim.name}, {game.victim.role}: {game.victim.causeOfDeath}, in the {roomName(game.victim.room)} at{' '}
          {game.victim.timeOfDeath}
        </p>
        {onLeave && <button className="game-leave" onClick={onLeave}>Leave</button>}
      </header>

      <div className="game-body">
        <div className="game-map">
          <MansionMap
            players={room.players}
            meId={me?.id}
            suspects={game.suspects}
            searchedRooms={game.searchedRooms}
            clues={game.clues}
            onMove={move}
            onBlocked={showToast}
          />
        </div>

        <aside className="game-panel">
          <section className="panel-block">
            <h2 className="panel-heading">You are in the {roomName(here)}</h2>

            {suspectHere ? (
              <div className="suspect-card">
                <p className="suspect-name">{suspectHere.name}</p>
                <p className="suspect-meta">{suspectHere.occupation} · {suspectHere.personality}</p>
                <p className="suspect-says">"{suspectHere.says}"</p>
                <button className="btn btn-ghost" disabled>Question {shortName(suspectHere.name)} (soon)</button>
              </div>
            ) : (
              <p className="panel-empty">No one is here.</p>
            )}

            <button className="btn" onClick={search} disabled={searching}>
              {searching ? 'Searching...' : searched ? 'Search again' : `Search the ${roomName(here)}`}
            </button>
          </section>

          <section className="panel-block">
            <h2 className="panel-heading">Suspects</h2>
            <ul className="suspect-list">
              {game.suspects.map((s) => (
                <li key={s.id} className={s.location === here ? 'is-here' : ''}>
                  <span className="suspect-dot">{shortName(s.name)[0]}</span>
                  <span className="suspect-info">
                    <strong>{s.name}</strong>
                    <small>{s.occupation}</small>
                  </span>
                  <span className="suspect-where">{roomName(s.location)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel-block">
            <h2 className="panel-heading">Clue board <span>{game.clues.length}</span></h2>
            {clues.length === 0 ? (
              <p className="panel-empty">No clues yet. Search the rooms.</p>
            ) : (
              <ul className="clue-list">
                {clues.map((c) => (
                  <li key={c.id} className="clue">
                    <p className="clue-title">{c.title}</p>
                    <p className="clue-text">{c.description}</p>
                    <p className="clue-meta">{roomName(c.room)} · found by {c.foundBy}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {toast && <div className="game-toast" role="status">{toast}</div>}
    </main>
  );
}
