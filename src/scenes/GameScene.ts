import Phaser from 'phaser';
import { BRAND, PRODUCTS, TAGLINES } from '../brand';
import { AUDIO } from '../audio';

const W = 540;
const H = 860;
const WALL = 18;
const DRAIN_W = 180;
const LANE_X = W - 56;        // x position of plunger lane wall
const LANE_TOP = 90;          // top of lane wall (arc deflector above)
const BALL_SPAWN_X = W - 32;
const BALL_SPAWN_Y = H - 60;

type Bumper = Phaser.Physics.Arcade.Sprite & { points: number; flashUntil: number };

type Target = {
  rect: Phaser.GameObjects.Rectangle;
  body: Phaser.Physics.Arcade.StaticBody;
  label: string;
  color: number;
  hit: boolean;
  product: typeof PRODUCTS[number];
};

interface Flipper {
  pivot: { x: number; y: number };
  side: 'left' | 'right';
  restAngle: number;
  activeAngle: number;
  angle: number;
  vAngle: number; // angular velocity (rad/s)
  length: number;
  width: number;
  sprite: Phaser.GameObjects.Image;
  active: boolean;       // resolved each frame from inputs
  pointerHeld: boolean;  // touch / mouse press state
}

export class GameScene extends Phaser.Scene {
  private ball!: Phaser.Physics.Arcade.Sprite;
  private bumpers!: Phaser.Physics.Arcade.StaticGroup;
  private flippers: Flipper[] = [];
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private plungerPower = 0;
  private charging = false;
  private targets: Target[] = [];
  private modeIdx = 0;
  private taglineText!: Phaser.GameObjects.Text;
  private flashText?: Phaser.GameObjects.Text;
  private ballInPlunger = true;
  private ballsLeft = 3;
  private score = 0;
  private gameOver = false;

  constructor() { super('Game'); }

  create() {
    this.cameras.main.setBackgroundColor(BRAND.purpleDeep);
    this.drawPlayfieldArt();
    this.buildWalls();
    this.buildPlungerLane();
    this.buildBumpers();
    this.buildTargets();
    this.buildFlippers();
    this.buildBall();
    this.buildHUDFlavor();
    this.bindInput();

    // expose to HUD
    this.registry.set('score', 0);
    this.registry.set('balls', this.ballsLeft);
    this.registry.set('mode', PRODUCTS[this.modeIdx].label);
  }

  update(_t: number, dtMs: number) {
    const dt = dtMs / 1000;
    this.updateFlippers(dt);
    this.handleFlipperBallCollision();
    this.updatePlunger(dt);
    this.checkDrain();
    this.decayFlashes();
  }

  // ---------- build ----------

  private drawPlayfieldArt() {
    // playfield background gradient via stacked rects
    const bgTop = this.add.rectangle(W / 2, H / 2, W, H, BRAND.purple).setAlpha(0.18);
    bgTop.setDepth(-10);

    // arc at top
    const arc = this.add.graphics().setDepth(-9);
    arc.lineStyle(4, BRAND.coral, 1);
    arc.strokeCircle(W / 2, 0, W / 2 - 30);
    arc.lineStyle(4, BRAND.teal, 1);
    arc.strokeCircle(W / 2, 0, W / 2 - 70);

    // brand badge center bottom
    const badge = this.add.text(W / 2, H - 28, 'GABB', {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '22px',
      color: '#FFD23F',
    }).setOrigin(0.5).setDepth(-5);
    badge.setShadow(2, 2, '#FF6B35', 2, true, true);

    // decorative dogs in corners
    this.add.image(48, 60, 'dog').setScale(0.7).setAlpha(0.85).setDepth(-6);
    this.add.image(W - 48, 60, 'dog').setScale(0.7).setFlipX(true).setAlpha(0.85).setDepth(-6);
  }

