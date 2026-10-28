import { useEffect, useRef, useState } from 'react';
import { shortName, initialOf } from '../lib/names.js';
import './Interrogation.css';

const STARTERS = [
  'Where were you at 9 pm?',
  'Did you see anyone else that evening?',
  'What was your relationship with the victim?',
];

export default function Interrogation({ suspect, transcript, thinking, meName, cooldownMs, onAsk, onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const logRef = useRef(null);
  const lastAnswer = transcript.at(-1)?.a;

  // keep the newest exchange in view, including when an answer arrives
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length, lastAnswer, thinking]);

  // tick the cooldown countdown
  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= cooldownUntil) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const waitS = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const blocked = sending || thinking || waitS > 0;

  async function send(question) {
    const q = question.trim();
    if (!q || blocked) return;
    setError('');
    setText('');
    setSending(true);
    const reply = await onAsk(suspect.id, q);
    setSending(false);
    if (!reply.ok) {
      setText(q); // give their words back
      setError(reply.message);
      return;
    }
    const t = Date.now();
    setNow(t);
    setCooldownUntil(t + cooldownMs);
  }

  const name = shortName(suspect.name);

  return (
    <div className="interro" role="dialog" aria-label={`Questioning ${suspect.name}`}>
      <header className="interro-head">
        <div className={`interro-portrait ${thinking ? 'is-thinking' : ''}`}>
          <span>{initialOf(suspect.name)}</span>
          <i className="sweat" aria-hidden="true" />
        </div>
        <div className="interro-who">
          <p className="interro-name">{suspect.name}</p>
          <p className="interro-meta">{suspect.occupation} · {suspect.personality}</p>
        </div>
        <button className="interro-close" onClick={onClose} aria-label="Stop questioning">×</button>
      </header>

      <div className="interro-log" ref={logRef} aria-live="polite">
        {transcript.length === 0 && <p className="interro-empty">"{suspect.says}"</p>}
        {transcript.map((e, i) => (
          <div key={`${i}-${e.q}`} className="interro-pair">
            <p className={`bubble q ${e.asker === meName ? 'is-me' : ''}`}>
              <span className="bubble-who">{e.asker === meName ? 'You' : e.asker}</span>
              {e.q}
            </p>
            {e.a ? (
              <p className="bubble a">
                <span className="bubble-who">{name}</span>
                {e.a}
              </p>
            ) : (
              <p className="bubble a is-waiting">
                <span className="bubble-who">{name}</span>
                <span className="dots" aria-label={`${name} is thinking`}><i /><i /><i /></span>
              </p>
            )}
          </div>
        ))}
      </div>

      {transcript.length < 2 && (
        <div className="interro-starters">
          {STARTERS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)} disabled={blocked}>{s}</button>
          ))}
        </div>
      )}

      {error && <p className="home-error" role="alert">{error}</p>}

      <form
        className="interro-ask"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={`Ask ${name} something...`}
          aria-label={`Question for ${name}`}
        />
        <button className="btn" type="submit" disabled={blocked || !text.trim()}>
          {sending || thinking ? '...' : waitS > 0 ? `${waitS}s` : 'Ask'}
        </button>
      </form>
    </div>
  );
}
