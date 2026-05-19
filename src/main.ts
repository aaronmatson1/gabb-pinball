/**
 * Gabb Pinball — raw matter-js (no Phaser).
 *
 * Why this rewrite: Phaser's Matter wrapper had compounding integration bugs
 * around constraints, body refs, and shape parsing. Going to raw matter-js
 * gives us the well-documented flipper pattern from the matter.js community
 * (constraint-pinned rectangles with angular velocity impulses) without any
 * wrapper quirks.
 */
import Matter from 'matter-js';
import { BRAND, PRODUCTS, TAGLINES, hex } from './brand';
import { AUDIO } from './audio';

const W = 540;
const H = 860;

// ---------- core engine ----------
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const engine = Matter.Engine.create({
  gravity: { x: 0, y: 1, scale: 0.0016 },
  positionIterations: 12,
  velocityIterations: 10,
});
const world = engine.world;

// ---------- world state ----------
interface State {
  ballInLane: boolean;
  plungerCharge: number;          // 0..1
  spaceCharging: boolean;
  score: number;
  balls: number;
  modeIdx: number;
  gameOver: boolean;
  flashText: string;
  flashUntil: number;
  bumperFlashes: Map<Matter.Body, number>;
  hitTargets: Set<Matter.Body>;
}
const state: State = {
  ballInLane: true,
  plungerCharge: 0,
  spaceCharging: false,
  score: 0,
  balls: 3,
  modeIdx: 0,
  gameOver: false,
  flashText: '',
  flashUntil: 0,
  bumperFlashes: new Map(),
  hitTargets: new Set(),
};

// ---------- geometry constants ----------
const WALL = 20;
const LANE_W = 50;                              // plunger lane channel width
const LANE_WALL_X = W - WALL - LANE_W;          // inner edge of lane wall (= 470)
const SPAWN = { x: W - WALL - LANE_W / 2, y: H - 60 };
const FLIPPER_PIVOT_Y = H - 130;
const FLIPPER_SPACING = 200;                    // distance between pivots

// Top quarter-circle arc — replaces the old flat diagonal deflector. The ball
// rising out of the lane curves around this arc and enters the playfield from
// the LEFT side. Tuned so the arc sits entirely inside the playfield and never
// intrudes on the lane channel.
const ARC_CENTER = { x: W - WALL, y: WALL };    // upper-right inside corner
const ARC_RADIUS = 110;
const ARC_THICKNESS = 30;                       // thick to prevent tunneling
const LANE_WALL_Y_TOP = 165;                    // top of lane wall; arc starts here

// ---------- helpers ----------
const STATIC_RENDER: Record<string, { fill: string; stroke?: string; lineWidth?: number }> = {};
function styledStatic(label: string, x: number, y: number, w: number, h: number, angle: number, fill: number, stroke = BRAND.yellow) {
  const body = Matter.Bodies.rectangle(x, y, w, h, {
    isStatic: true,
    angle,
    label,
    friction: 0.02,
    restitution: 0.5,
  });
  (body as any).__style = { fill: hex(fill), stroke: hex(stroke), lineWidth: 2 };
  return body;
}