  private buildWalls() {
    const mkWall = (x: number, y: number, w: number, h: number) => {
      const r = this.add.rectangle(x, y, w, h, BRAND.purpleLight, 1).setOrigin(0);
      r.setStrokeStyle(2, BRAND.yellow, 0.9);
      this.physics.add.existing(r, true);
      return r;
    };
    mkWall(0, 0, WALL, H);             // left
    mkWall(W - WALL, 0, WALL, H);      // right
    mkWall(0, 0, W, WALL);             // top

    // bottom angled walls leading to drain
    // create as static rectangles with rotation — arcade can't do rotated bodies,
    // so we approximate with short stacked rects.
    this.buildAngledWall({ x1: WALL, y1: H - 180, x2: (W - DRAIN_W) / 2 - 20, y2: H - 80, side: 'left' });
    this.buildAngledWall({ x1: W - WALL, y1: H - 180, x2: W - (W - DRAIN_W) / 2 + 20, y2: H - 80, side: 'right' });
  }

  private buildAngledWall(opts: { x1: number; y1: number; x2: number; y2: number; side: 'left' | 'right' }) {
    const segments = 14;
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const x = Phaser.Math.Linear(opts.x1, opts.x2, t);
      const y = Phaser.Math.Linear(opts.y1, opts.y2, t);
      const block = this.add.rectangle(x, y, 14, 14, BRAND.coral, 1);
      this.physics.add.existing(block, true);
    }
  }

  private buildPlungerLane() {
    // Vertical lane wall from near top of playfield down to bottom — keeps the
    // launched ball channeled until it pops over the arc deflector at top.
    const laneHeight = H - LANE_TOP + 40;
    const wall = this.add.rectangle(LANE_X, LANE_TOP, 4, laneHeight, BRAND.teal, 0.9).setOrigin(0.5, 0);
    this.physics.add.existing(wall, true);

    // Slanted ramp across the top: starts HIGH near the right wall (so the lane
    // exit at top is mostly open), slopes DOWN-LEFT into the upper playfield.
    // A launched ball rising out of the lane glances off the underside of this
    // ramp and is redirected left into the bumpers.
    const segments = 22;
    const rampX1 = LANE_X - 6;        // right end, just above lane opening
    const rampY1 = LANE_TOP + 6;       // high — barely below top wall
    const rampX2 = WALL + 40;          // left end, near left wall
    const rampY2 = LANE_TOP + 90;      // lower — slopes down to the left
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = Phaser.Math.Linear(rampX1, rampX2, t);
      const y = Phaser.Math.Linear(rampY1, rampY2, t);
      const block = this.add.rectangle(x, y, 14, 14, BRAND.coral, 1);
      this.physics.add.existing(block, true);
    }

    // Plunger visual
    this.add.rectangle(BALL_SPAWN_X, H - 28, 32, 22, BRAND.yellow).setStrokeStyle(2, BRAND.coral);
    this.add.rectangle(BALL_SPAWN_X, H - 12, 36, 6, BRAND.coral);
  }

  private buildBumpers() {
    this.bumpers = this.physics.add.staticGroup();
    const layout: Array<{ x: number; y: number; tex: string; points: number }> = [
      { x: 150, y: 220, tex: 'bumper_coral', points: 100 },
      { x: 300, y: 180, tex: 'bumper_teal', points: 100 },
      { x: 420, y: 240, tex: 'bumper_yellow', points: 100 },
      { x: 110, y: 360, tex: 'bumper_pink', points: 150 },
      { x: 230, y: 320, tex: 'bumper_yellow', points: 150 },
      { x: 360, y: 380, tex: 'bumper_coral', points: 150 },
      { x: 180, y: 480, tex: 'bumper_teal', points: 200 },
      { x: 320, y: 490, tex: 'bumper_pink', points: 200 },
    ];
    layout.forEach(({ x, y, tex, points }) => {
      const s = this.bumpers.create(x, y, tex) as Bumper;
      s.points = points;
      s.flashUntil = 0;
      s.setCircle(28);
      s.refreshBody();
    });
  }

  private buildTargets() {
    // four product targets along upper sides
    const slots = [
      { x: 60, y: 600, label: PRODUCTS[0].label, color: PRODUCTS[0].color, product: PRODUCTS[0] },
      { x: 60, y: 540, label: PRODUCTS[1].label, color: PRODUCTS[1].color, product: PRODUCTS[1] },
      { x: W - 80, y: 600, label: PRODUCTS[2].label, color: PRODUCTS[2].color, product: PRODUCTS[2] },
      { x: W - 80, y: 540, label: PRODUCTS[3].label, color: PRODUCTS[3].color, product: PRODUCTS[3] },
    ];
    slots.forEach((s) => {
      const r = this.add.rectangle(s.x, s.y, 50, 22, s.color, 1).setStrokeStyle(2, BRAND.cream);
      this.physics.add.existing(r, true);
      const t: Target = {
        rect: r,
        body: r.body as Phaser.Physics.Arcade.StaticBody,
        label: s.label,
        color: s.color,
        hit: false,
        product: s.product,
      };
      this.targets.push(t);
      this.add.text(s.x, s.y, s.product.key, {
        fontFamily: 'Press Start 2P, monospace', fontSize: '8px', color: '#1A0B3D',
      }).setOrigin(0.5).setDepth(2);
    });
  }

  private buildFlippers() {
    const y = H - 100;
    const leftPivot = { x: (W - DRAIN_W) / 2 - 20, y };
    const rightPivot = { x: W - (W - DRAIN_W) / 2 + 20, y };

    const mk = (side: 'left' | 'right', pivot: { x: number; y: number }): Flipper => {
      const restAngle = side === 'left' ? 0.45 : Math.PI - 0.45;
      const activeAngle = side === 'left' ? -0.55 : Math.PI + 0.55;
      const sprite = this.add.image(pivot.x, pivot.y, 'flipper').setOrigin(0.05, 0.5).setDepth(3);
      sprite.setRotation(restAngle);
      return {
        pivot, side, restAngle, activeAngle,
        angle: restAngle, vAngle: 0,
        length: 90, width: 22, sprite,
        active: false, pointerHeld: false,
      };
    };

    this.flippers.push(mk('left', leftPivot), mk('right', rightPivot));
  }

  private buildBall() {
    this.ball = this.physics.add.sprite(W - 36, H - 60, 'ball');
    this.ball.setCircle(12);
    this.ball.setBounce(0.78);
    this.ball.setCollideWorldBounds(false);
    this.ball.setMaxVelocity(900, 1400);
    this.ball.setDamping(true);
    this.ball.setDrag(0.999, 0.999);
    this.ball.setDepth(4);
    this.ball.setVelocity(0, 0);

    // ball vs walls and bumpers — uses collider on every Arcade body in scene
    this.physics.add.collider(this.ball, this.children.list.filter(
      (o) => (o as any).body && (o as any).body.physicsType === Phaser.Physics.Arcade.STATIC_BODY,
    ) as any);

    this.physics.add.overlap(this.ball, this.bumpers, (_b, bumper) => this.hitBumper(bumper as Bumper));

    this.targets.forEach((t) => {
      this.physics.add.overlap(this.ball, t.rect, () => this.hitTarget(t));
    });
  }

  private buildHUDFlavor() {
    this.taglineText = this.add.text(W / 2, H - 70, TAGLINES[0], {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '10px',
      color: '#FFF8F0',
    }).setOrigin(0.5).setAlpha(0.6).setDepth(-4);
  }

  private leftArrow!: Phaser.Input.Keyboard.Key;
  private rightArrow!: Phaser.Input.Keyboard.Key;

  private bindInput() {
    const kb = this.input.keyboard!;
    this.leftKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.rightKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.leftArrow = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightArrow = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    // touch / click — left half / right half
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.kickstartAudio();
      if (p.x < W / 2) {
        this.flippers[0].pointerHeld = true;
        AUDIO.flipper();
      } else {
        this.flippers[1].pointerHeld = true;
        AUDIO.flipper();
      }
      if (this.ballInPlunger) this.charging = true;
    });
    // flipper SFX on key down
    this.leftKey.on('down', () => { this.kickstartAudio(); AUDIO.flipper(); });
    this.rightKey.on('down', () => { this.kickstartAudio(); AUDIO.flipper(); });
    this.leftArrow.on('down', () => { this.kickstartAudio(); AUDIO.flipper(); });
    this.rightArrow.on('down', () => { this.kickstartAudio(); AUDIO.flipper(); });
    this.spaceKey.on('down', () => this.kickstartAudio());
    this.input.on('pointerup', () => {
      this.flippers[0].pointerHeld = false;
      this.flippers[1].pointerHeld = false;
      if (this.ballInPlunger) this.releasePlunger();
    });
    // safety: clear on focus loss
    this.input.on('gameout', () => {
      this.flippers[0].pointerHeld = false;
      this.flippers[1].pointerHeld = false;
    });
  }

  // ---------- update logic ----------

  private updateFlippers(dt: number) {
    // Resolve active state from CURRENT key+pointer state each frame so the
    // flipper drops the instant the user releases.
    this.flippers[0].active = this.leftKey.isDown || this.leftArrow.isDown || this.flippers[0].pointerHeld;
    this.flippers[1].active = this.rightKey.isDown || this.rightArrow.isDown || this.flippers[1].pointerHeld;

    this.flippers.forEach((f) => {
      const target = f.active ? f.activeAngle : f.restAngle;
      const speed = f.active ? 28 : 16; // rad/s desired
      const diff = target - f.angle;
      f.vAngle = Phaser.Math.Clamp(diff * speed, -40, 40);
      f.angle += f.vAngle * dt;
      // clamp
      const min = Math.min(f.restAngle, f.activeAngle);
      const max = Math.max(f.restAngle, f.activeAngle);
      f.angle = Phaser.Math.Clamp(f.angle, min, max);
      f.sprite.setRotation(f.angle);
    });
  }

  private handleFlipperBallCollision() {
    const ballR = 12;
    const ballPos = new Phaser.Math.Vector2(this.ball.x, this.ball.y);

    this.flippers.forEach((f) => {
      // tip position
      const tip = new Phaser.Math.Vector2(
        f.pivot.x + Math.cos(f.angle) * f.length,
        f.pivot.y + Math.sin(f.angle) * f.length,
      );
      const a = new Phaser.Math.Vector2(f.pivot.x, f.pivot.y);
      const b = tip;
      const closest = closestPointOnSegment(a, b, ballPos);
      const dx = ballPos.x - closest.x;
      const dy = ballPos.y - closest.y;
      const dist = Math.hypot(dx, dy);
      const minDist = ballR + f.width / 2 - 3;
      if (dist < minDist && dist > 0.0001) {
        // push ball out
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        this.ball.x += nx * overlap;
        this.ball.y += ny * overlap;

        const v = this.ball.body!.velocity;
        const dot = v.x * nx + v.y * ny;
        if (dot < 0) {
          // reflect
          const bounceMul = 1.05;
          v.x = (v.x - 2 * dot * nx) * bounceMul;
          v.y = (v.y - 2 * dot * ny) * bounceMul;
        }

        // add flipper kick when active and moving
        if (f.active && Math.abs(f.vAngle) > 1) {
          // point on flipper relative to pivot
          const rx = closest.x - f.pivot.x;
          const ry = closest.y - f.pivot.y;
          // tangential velocity = ω × r  (2D: vt = (-ry, rx) * ω)
          const omega = f.vAngle;
          const vtx = -ry * omega;
          const vty = rx * omega;
          v.x += vtx * 0.6 + nx * 220;
          v.y += vty * 0.6 + ny * 220;
        }

        this.ball.setVelocity(
          Phaser.Math.Clamp(v.x, -900, 900),
          Phaser.Math.Clamp(v.y, -1400, 1400),
        );
      }
    });
  }

  private updatePlunger(dt: number) {
    if (!this.ballInPlunger) return;
    // hold space to charge
    if (this.spaceKey.isDown) {
      this.charging = true;
      this.plungerPower = Math.min(this.plungerPower + dt * 1300, 1500);
    } else if (this.charging) {
      this.releasePlunger();
    }
    // hold ball in the lane
    this.ball.setVelocity(0, 0);
    this.ball.x = BALL_SPAWN_X;
    this.ball.y = BALL_SPAWN_Y + (this.plungerPower / 1500) * 10;
  }

  private releasePlunger() {
    if (!this.charging) return;
    // Min 900 ensures the ball clears the arc deflector at top of lane.
    this.ball.setVelocity(0, -Math.max(this.plungerPower, 900));
    this.plungerPower = 0;
    this.charging = false;
    this.ballInPlunger = false;
    AUDIO.launch();
  }

  private kickstartAudio() {
    AUDIO.ensure();
    AUDIO.startMusic();
  }

  private checkDrain() {
    if (this.gameOver || this.ballInPlunger) return;

    // If the ball is moving down inside the plunger lane (right of LANE_X), it
    // never left the lane — treat as a free re-plunge instead of a drain.
    if (
      this.ball.x > LANE_X + 6 &&
      this.ball.y > H - 120 &&
      (this.ball.body?.velocity.y ?? 0) >= 0
    ) {
      this.respawnBall();
      return;
    }

    if (this.ball.y > H + 40 || this.ball.x < -40 || this.ball.x > W + 40) {
      this.ballsLeft -= 1;
      this.registry.set('balls', this.ballsLeft);
      this.flash(`BALL LOST — ${this.ballsLeft} LEFT`, BRAND.coral);
      AUDIO.drain();
      if (this.ballsLeft <= 0) {
        this.endGame();
        return;
      }
      this.respawnBall();
    }
  }

  private respawnBall() {
    this.ballInPlunger = true;
    this.charging = false;
    this.plungerPower = 0;
    this.ball.setVelocity(0, 0);
    this.ball.setPosition(BALL_SPAWN_X, BALL_SPAWN_Y);
  }

  // ---------- events ----------

  private hitBumper(bumper: Bumper) {
    const now = this.time.now;
    if (now < bumper.flashUntil) return;
    bumper.flashUntil = now + 80;

    const dx = this.ball.x - bumper.x;
    const dy = this.ball.y - bumper.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const kick = 380;
    const v = this.ball.body!.velocity;
    v.x = nx * kick + v.x * 0.2;
    v.y = ny * kick + v.y * 0.2;
    this.ball.setVelocity(v.x, v.y);

    this.addScore(bumper.points);
    this.popText(bumper.x, bumper.y - 28, `+${bumper.points}`, BRAND.cream);
    this.tweens.add({ targets: bumper, scale: { from: 1.25, to: 1 }, duration: 140 });
    AUDIO.bumper();
  }

  private hitTarget(t: Target) {
    if (t.hit) return;
    t.hit = true;
    t.rect.setFillStyle(BRAND.purpleDeep, 1);
    t.rect.setStrokeStyle(2, t.color);
    this.addScore(t.product.points);
    this.popText(t.rect.x, t.rect.y - 24, `${t.product.label}!`, t.color);
    AUDIO.target();

    if (this.targets.every((x) => x.hit)) {
      this.completeMode();
    }
  }

  private completeMode() {
    const bonus = 5000;
    this.addScore(bonus);
    const mode = PRODUCTS[this.modeIdx].label;
    this.flash(`${mode.toUpperCase()} MODE — +${bonus}`, BRAND.yellow);
    AUDIO.mode();
    // reset for next mode
    this.targets.forEach((t) => {
      t.hit = false;
      t.rect.setFillStyle(t.color, 1);
      t.rect.setStrokeStyle(2, BRAND.cream);
    });
    this.modeIdx = (this.modeIdx + 1) % PRODUCTS.length;
    this.registry.set('mode', PRODUCTS[this.modeIdx].label);
    this.taglineText.setText(TAGLINES[this.modeIdx % TAGLINES.length]);
  }

  private addScore(n: number) {
    this.score += n;
    this.registry.set('score', this.score);
  }

  private popText(x: number, y: number, msg: string, color: number) {
    const t = this.add.text(x, y, msg, {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '10px',
      color: '#' + color.toString(16).padStart(6, '0'),
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({
      targets: t, y: y - 30, alpha: 0, duration: 700,
      onComplete: () => t.destroy(),
    });
  }

  private flash(msg: string, color: number) {
    this.flashText?.destroy();
    this.flashText = this.add.text(W / 2, H / 2 - 80, msg, {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '14px',
      color: '#' + color.toString(16).padStart(6, '0'),
      align: 'center',
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: this.flashText,
      scale: { from: 1.4, to: 1 },
      duration: 200,
    });
  }

  private decayFlashes() {
    if (!this.flashText) return;
    this.flashText.alpha -= 0.005;
    if (this.flashText.alpha <= 0) { this.flashText.destroy(); this.flashText = undefined; }
  }

  private endGame() {
    this.gameOver = true;
    this.ball.setVelocity(0, 0);
    this.ball.setVisible(false);
    AUDIO.stopMusic();
    AUDIO.gameOver();

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, BRAND.purpleDeep, 0.85).setDepth(50);
    const title = this.add.text(W / 2, H / 2 - 60, 'GAME OVER', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '28px', color: '#FFD23F',
    }).setOrigin(0.5).setDepth(51);
    const sub = this.add.text(W / 2, H / 2, `Final Score: ${this.score}`, {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#FFF8F0',
    }).setOrigin(0.5).setDepth(51);
    const tag = this.add.text(W / 2, H / 2 + 40, 'PARENTS APPROVE!', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#FF6B35',
    }).setOrigin(0.5).setDepth(51);
    const btn = this.add.text(W / 2, H / 2 + 100, '> PRESS SPACE TO PLAY AGAIN <', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#00C896',
    }).setOrigin(0.5).setDepth(51);
    this.tweens.add({ targets: btn, alpha: { from: 1, to: 0.3 }, duration: 600, yoyo: true, repeat: -1 });

    const replay = () => {
      [overlay, title, sub, tag, btn].forEach((o) => o.destroy());
      this.resetGame();
      AUDIO.startMusic();
    };
    this.spaceKey.once('down', replay);
    this.input.once('pointerdown', replay);
  }

  private resetGame() {
    this.score = 0;
    this.ballsLeft = 3;
    this.modeIdx = 0;
    this.gameOver = false;
    this.registry.set('score', 0);
    this.registry.set('balls', 3);
    this.registry.set('mode', PRODUCTS[0].label);
    this.targets.forEach((t) => {
      t.hit = false;
      t.rect.setFillStyle(t.color, 1);
      t.rect.setStrokeStyle(2, BRAND.cream);
    });
    this.ball.setVisible(true);
    this.respawnBall();
  }
}

function closestPointOnSegment(a: Phaser.Math.Vector2, b: Phaser.Math.Vector2, p: Phaser.Math.Vector2) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const len2 = abx * abx + aby * aby || 1;
  const t = Phaser.Math.Clamp((apx * abx + apy * aby) / len2, 0, 1);
  return new Phaser.Math.Vector2(a.x + abx * t, a.y + aby * t);
}
