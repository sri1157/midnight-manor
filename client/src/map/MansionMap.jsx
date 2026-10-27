import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { WORLD, MAP_ROOMS, CORRIDORS, roomById, centerOf } from './layout.js';

const COLORS = {
  room: 0x17131f,
  roomMine: 0x2a2133,
  border: 0x3a3045,
  gold: 0xc9a227,
  text: 0xece6d8,
  corridor: 0x231d2c,
  initial: 0x111111,
};
const AVATAR_RADIUS = 16;
const AVATAR_GAP = 44;

const myLocation = (players, meId) => players.find((p) => p.id === meId)?.location ?? null;

function canReach(from, to) {
  return Boolean(from && from !== to && roomById(from)?.connects.includes(to));
}

/** Draw one room according to where the player is and what they are hovering. */
function paintRoom(view, mine) {
  const { room: r, box, label, hovered } = view;
  const isMine = r.id === mine;
  const reachable = canReach(mine, r.id);
  const faded = hovered && !reachable && !isMine;

  box.clear();
  box
    .roundRect(r.x, r.y, r.w, r.h, 14)
    .fill({ color: isMine ? COLORS.roomMine : COLORS.room })
    .stroke({
      width: isMine ? 3 : 2,
      color: isMine || (hovered && reachable) ? COLORS.gold : COLORS.border,
    });
  box.alpha = faded ? 0.45 : 1;
  label.alpha = faded ? 0.45 : 1;
  box.cursor = reachable ? 'pointer' : 'default';
}

function makeAvatar(player, isMe) {
  const view = new Container();
  const ring = new Graphics();
  if (isMe) ring.circle(0, 0, AVATAR_RADIUS + 4).stroke({ width: 3, color: COLORS.gold });
  const body = new Graphics().circle(0, 0, AVATAR_RADIUS).fill({ color: player.color });
  const initial = new Text({
    text: player.name[0]?.toUpperCase() ?? '?',
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: '600', fill: COLORS.initial },
  });
  initial.anchor.set(0.5);
  view.addChild(ring, body, initial);
  return view;
}

/** Bring the scene in line with the latest room state. */
function syncScene(scene, players, meId) {
  const mine = myLocation(players, meId);
  for (const view of scene.roomViews.values()) paintRoom(view, mine);

  // remove avatars of players who left
  for (const [id, avatar] of scene.avatars) {
    if (!players.some((p) => p.id === id)) {
      avatar.view.destroy({ children: true });
      scene.avatars.delete(id);
    }
  }

  // group players by room, then lay each group out in a small grid
  const byRoom = new Map();
  for (const p of players) {
    if (!byRoom.has(p.location)) byRoom.set(p.location, []);
    byRoom.get(p.location).push(p);
  }

  for (const [roomId, group] of byRoom) {
    const r = roomById(roomId);
    if (!r) continue;
    const c = centerOf(r);
    const cols = Math.min(4, group.length);
    const rows = Math.ceil(group.length / cols);

    group.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const tx = c.x + (col - (cols - 1) / 2) * AVATAR_GAP;
      const ty = c.y + 18 + (row - (rows - 1) / 2) * AVATAR_GAP;

      let avatar = scene.avatars.get(p.id);
      if (!avatar) {
        const view = makeAvatar(p, p.id === meId);
        view.position.set(tx, ty); // appear in place, no glide from the corner
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

export default function MansionMap({ players, meId, onMove, onBlocked }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const latest = useRef({ players, meId, onMove, onBlocked });

  useEffect(() => {
    latest.current = { players, meId, onMove, onBlocked };
  });

  // Create the PixiJS scene once.
  useEffect(() => {
    let cancelled = false;
    let app = null;
    let observer = null;

    (async () => {
      await document.fonts.load('700 20px Cinzel').catch(() => {});
      const instance = new Application();
      await instance.init({
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (cancelled) {
        instance.destroy(true, { children: true });
        return;
      }
      app = instance;
      const host = hostRef.current;
      host.appendChild(app.canvas);

      const world = new Container();
      app.stage.addChild(world);

      // corridors (drawn under the rooms, so only the doorways show)
      const corridors = new Graphics();
      for (const [a, b] of CORRIDORS) {
        const A = centerOf(roomById(a));
        const B = centerOf(roomById(b));
        corridors.moveTo(A.x, A.y).lineTo(B.x, B.y);
      }
      corridors.stroke({ width: 26, color: COLORS.corridor });
      world.addChild(corridors);

      // rooms
      const roomViews = new Map();
      for (const r of MAP_ROOMS) {
        const box = new Graphics();
        box.eventMode = 'static';
        const label = new Text({
          text: r.name,
          style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: 20, fontWeight: '700', fill: COLORS.text },
        });
        label.anchor.set(0.5, 0);
        label.position.set(r.x + r.w / 2, r.y + 12);

        const view = { room: r, box, label, hovered: false };
        const repaint = () => paintRoom(view, myLocation(latest.current.players, latest.current.meId));

        box.on('pointerover', () => { view.hovered = true; repaint(); });
        box.on('pointerout', () => { view.hovered = false; repaint(); });
        box.on('pointertap', () => {
          const { players: ps, meId: id, onMove: move, onBlocked: blocked } = latest.current;
          const mine = myLocation(ps, id);
          if (!mine || r.id === mine) return;
          if (!canReach(mine, r.id)) return blocked?.('No door leads there from here.');
          move(r.id);
        });

        world.addChild(box, label);
        roomViews.set(r.id, view);
      }

      // avatars on top, gliding toward their targets every frame
      const avatarLayer = new Container();
      world.addChild(avatarLayer);
      const avatars = new Map();
      app.ticker.add((ticker) => {
        const k = Math.min(1, 0.15 * ticker.deltaTime);
        for (const a of avatars.values()) {
          a.view.x += (a.tx - a.view.x) * k;
          a.view.y += (a.ty - a.view.y) * k;
        }
      });

      // scale the whole world to fit the container
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

      sceneRef.current = { roomViews, avatarLayer, avatars };
      syncScene(sceneRef.current, latest.current.players, latest.current.meId);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      sceneRef.current = null;
      app?.destroy(true, { children: true });
    };
  }, []);

  // Update the existing scene whenever players change.
  useEffect(() => {
    if (sceneRef.current) syncScene(sceneRef.current, players, meId);
  }, [players, meId]);

  return <div ref={hostRef} className="mansion-map" />;
}
