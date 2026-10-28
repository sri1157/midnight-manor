import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { WORLD, MAP_ROOMS, CORRIDORS, roomById, centerOf } from './layout.js';
import { shortName, initialOf } from '../lib/names.js';

const COLORS = { border: 0x3a3045, gold: 0xc9a227, text: 0xece6d8, corridor: 0x231d2c, dark: 0x0f0c14, ink: 0x111111 };

const FLOORS = {
  wood:   { fill: 0x1d1611, line: 0x3a2a1c },
  stone:  { fill: 0x141419, line: 0x2c2c36 },
  tiles:  { fill: 0x171a1d, line: 0x2b3036 },
  marble: { fill: 0x19161f, line: 0x2c2636 },
  grass:  { fill: 0x0f1911, line: 0x2b4a2e },
};

const AVATAR_RADIUS = 16;
const AVATAR_GAP = 42;
const EMPTY_CTX = { mine: null, searched: new Set(), clueCounts: new Map() };

const canReach = (from, to) => Boolean(from && from !== to && roomById(from)?.connects.includes(to));

/** Floor pattern for one room, drawn once, inside the room's border. */
function drawFloor(g, r) {
  const f = FLOORS[r.floor] ?? FLOORS.marble;
  const x0 = r.x + 6, y0 = r.y + 6, x1 = r.x + r.w - 6, y1 = r.y + r.h - 6;

  if (r.floor === 'grass') {
    let seed = r.x * 7 + r.y * 13 + 1; // seeded: every player sees the same garden
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 160; i++) {
      g.circle(x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), 1.2 + rand() * 1.6).fill({ color: f.line, alpha: 0.8 });
    }
    return;
  }

  if (r.floor === 'marble') {
    const size = 40;
    for (let y = y0, j = 0; y < y1; y += size, j++) {
      for (let x = x0, i = 0; x < x1; x += size, i++) {
        if ((i + j) % 2) g.rect(x, y, Math.min(size, x1 - x), Math.min(size, y1 - y)).fill({ color: f.line, alpha: 0.35 });
      }
    }
    return;
  }

  if (r.floor === 'wood') {
    for (let y = y0, row = 0; y < y1; y += 16, row++) {
      g.moveTo(x0, y).lineTo(x1, y);
      for (let x = x0 + (row % 2 ? 30 : 75); x < x1; x += 90) g.moveTo(x, y).lineTo(x, Math.min(y + 16, y1));
    }
  } else if (r.floor === 'stone') {
    for (let y = y0, row = 0; y < y1; y += 24, row++) {
      g.moveTo(x0, y).lineTo(x1, y);
      for (let x = x0 + (row % 2 ? 24 : 0); x < x1; x += 48) g.moveTo(x, y).lineTo(x, Math.min(y + 24, y1));
    }
  } else if (r.floor === 'tiles') {
    for (let y = y0; y <= y1; y += 26) g.moveTo(x0, y).lineTo(x1, y);
    for (let x = x0; x <= x1; x += 26) g.moveTo(x, y0).lineTo(x, y1);
  }
  g.stroke({ width: 1, color: f.line, alpha: 0.7 });
}

/** Border, fade and badge for one room, given where the player is. */
function paintRoom(view, ctx) {
  const { room: r, box, floor, label, badge, hovered } = view;
  const isMine = r.id === ctx.mine;
  const reachable = canReach(ctx.mine, r.id);
  const faded = hovered && !reachable && !isMine;

  box.clear();
  box
    .roundRect(r.x, r.y, r.w, r.h, 14)
    .fill({ color: (FLOORS[r.floor] ?? FLOORS.marble).fill })
    .stroke({ width: isMine ? 3 : 2, color: isMine || (hovered && reachable) ? COLORS.gold : COLORS.border });
  box.cursor = reachable ? 'pointer' : 'default';

  const parts = [];
  if (ctx.searched.has(r.id)) parts.push('✓ searched');
  const n = ctx.clueCounts.get(r.id) ?? 0;
  if (n > 0) parts.push(`${n} clue${n > 1 ? 's' : ''}`);
  badge.text = parts.join(' · ');
  badge.visible = parts.length > 0;

  for (const item of [box, floor, label, badge]) item.alpha = faded ? 0.4 : 1;
}