// ---------- BUILD WORLD ----------
function buildWorld() {
  const bodies: Matter.Body[] = [];

  // outer walls
  bodies.push(styledStatic('wall', W / 2, WALL / 2, W, WALL, 0, BRAND.purpleLight));
  bodies.push(styledStatic('wall', WALL / 2, H / 2, WALL, H, 0, BRAND.purpleLight));
  bodies.push(styledStatic('wall', W - WALL / 2, H / 2, WALL, H, 0, BRAND.purpleLight));

  // plunger lane wall (left edge of lane channel) — extends ONLY from below the
  // top arc down to the bottom of the playfield. Above LANE_WALL_Y_TOP, the
  // quarter-arc takes over as the boundary, opening the lane to the upper
  // playfield.
  const laneWallTopY = LANE_WALL_Y_TOP;
  const laneWallHeight = H - laneWallTopY;
  bodies.push(styledStatic(
    'lane',
    LANE_WALL_X,
    laneWallTopY + laneWallHeight / 2,
    6,
    laneWallHeight,
    0,
    BRAND.teal,
  ));

  // Quarter-circle arc at the upper-right corner. Built as a chain of short
  // rectangles tangent to the arc curve. Each segment is thick (30 px) so a
  // fast ball can't tunnel through. Segments are arranged from south (where
  // the lane channel exits) to west (top of the playfield), so a launched ball
  // curves naturally LEFT into the playable area.
  const arcSamples = 12;
  for (let i = 0; i < arcSamples; i++) {
    const t = (i + 0.5) / arcSamples;
    const ang = Math.PI / 2 + t * (Math.PI / 2);   // π/2 (south) → π (west)
    const x = ARC_CENTER.x + ARC_RADIUS * Math.cos(ang);
    const y = ARC_CENTER.y + ARC_RADIUS * Math.sin(ang);
    const tangentAng = ang + Math.PI / 2;
    const segLen = (ARC_RADIUS * (Math.PI / 2)) / arcSamples + 6; // small overlap
    const seg = styledStatic('arc', x, y, segLen, ARC_THICKNESS, tangentAng, BRAND.coral);
    // hide individual segment rendering — the renderer draws a smooth arc on top
    (seg as any).__hidden = true;
    bodies.push(seg);
  }

  // bottom funnels — angled walls that lead a ball coming down into the flippers.
  // The RIGHT funnel must terminate at the lane wall (not the outer wall), or it
  // would cross the plunger channel and block the launch.
  const leftPivotX = W / 2 - FLIPPER_SPACING / 2;
  const rightPivotX = W / 2 + FLIPPER_SPACING / 2;
  const funnelStartY = H - 260;

  // left funnel: outer-left wall → left flipper pivot
  const lDx = leftPivotX - WALL;
  const lDy = FLIPPER_PIVOT_Y - funnelStartY;
  const lLen = Math.hypot(lDx, lDy);
  const lAng = Math.atan2(lDy, lDx);
  bodies.push(styledStatic('funnel', (WALL + leftPivotX) / 2, (funnelStartY + FLIPPER_PIVOT_Y) / 2,
    lLen, 12, lAng, BRAND.coral));

  // right funnel: terminates ~15 px LEFT of the lane wall so the body corners
  // (which extend past the centerline due to thickness) stay out of the channel.
  const rStartX = LANE_WALL_X - 15;
  const rDx = rightPivotX - rStartX;
  const rDy = FLIPPER_PIVOT_Y - funnelStartY;
  const rLen = Math.hypot(rDx, rDy);
  const rAng = Math.atan2(rDy, rDx);
  bodies.push(styledStatic('funnel', (rStartX + rightPivotX) / 2, (funnelStartY + FLIPPER_PIVOT_Y) / 2,
    rLen, 12, rAng, BRAND.coral));

  // (no outlane caps — funnels terminate at left wall and lane wall already)

  // ---------- bumpers ----------
  const bumperLayout: Array<{ x: number; y: number; color: number; points: number }> = [
    { x: 140, y: 250, color: BRAND.coral, points: 100 },
    { x: 270, y: 210, color: BRAND.teal, points: 100 },
    { x: 380, y: 260, color: BRAND.yellow, points: 100 },
    { x: 100, y: 360, color: BRAND.pink, points: 150 },
    { x: 230, y: 340, color: BRAND.yellow, points: 150 },
    { x: 340, y: 380, color: BRAND.coral, points: 150 },
    { x: 170, y: 470, color: BRAND.teal, points: 200 },
    { x: 310, y: 480, color: BRAND.pink, points: 200 },
  ];
  bumperLayout.forEach((b) => {
    const body = Matter.Bodies.circle(b.x, b.y, 28, {
      isStatic: true,
      label: 'bumper',
      restitution: 1.8,            // > 1 = adds energy on bounce
      friction: 0,
    });
    (body as any).__style = { fill: hex(b.color), stroke: hex(BRAND.cream), lineWidth: 3 };
    (body as any).__points = b.points;
    bodies.push(body);
  });

  // ---------- targets ----------
  // Right-side targets sit at x = LANE_WALL_X - 50 so their 56-wide rect stays
  // safely OUT of the lane channel.
  const rightTargetX = LANE_WALL_X - 50;
  const targetSlots = [
    { x: 60, y: 600, product: PRODUCTS[0] },
    { x: 60, y: 560, product: PRODUCTS[1] },
    { x: rightTargetX, y: 600, product: PRODUCTS[2] },
    { x: rightTargetX, y: 560, product: PRODUCTS[3] },
  ];
  targetSlots.forEach((t) => {
    const body = Matter.Bodies.rectangle(t.x, t.y, 56, 22, {
      isStatic: true,
      label: 'target',
      restitution: 0.6,
    });
    (body as any).__style = { fill: hex(t.product.color), stroke: hex(BRAND.cream), lineWidth: 2 };
    (body as any).__product = t.product;
    (body as any).__targetLabel = t.product.key;
    bodies.push(body);
  });

  Matter.World.add(world, bodies);
}

