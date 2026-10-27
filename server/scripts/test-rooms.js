import { io } from 'socket.io-client';

const URL = process.env.SERVER_URL ?? 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(label) {
  return new Promise((resolve) => {
    const s = io(URL, { transports: ['websocket'] });
    s.on('room:state', (st) => {
      const people = st.players.map((p) => `${p.name}${p.isHost ? ' (host)' : ''}${p.connected ? '' : ' (offline)'}`).join(', ');
      console.log(`   [${label} sees] ${people} | case: ${st.case.status}${st.case.title ? ` "${st.case.title}"` : ''}`);
    });
    s.on('connect', () => resolve(s));
  });
}

const send = (s, event, payload) => new Promise((resolve) => s.emit(event, payload, resolve));

console.log('1) Alice creates a room');
const alice = await connect('Alice');
const created = await send(alice, 'room:create', { name: 'Alice' });
console.log(`   code: ${created.state.code}`);

console.log('2) Bob joins with a lowercase code');
const bob = await connect('Bob');
const joined = await send(bob, 'room:join', { code: created.state.code.toLowerCase(), name: 'Bob' });
console.log(`   joined: ${joined.ok}`);

console.log('3) Wrong code');
const bad = await send(bob, 'room:join', { code: 'ZZZZ', name: 'Eve' });
console.log(`   -> ${bad.error}: ${bad.message}`);

console.log('4) Bob drops and comes back with his token');
bob.disconnect();
await wait(300);
const bobAgain = await connect('Bob again');
const resumed = await send(bobAgain, 'room:resume', { token: joined.token });
console.log(`   resumed: ${resumed.ok}`);

await wait(2500); // give the case time to load from Supabase
alice.close();
bobAgain.close();
process.exit(0);