function makeAvatar(player, isMe) {
  const view = new Container();
  if (isMe) view.addChild(new Graphics().circle(0, 0, AVATAR_RADIUS + 4).stroke({ width: 3, color: COLORS.gold }));
  view.addChild(new Graphics().circle(0, 0, AVATAR_RADIUS).fill({ color: player.color }));
  const initial = new Text({
    text: player.name[0]?.toUpperCase() ?? '?',
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: '600', fill: COLORS.ink },
  });
  initial.anchor.set(0.5);
  view.addChild(initial);
  return view;
}

function makeSuspectPlate(suspect) {
  const view = new Container();
  view.addChild(new Graphics().circle(0, 0, 24).fill({ color: COLORS.dark }).stroke({ width: 2, color: COLORS.gold }));
  const initial = new Text({
    text: initialOf(suspect.name),
    style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: 20, fontWeight: '700', fill: COLORS.gold },
  });
  initial.anchor.set(0.5);
  const name = new Text({
    text: shortName(suspect.name),
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: '600', fill: COLORS.gold },
  });
  name.anchor.set(0.5, 0);
  name.position.set(0, 30);
  view.addChild(initial, name);
  return view;
}

function drawGlow(glow, roomId) {
  glow.clear();
  const r = roomById(roomId);
  if (!r) return;
  for (let i = 1; i <= 4; i++) {
    glow.roundRect(r.x - i * 5, r.y - i * 5, r.w + i * 10, r.h + i * 10, 14 + i * 5)
      .stroke({ width: 5, color: COLORS.gold, alpha: 0.12 - i * 0.025 });
  }
}

/** Bring the scene in line with the latest game state. */
function syncScene(scene, data) {
  const { players, meId, suspects = [], searchedRooms = [], clues = [] } = data;
  const mine = players.find((p) => p.id === meId)?.location ?? null;
  const clueCounts = new Map();
  for (const c of clues) clueCounts.set(c.room, (clueCounts.get(c.room) ?? 0) + 1);
  scene.ctx = { mine, searched: new Set(searchedRooms), clueCounts };

  for (const view of scene.roomViews.values()) paintRoom(view, scene.ctx);
  if (scene.glowRoom !== mine) {
    drawGlow(scene.glow, mine);
    scene.glowRoom = mine;
  }

  // suspects: created once, they stay in their rooms
  for (const s of suspects) {
    if (scene.suspects.has(s.id)) continue;
    const r = roomById(s.location);
    if (!r) continue;
    const plate = makeSuspectPlate(s);
    plate.position.set(r.x + r.w / 2, r.y + 80);
    scene.suspectLayer.addChild(plate);
    scene.suspects.set(s.id, plate);
  }

  // remove avatars of players who left
  for (const [id, avatar] of scene.avatars) {
    if (!players.some((p) => p.id === id)) {
      avatar.view.destroy({ children: true });
      scene.avatars.delete(id);
    }
  }

  // players gather at the bottom of their room, in a small grid
  const byRoom = new Map();
  for (const p of players) {
    if (!byRoom.has(p.location)) byRoom.set(p.location, []);
    byRoom.get(p.location).push(p);
  }
  for (const [roomId, group] of byRoom) {
    const r = roomById(roomId);
    if (!r) continue;
    const cols = Math.min(4, group.length);
    const rows = Math.ceil(group.length / cols);
    const baseY = r.y + r.h - 44 - (rows - 1) * AVATAR_GAP;

    group.forEach((p, i) => {
      const tx = r.x + r.w / 2 + ((i % cols) - (cols - 1) / 2) * AVATAR_GAP;
      const ty = baseY + Math.floor(i / cols) * AVATAR_GAP;
      let avatar = scene.avatars.get(p.id);
      if (!avatar) {
        const view = makeAvatar(p, p.id === meId);
        view.position.set(tx, ty);
        scene.avatarLayer.addChild(view);
        avatar = { view };
        scene.avatars.set(p.id, avatar);
      }
      avatar.tx = tx;
      avatar.ty = ty;
      avatar.view.alpha = p.connected ? 1 : 0.4;
    });
  }
}