// ---------- FLIPPERS ----------
interface Flipper {
  body: Matter.Body;
  pin: Matter.Constraint;
  side: 'L' | 'R';
  restAngle: number;
  activeAngle: number;
  pressed: boolean;
  lastKickAt: number;
}
const flippers: Flipper[] = [];

function buildFlippers() {
  const length = 96;
  const height = 22;
  const pivotInset = 10;
  const halfL = length / 2;

  const make = (side: 'L' | 'R'): Flipper => {
    const isL = side === 'L';
    const pivotX = isL ? W / 2 - FLIPPER_SPACING / 2 : W / 2 + FLIPPER_SPACING / 2;
    const pivotY = FLIPPER_PIVOT_Y;
    // rest: tilt downward-toward-center (left flipper tilts down-right, right tilts down-left)
    const restAngle = isL ? Math.PI * 0.18 : -Math.PI * 0.18;
    const activeAngle = isL ? -Math.PI * 0.22 : Math.PI * 0.22;
    // pivot offset in body-local: at the inner end (toward center of board)
    const pivotOffsetX = (isL ? -1 : 1) * (halfL - pivotInset);
    // place body so pivot lands at world pivot
    const bx = pivotX - Math.cos(restAngle) * pivotOffsetX;
    const by = pivotY - Math.sin(restAngle) * pivotOffsetX;

    const body = Matter.Bodies.rectangle(bx, by, length, height, {
      label: 'flipper',
      density: 0.005,
      friction: 0,
      frictionAir: 0.04,
      restitution: 0.3,
      chamfer: { radius: 8 },
    });
    Matter.Body.setAngle(body, restAngle);
    (body as any).__style = { fill: hex(BRAND.yellow), stroke: hex(BRAND.coral), lineWidth: 3 };

    const pin = Matter.Constraint.create({
      bodyA: body,
      pointA: { x: pivotOffsetX, y: 0 },
      pointB: { x: pivotX, y: pivotY },
      length: 0,
      stiffness: 1,
    });

    Matter.World.add(world, [body, pin]);
    return { body, pin, side, restAngle, activeAngle, pressed: false, lastKickAt: 0 };
  };

  flippers.push(make('L'), make('R'));
}

function applyFlippers() {
  flippers.forEach((f) => {
    const target = f.pressed ? f.activeAngle : f.restAngle;
    const current = f.body.angle;
    const diff = target - current;
    // drive with angular velocity proportional to distance to target
    const speed = f.pressed ? 0.75 : 0.45;
    let v = diff * speed;
    // cap so flipper can't spin wildly
    v = Math.max(-0.55, Math.min(0.55, v));
    Matter.Body.setAngularVelocity(f.body, v);
    // hard clamp
    const lo = Math.min(f.restAngle, f.activeAngle);
    const hi = Math.max(f.restAngle, f.activeAngle);
    if (f.body.angle < lo) Matter.Body.setAngle(f.body, lo);
    if (f.body.angle > hi) Matter.Body.setAngle(f.body, hi);
  });
}

// ---------- BALL ----------
let ball: Matter.Body;
function buildBall() {
  ball = Matter.Bodies.circle(SPAWN.x, SPAWN.y, 12, {
    label: 'ball',
    density: 0.004,
    friction: 0.0005,
    frictionAir: 0.001,
    restitution: 0.55,
    slop: 0.02,
  });
  (ball as any).__style = { fill: hex(BRAND.cream), stroke: hex(BRAND.purpleDeep), lineWidth: 2 };
  Matter.World.add(world, ball);
}

function respawnBall() {
  state.ballInLane = true;
  state.plungerCharge = 0;
  state.spaceCharging = false;
  Matter.Body.setPosition(ball, { x: SPAWN.x, y: SPAWN.y });
  Matter.Body.setVelocity(ball, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(ball, 0);
}

function fire() {
  const power = Math.max(state.plungerCharge, 0.55);     // 0..1
  // matter velocities are pixels per step. Keep < arc thickness (30) to
  // prevent tunneling. -20 to -28 px/step gets the ball reliably up to the arc
  // even with no charge.
  const v = -20 - power * 8;
  state.ballInLane = false;
  state.plungerCharge = 0;
  state.spaceCharging = false;
  Matter.Body.setVelocity(ball, { x: 0, y: v });
  AUDIO.launch();
}

// ---------- INPUT ----------
const keys = new Set<string>();
function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    kickAudio();
    if (e.code === 'KeyZ' || e.code === 'ArrowLeft') { flippers[0].pressed = true; AUDIO.flipper(); }
    if (e.code === 'KeyM' || e.code === 'ArrowRight') { flippers[1].pressed = true; AUDIO.flipper(); }
    if (e.code === 'Space') { state.spaceCharging = true; e.preventDefault(); }
    if (e.code === 'KeyX') toggleMute();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'KeyZ' || e.code === 'ArrowLeft') flippers[0].pressed = false;
    if (e.code === 'KeyM' || e.code === 'ArrowRight') flippers[1].pressed = false;
    if (e.code === 'Space') {
      if (state.ballInLane && state.spaceCharging) fire();
    }
  });

  // touch / mouse
  canvas.addEventListener('pointerdown', (e) => {
    kickAudio();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    if (state.ballInLane) {
      state.spaceCharging = true;
    } else {
      if (x < W / 2) flippers[0].pressed = true;
      else flippers[1].pressed = true;
      AUDIO.flipper();
    }
  });
  canvas.addEventListener('pointerup', () => {
    flippers[0].pressed = false;
    flippers[1].pressed = false;
    if (state.ballInLane && state.spaceCharging) fire();
  });

  document.getElementById('mute')!.addEventListener('click', toggleMute);
  document.getElementById('replay')!.addEventListener('click', resetGame);
}

function kickAudio() {
  AUDIO.ensure();
  AUDIO.startMusic();
}

function toggleMute() {
  const muted = AUDIO.toggleMute();
  const btn = document.getElementById('mute')!;
  btn.textContent = muted ? '[SOUND OFF]' : '[SOUND ON]';
  btn.classList.toggle('muted', muted);
}

// ---------- COLLISIONS ----------
function bindCollisions() {
  Matter.Events.on(engine, 'collisionStart', (evt) => {
    for (const pair of evt.pairs) {
      const labels = new Set([pair.bodyA.label, pair.bodyB.label]);
      if (!labels.has('ball')) continue;
      const other = pair.bodyA.label === 'ball' ? pair.bodyB : pair.bodyA;
      if (other.label === 'bumper') hitBumper(other);
      else if (other.label === 'target') hitTarget(other);
      else if (other.label === 'flipper') AUDIO.flipper();
    }
  });
}

function hitBumper(b: Matter.Body) {
  const now = performance.now();
  const last = state.bumperFlashes.get(b) ?? 0;
  if (now - last < 60) return;
  state.bumperFlashes.set(b, now);
  const points = (b as any).__points ?? 100;
  addScore(points);
  popText(b.position.x, b.position.y - 30, `+${points}`, BRAND.cream);
  AUDIO.bumper();
}

function hitTarget(b: Matter.Body) {
  if (state.hitTargets.has(b)) return;
  state.hitTargets.add(b);
  const product = (b as any).__product;
  (b as any).__style.fill = hex(BRAND.purpleDeep);
  addScore(product.points);
  popText(b.position.x, b.position.y - 24, `${product.label}!`, product.color);
  AUDIO.target();

  // detect mode complete
  const total = 4;
  if (state.hitTargets.size >= total) completeMode();
}