export default function MansionMap({ players, meId, suspects, searchedRooms, clues, onMove, onBlocked }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const latest = useRef({ players, meId, suspects, searchedRooms, clues, onMove, onBlocked });

  useEffect(() => {
    latest.current = { players, meId, suspects, searchedRooms, clues, onMove, onBlocked };
  });

  // Create the PixiJS scene once.
  useEffect(() => {
    let cancelled = false;
    let app = null;
    let observer = null;

    (async () => {
      await Promise.all([
        document.fonts.load('700 20px Cinzel'),
        document.fonts.load('600 13px Inter'),
      ]).catch(() => {});
      const instance = new Application();
      await instance.init({ backgroundAlpha: 0, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
      if (cancelled) {
        instance.destroy(true, { children: true });
        return;
      }
      app = instance;
      const host = hostRef.current;
      host.appendChild(app.canvas);

      const world = new Container();
      app.stage.addChild(world);

      const scene = {
        roomViews: new Map(),
        avatars: new Map(),
        suspects: new Map(),
        ctx: EMPTY_CTX,
        glowRoom: undefined,
        glow: new Graphics(),
        suspectLayer: new Container(),
        avatarLayer: new Container(),
      };

      // layers, bottom to top: corridors, glow, rooms, suspects, avatars
      const corridors = new Graphics();
      for (const [a, b] of CORRIDORS) {
        const A = centerOf(roomById(a));
        const B = centerOf(roomById(b));
        corridors.moveTo(A.x, A.y).lineTo(B.x, B.y);
      }
      corridors.stroke({ width: 28, color: COLORS.corridor });
      world.addChild(corridors, scene.glow);

      for (const r of MAP_ROOMS) {
        const box = new Graphics();
        box.eventMode = 'static';
        const floor = new Graphics();
        floor.eventMode = 'none';
        drawFloor(floor, r);

        const label = new Text({
          text: r.name,
          style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: 20, fontWeight: '700', fill: COLORS.text },
        });
        label.anchor.set(0.5, 0);
        label.position.set(r.x + r.w / 2, r.y + 12);

        const badge = new Text({
          text: '',
          style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: '600', fill: COLORS.gold },
        });
        badge.position.set(r.x + 12, r.y + r.h - 22);

        const view = { room: r, box, floor, label, badge, hovered: false };
        box.on('pointerover', () => { view.hovered = true; paintRoom(view, scene.ctx); });
        box.on('pointerout', () => { view.hovered = false; paintRoom(view, scene.ctx); });
        box.on('pointertap', () => {
          const { mine } = scene.ctx;
          if (!mine || r.id === mine) return;
          if (!canReach(mine, r.id)) return latest.current.onBlocked?.('No door leads there from here.');
          latest.current.onMove(r.id);
        });

        world.addChild(box, floor, label, badge);
        scene.roomViews.set(r.id, view);
      }
      world.addChild(scene.suspectLayer, scene.avatarLayer);

      // glide avatars; let the candle glow breathe
      app.ticker.add((ticker) => {
        const k = Math.min(1, 0.15 * ticker.deltaTime);
        for (const a of scene.avatars.values()) {
          a.view.x += (a.tx - a.view.x) * k;
          a.view.y += (a.ty - a.view.y) * k;
        }
        scene.glow.alpha = 0.75 + 0.25 * Math.sin(performance.now() / 600);
      });

      const fit = () => {
        const { clientWidth: w, clientHeight: h } = host;
        if (!w || !h) return;
        app.renderer.resize(w, h);
        const s = Math.min(w / WORLD.width, h / WORLD.height);
        world.scale.set(s);
        world.position.set((w - WORLD.width * s) / 2, (h - WORLD.height * s) / 2);
      };
      observer = new ResizeObserver(fit);
      observer.observe(host);
      fit();

      sceneRef.current = scene;
      syncScene(scene, latest.current);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      sceneRef.current = null;
      app?.destroy(true, { children: true });
    };
  }, []);

  // Update the existing scene whenever the game changes.
  useEffect(() => {
    if (sceneRef.current) syncScene(sceneRef.current, { players, meId, suspects, searchedRooms, clues });
  }, [players, meId, suspects, searchedRooms, clues]);

  return <div ref={hostRef} className="mansion-map" />;
}