function completeMode() {
  addScore(5000);
  flash(`${PRODUCTS[state.modeIdx].label.toUpperCase()} MODE — +5000`, BRAND.yellow);
  AUDIO.mode();
  // reset targets
  state.hitTargets.clear();
  world.bodies.forEach((b) => {
    if (b.label === 'target') {
      const product = (b as any).__product;
      (b as any).__style.fill = hex(product.color);
    }
  });
  state.modeIdx = (state.modeIdx + 1) % PRODUCTS.length;
}

function addScore(n: number) {
  state.score += n;
  document.getElementById('score')!.textContent = String(state.score);
}

// ---------- POPUPS / FLASH ----------
interface Pop { x: number; y: number; text: string; color: string; born: number; }
const pops: Pop[] = [];
function popText(x: number, y: number, text: string, color: number) {
  pops.push({ x, y, text, color: hex(color), born: performance.now() });
}
function flash(text: string, _color: number) {
  state.flashText = text;
  state.flashUntil = performance.now() + 1800;
}

// ---------- DRAINS ----------
function checkDrain() {
  if (state.gameOver || state.ballInLane) return;
  const p = ball.position;
  if (p.y > H + 40 || p.x < -40 || p.x > W + 40) {
    state.balls -= 1;
    document.getElementById('balls')!.textContent = String(state.balls);
    flash(`BALL LOST — ${state.balls} LEFT`, BRAND.coral);
    AUDIO.drain();
    if (state.balls <= 0) { endGame(); return; }
    respawnBall();
  }
}

// ---------- PLUNGER ----------
function updatePlunger(dt: number) {
  if (!state.ballInLane) return;
  // pin ball at spawn
  Matter.Body.setPosition(ball, {
    x: SPAWN.x,
    y: SPAWN.y + state.plungerCharge * 10,
  });
  Matter.Body.setVelocity(ball, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(ball, 0);

  if (state.spaceCharging && (keys.has('Space') || pointerCharging)) {
    state.plungerCharge = Math.min(state.plungerCharge + dt * 1.5, 1);
  }
}

// pointer charge state is tracked separately so a touch-and-hold charges too
let pointerCharging = false;
canvas.addEventListener('pointerdown', () => { if (state.ballInLane) pointerCharging = true; });
canvas.addEventListener('pointerup', () => { pointerCharging = false; });
canvas.addEventListener('pointercancel', () => { pointerCharging = false; });

// ---------- GAME OVER ----------
function endGame() {
  state.gameOver = true;
  AUDIO.stopMusic();
  AUDIO.gameOver();
  document.getElementById('finalScore')!.textContent = String(state.score);
  document.getElementById('overlay')!.classList.add('show');
}

function resetGame() {
  state.score = 0;
  state.balls = 3;
  state.modeIdx = 0;
  state.gameOver = false;
  state.hitTargets.clear();
  state.bumperFlashes.clear();
  document.getElementById('score')!.textContent = '0';
  document.getElementById('balls')!.textContent = '3';
  document.getElementById('overlay')!.classList.remove('show');
  world.bodies.forEach((b) => {
    if (b.label === 'target') {
      const product = (b as any).__product;
      (b as any).__style.fill = hex(product.color);
    }
  });
  respawnBall();
  AUDIO.startMusic();
}

// ---------- RENDER ----------
function render() {
  // backdrop
  ctx.fillStyle = hex(BRAND.purpleDeep);
  ctx.fillRect(0, 0, W, H);

  // playfield tint
  ctx.fillStyle = 'rgba(91, 45, 145, 0.15)';
  ctx.fillRect(0, 0, W, H);

  // GABB badge (background)
  ctx.save();
  ctx.fillStyle = hex(BRAND.yellow);
  ctx.font = '22px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.18;
  ctx.fillText('GABB', W / 2, H / 2 - 20);
  ctx.globalAlpha = 0.12;
  ctx.fillText(TAGLINES[state.modeIdx % TAGLINES.length], W / 2, H / 2 + 14);
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = hex(BRAND.coral);
  ctx.fillText(`MODE: ${PRODUCTS[state.modeIdx].label.toUpperCase()}`, W / 2, H / 2 + 40);
  ctx.restore();

  // smooth quarter-circle arc (drawn before bodies so they render on top of background)
  ctx.save();
  ctx.lineWidth = ARC_THICKNESS;
  ctx.strokeStyle = hex(BRAND.coral);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(ARC_CENTER.x, ARC_CENTER.y, ARC_RADIUS, Math.PI / 2, Math.PI);
  ctx.stroke();
  // inner highlight stripe
  ctx.lineWidth = 4;
  ctx.strokeStyle = hex(BRAND.yellow);
  ctx.beginPath();
  ctx.arc(ARC_CENTER.x, ARC_CENTER.y, ARC_RADIUS - ARC_THICKNESS / 2 + 4, Math.PI / 2, Math.PI);
  ctx.stroke();
  ctx.restore();

  // bodies
  for (const body of world.bodies) {
    if ((body as any).__hidden) continue;
    const style = (body as any).__style as { fill: string; stroke?: string; lineWidth?: number } | undefined;
    if (!style) continue;

    ctx.beginPath();
    if (body.circleRadius) {
      ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
    } else {
      const v = body.vertices;
      ctx.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
      ctx.closePath();
    }
    ctx.fillStyle = style.fill;
    ctx.fill();
    if (style.stroke) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.lineWidth ?? 2;
      ctx.stroke();
    }

    // bumper highlight
    if (body.label === 'bumper' && body.circleRadius) {
      const last = state.bumperFlashes.get(body) ?? 0;
      const t = performance.now() - last;
      const flashScale = t < 140 ? 1 + (1 - t / 140) * 0.25 : 1;
      if (flashScale > 1) {
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, body.circleRadius * flashScale, 0, Math.PI * 2);
        ctx.strokeStyle = hex(BRAND.cream);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // small highlight dot
      ctx.beginPath();
      ctx.arc(body.position.x - 7, body.position.y - 7, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
    }

    // target label
    if (body.label === 'target') {
      const txt = (body as any).__targetLabel as string;
      const hit = state.hitTargets.has(body);
      ctx.fillStyle = hit ? hex((body as any).__product.color) : hex(BRAND.purpleDeep);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, body.position.x, body.position.y);
    }
  }

  // plunger visual (only when ball in lane)
  if (state.ballInLane) {
    const plungerY = H - 28;
    ctx.fillStyle = hex(BRAND.yellow);
    ctx.fillRect(SPAWN.x - 18, plungerY + state.plungerCharge * 10, 36, 22);
    ctx.strokeStyle = hex(BRAND.coral);
    ctx.lineWidth = 2;
    ctx.strokeRect(SPAWN.x - 18, plungerY + state.plungerCharge * 10, 36, 22);
    // charge bar
    if (state.spaceCharging) {
      const barH = 200 * state.plungerCharge;
      ctx.fillStyle = hex(BRAND.coral);
      ctx.fillRect(SPAWN.x + 24, plungerY - barH, 6, barH);
    }
  }

  // popups
  const now = performance.now();
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    const age = now - p.born;
    if (age > 700) { pops.splice(i, 1); continue; }
    const alpha = 1 - age / 700;
    const yOff = age * 0.04;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y - yOff);
    ctx.globalAlpha = 1;
  }

  // flash text
  if (state.flashText && now < state.flashUntil) {
    const age = state.flashUntil - now;
    const alpha = Math.min(1, age / 600);
    ctx.fillStyle = hex(BRAND.yellow);
    ctx.globalAlpha = alpha;
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.flashText, W / 2, H / 2 - 90);
    ctx.globalAlpha = 1;
  }
}

// ---------- MAIN LOOP ----------
let lastTime = performance.now();
function loop(now: number) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  applyFlippers();
  updatePlunger(dt);
  Matter.Engine.update(engine, dt * 1000);
  checkDrain();
  render();
  requestAnimationFrame(loop);
}

// ---------- KICKOFF ----------
buildWorld();
buildFlippers();
buildBall();
bindInput();
bindCollisions();
requestAnimationFrame(loop);

// debug
(window as any).__GAME = { engine, world, state, ball, flippers, Matter };
