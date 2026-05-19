import Phaser from 'phaser';
import { BRAND, PRODUCTS, TAGLINES } from '../brand';
import { AUDIO } from '../audio';

// Pull MatterJS root namespace from Phaser for body utilities.
const MatterLib = (Phaser.Physics.Matter as any).Matter as typeof MatterJS;

const W = 540;
const H = 860;
const WALL = 20;
const LANE_W = 44;                  // width of plunger channel
const LANE_X = W - WALL - LANE_W;   // inner-left edge of channel (lane wall x)
const SPAWN_X = W - WALL - LANE_W / 2;
const SPAWN_Y = H - 60;
const FLIPPER_PIVOT_SPACING = 200;  // distance between left and right flipper pivots
const FLIPPER_PIVOT_Y = H - 130;

interface Flipper {
  body: MatterJS.BodyType;
  sprite: Phaser.Physics.Matter.Image;
  side: 'L' | 'R';
  restAngle: number;
  activeAngle: number;
  pressed: boolean;
}

interface Bumper {
  body: MatterJS.BodyType;
  sprite: Phaser.Physics.Matter.Image;
  points: number;
  flashUntil: number;
}

interface Target {
  body: MatterJS.BodyType;
  rect: Phaser.GameObjects.Rectangle;
  product: typeof PRODUCTS[number];
  hit: boolean;
}

export class GameScene extends Phaser.Scene {
  private ball!: Phaser.Physics.Matter.Image;
  private flippers: Flipper[] = [];
  private bumpers: Bumper[] = [];
  private targets: Target[] = [];

  private keyZ!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  private ballInLane = true;
  private plungerCharge = 0;
  private spaceCharging = false;
  private score = 0;
  private balls = 3;
  private modeIdx = 0;
  private gameOver = false;
  private flashText?: Phaser.GameObjects.Text;
  private taglineText!: Phaser.GameObjects.Text;

  constructor() { super('Game'); }

  create() {
    // No matter world bounds — we build our own walls and want the ball to be
    // able to drain off the bottom of the screen.
    this.drawBackdrop();
    this.buildWalls();
    this.buildLane();
    this.buildBumpers();
    this.buildTargets();
    this.buildFlippers();
    this.buildBall();
    this.buildFlavor();
    this.bindInput();
    this.bindCollisions();

    this.registry.set('score', 0);
    this.registry.set('balls', this.balls);
    this.registry.set('mode', PRODUCTS[0].label);
  }

  update(_t: number, dtMs: number) {
    const dt = dtMs / 1000;
    this.updateFlippers();
    this.updatePlunger(dt);
    this.checkDrain();
    this.decayFlash();
  }

  // ---------------- build ----------------

  private drawBackdrop() {
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, BRAND.purple, 0.15).setDepth(-10);
    this.add.image(54, 70, 'dog').setScale(0.7).setAlpha(0.85).setDepth(-6);
    this.add.image(W - 54, 70, 'dog').setScale(0.7).setFlipX(true).setAlpha(0.85).setDepth(-6);
    this.add.text(W / 2, H - 24, 'GABB', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '22px', color: '#FFD23F',
    }).setOrigin(0.5).setDepth(-5).setShadow(2, 2, '#FF6B35', 2, true, true);
    overlay.setVisible(true);
  }

  private staticWall(x: number, y: number, w: number, h: number, opts: { angle?: number; color?: number } = {}) {
    const angle = opts.angle ?? 0;
    const color = opts.color ?? BRAND.purpleLight;
    const rect = this.add.rectangle(x, y, w, h, color, 1)
      .setStrokeStyle(2, BRAND.yellow, 0.9)
      .setDepth(0);
    rect.setRotation(angle);
    this.matter.add.gameObject(rect, {
      isStatic: true,
      angle,
      friction: 0.02,
      restitution: 0.4,
      label: 'wall',
    } as any);
    return rect;
  }

  private buildWalls() {
    // outer rectangle
    this.staticWall(W / 2, WALL / 2, W, WALL);              // top
    this.staticWall(WALL / 2, H / 2, WALL, H);              // left
    this.staticWall(W - WALL / 2, H / 2, WALL, H);          // right

    // Bottom angled funnels — these terminate at the flipper pivots so any ball
    // landing in the lower playfield is funneled onto a flipper or into the
    // central drain gap between flippers.
    const fx = FLIPPER_PIVOT_SPACING / 2;     // half-spacing between flipper pivots
    const flipperPx = W / 2 - fx;             // left pivot world x
    const dx = flipperPx - WALL;              // horizontal run of left funnel
    const dy = FLIPPER_PIVOT_Y - (H - 260);   // vertical run
    const funnelLen = Math.hypot(dx, dy);
    const funnelAngle = Math.atan2(dy, dx);   // positive slope
    const leftCx = (WALL + flipperPx) / 2;
    const leftCy = (H - 260 + FLIPPER_PIVOT_Y) / 2;
    this.staticWall(leftCx, leftCy, funnelLen, 12, { angle: funnelAngle, color: BRAND.coral });
    this.staticWall(W - leftCx, leftCy, funnelLen, 12, { angle: -funnelAngle, color: BRAND.coral });
  }

  private buildLane() {
    // vertical lane wall — left side of plunger channel
    this.staticWall(LANE_X, H / 2 + 50, 6, H - 100, { color: BRAND.teal });

    // Angled top deflector — the whole point of switching to Matter physics.
    // Rotated rectangle with POSITIVE angle (\\ shape, tilted clockwise) so its
    // underside faces down-LEFT. A ball launched up through the lane hits the
    // underside; reflection sends it LEFT into the playfield naturally.
    // The angle is what does the work — Matter computes proper rigid-body
    // collision normals for rotated rectangles, unlike Arcade physics.
    const defLen = 220;
    const defAngle = Math.PI * 0.22;            // +40° clockwise (\\ shape)
    const defCx = 470;
    const defCy = 50;
    this.staticWall(defCx, defCy, defLen, 14, { angle: defAngle, color: BRAND.coral });

    // plunger visual
    this.add.rectangle(SPAWN_X, H - 28, LANE_W - 8, 22, BRAND.yellow).setStrokeStyle(2, BRAND.coral);
    this.add.rectangle(SPAWN_X, H - 12, LANE_W - 2, 6, BRAND.coral);
  }

  private buildBumpers() {
    const layout: Array<{ x: number; y: number; tex: string; points: number }> = [
      { x: 130, y: 260, tex: 'bumper_coral', points: 100 },
      { x: 270, y: 220, tex: 'bumper_teal', points: 100 },
      { x: 380, y: 270, tex: 'bumper_yellow', points: 100 },
      { x: 100, y: 380, tex: 'bumper_pink', points: 150 },
      { x: 230, y: 360, tex: 'bumper_yellow', points: 150 },
      { x: 340, y: 400, tex: 'bumper_coral', points: 150 },
      { x: 170, y: 490, tex: 'bumper_teal', points: 200 },
      { x: 320, y: 510, tex: 'bumper_pink', points: 200 },
    ];
    layout.forEach(({ x, y, tex, points }) => {
      const sprite = this.matter.add.image(x, y, tex, undefined, {
        shape: { type: 'circle', radius: 28 } as any,
        isStatic: true,
        restitution: 1.4,
        friction: 0,
        label: 'bumper',
      });
      this.bumpers.push({ body: sprite.body as MatterJS.BodyType, sprite, points, flashUntil: 0 });
    });
  }

  private buildTargets() {
    const slots = [
      { x: 60, y: 600, product: PRODUCTS[0] },
      { x: 60, y: 560, product: PRODUCTS[1] },
      { x: W - 80, y: 600, product: PRODUCTS[2] },
      { x: W - 80, y: 560, product: PRODUCTS[3] },
    ];
    slots.forEach((s) => {
      const rect = this.add.rectangle(s.x, s.y, 52, 22, s.product.color, 1).setStrokeStyle(2, BRAND.cream);
      this.matter.add.gameObject(rect, {
        isStatic: true,
        restitution: 0.6,
        label: 'target',
      } as any);
      this.add.text(s.x, s.y, s.product.key, {
        fontFamily: 'Press Start 2P, monospace', fontSize: '8px', color: '#1A0B3D',
      }).setOrigin(0.5).setDepth(2);
      this.targets.push({
        body: (rect as any).body as MatterJS.BodyType,
        rect,
        product: s.product,
        hit: false,
      });
    });
  }

  private buildFlippers() {
    const length = 96;
    const halfBody = length / 2;
    const pivotInset = 12;        // distance from end of body to pivot
    const leftPivot = { x: W / 2 - FLIPPER_PIVOT_SPACING / 2, y: FLIPPER_PIVOT_Y };
    const rightPivot = { x: W / 2 + FLIPPER_PIVOT_SPACING / 2, y: FLIPPER_PIVOT_Y };

    const buildOne = (side: 'L' | 'R', pivot: { x: number; y: number }) => {
      const isLeft = side === 'L';
      // Both flippers point downward-toward-center at rest.
      // Left  flipper: pivot at LEFT end, rest tilts down-right  → angle  = +28°
      // Right flipper: pivot at RIGHT end, rest tilts down-left  → angle  = -28°
      const restAngle = Phaser.Math.DegToRad(isLeft ? 28 : -28);
      const activeAngle = Phaser.Math.DegToRad(isLeft ? -32 : 32);
      // Body-local x of the pivot (relative to body center).
      // Left flipper: pivot is at the LEFT end of the body, so local x = -(halfBody - inset)
      // Right flipper: pivot is at the RIGHT end, so local x = +(halfBody - inset)
      const pivotOffset = (isLeft ? -1 : 1) * (halfBody - pivotInset);
      // Position body center so that the pivot end lands exactly on the world pivot point at rest.
      const cx = pivot.x - Math.cos(restAngle) * pivotOffset;
      const cy = pivot.y - Math.sin(restAngle) * pivotOffset;

      const sprite = this.matter.add.image(cx, cy, 'flipper', undefined, {
        shape: { type: 'rectangle', width: length, height: 22 } as any,
        density: 0.01,
        friction: 0,
        frictionAir: 0.04,
        restitution: 0.2,
        label: 'flipper',
      });
      sprite.setAngle(Phaser.Math.RadToDeg(restAngle));
      MatterLib.Body.setAngle(sprite.body as any, restAngle);

      // Pin the inner end to the world pivot point with a stiff constraint.
      this.matter.add.constraint(sprite.body as any, undefined as any, 0, 1, {
        pointA: { x: pivot.x, y: pivot.y },
        pointB: { x: pivotOffset, y: 0 },
        length: 0,
        stiffness: 1,
      } as any);

      this.flippers.push({
        body: sprite.body as MatterJS.BodyType,
        sprite,
        side,
        restAngle,
        activeAngle,
        pressed: false,
      });
    };

    buildOne('L', leftPivot);
    buildOne('R', rightPivot);
  }

  private buildBall() {
    const img = this.matter.add.image(SPAWN_X, SPAWN_Y, 'ball', undefined, {
      shape: { type: 'circle', radius: 12 } as any,
      density: 0.004,
      restitution: 0.55,
      friction: 0.005,
      frictionAir: 0.002,
      label: 'ball',
    });
    img.setDepth(5);
    this.ball = img;
  }

  private buildFlavor() {
    this.taglineText = this.add.text(W / 2, H - 60, TAGLINES[0], {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '10px',
      color: '#FFF8F0',
    }).setOrigin(0.5).setAlpha(0.55).setDepth(-4);
  }

  // ---------------- input ----------------

  private bindInput() {
    const kb = this.input.keyboard!;
    this.keyZ = kb.addKey('Z');
    this.keyM = kb.addKey('M');
    this.keyLeft = kb.addKey('LEFT');
    this.keyRight = kb.addKey('RIGHT');
    this.keySpace = kb.addKey('SPACE');

    this.keyZ.on('down', () => { this.kickAudio(); AUDIO.flipper(); });
    this.keyM.on('down', () => { this.kickAudio(); AUDIO.flipper(); });
    this.keyLeft.on('down', () => { this.kickAudio(); AUDIO.flipper(); });
    this.keyRight.on('down', () => { this.kickAudio(); AUDIO.flipper(); });
    this.keySpace.on('down', () => this.kickAudio());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.kickAudio();
      if (this.ballInLane) {
        this.spaceCharging = true;
        return;
      }
      if (p.x < W / 2) this.flippers[0].pressed = true;
      else this.flippers[1].pressed = true;
      AUDIO.flipper();
    });
    this.input.on('pointerup', () => {
      this.flippers[0].pressed = false;
      this.flippers[1].pressed = false;
      if (this.ballInLane && this.spaceCharging) this.fire();
    });
  }

  private bindCollisions() {
    this.matter.world.on('collisionstart', (event: any) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        const labels = [a.label, b.label];
        if (labels.includes('ball') && labels.includes('bumper')) {
          const bumperBody = a.label === 'bumper' ? a : b;
          const bumper = this.bumpers.find((bm) => bm.body === bumperBody);
          if (bumper) this.hitBumper(bumper);
        } else if (labels.includes('ball') && labels.includes('target')) {
          const targetBody = a.label === 'target' ? a : b;
          const target = this.targets.find((t) => t.body === targetBody);
          if (target) this.hitTarget(target);
        } else if (labels.includes('ball') && labels.includes('flipper')) {
          AUDIO.flipper();
        }
      }
    });
  }

  // ---------------- update ----------------

  private updateFlippers() {
    const leftPressed = this.keyZ.isDown || this.keyLeft.isDown || this.flippers[0].pressed;
    const rightPressed = this.keyM.isDown || this.keyRight.isDown || this.flippers[1].pressed;

    this.applyFlipper(this.flippers[0], leftPressed);
    this.applyFlipper(this.flippers[1], rightPressed);
  }

  private applyFlipper(f: Flipper, pressed: boolean) {
    const target = pressed ? f.activeAngle : f.restAngle;
    const body = f.body as any;
    const current = body.angle;
    // proportional angular velocity toward target, clamped
    const diff = target - current;
    const speed = pressed ? 0.9 : 0.55;
    let v = diff * speed * 10;
    v = Phaser.Math.Clamp(v, -1.6, 1.6);
    MatterLib.Body.setAngularVelocity(body, v);

    // hard clamp once arrived
    const minA = Math.min(f.restAngle, f.activeAngle);
    const maxA = Math.max(f.restAngle, f.activeAngle);
    if (body.angle < minA) { MatterLib.Body.setAngle(body, minA); MatterLib.Body.setAngularVelocity(body, 0); }
    if (body.angle > maxA) { MatterLib.Body.setAngle(body, maxA); MatterLib.Body.setAngularVelocity(body, 0); }
  }

  private updatePlunger(dt: number) {
    if (!this.ballInLane) return;

    // hold ball in place in the lane
    MatterLib.Body.setPosition(this.ball.body as any, {
      x: SPAWN_X,
      y: SPAWN_Y + (this.plungerCharge / 1.0) * 10,
    });
    MatterLib.Body.setVelocity(this.ball.body as any, { x: 0, y: 0 });
    MatterLib.Body.setAngularVelocity(this.ball.body as any, 0);

    if (this.keySpace.isDown) {
      this.spaceCharging = true;
      this.plungerCharge = Math.min(this.plungerCharge + dt * 1.5, 1.0);
    } else if (this.spaceCharging) {
      this.fire();
    }
  }

  private fire() {
    const power = Math.max(this.plungerCharge, 0.55);    // 0..1
    const v = -18 - power * 12;                            // -18..-30 (matter units)
    MatterLib.Body.setVelocity(this.ball.body as any, { x: 0, y: v });
    this.plungerCharge = 0;
    this.spaceCharging = false;
    this.ballInLane = false;
    AUDIO.launch();
  }

  private checkDrain() {
    if (this.gameOver || this.ballInLane) return;
    const y = (this.ball.body as any).position.y;
    const x = (this.ball.body as any).position.x;
    if (y > H + 30 || x < -30 || x > W + 30) {
      this.balls -= 1;
      this.registry.set('balls', this.balls);
      this.flash(`BALL LOST — ${this.balls} LEFT`, BRAND.coral);
      AUDIO.drain();
      if (this.balls <= 0) { this.endGame(); return; }
      this.respawn();
    }
  }

  private respawn() {
    this.ballInLane = true;
    this.plungerCharge = 0;
    this.spaceCharging = false;
    MatterLib.Body.setPosition(this.ball.body as any, { x: SPAWN_X, y: SPAWN_Y });
    MatterLib.Body.setVelocity(this.ball.body as any, { x: 0, y: 0 });
  }

  // ---------------- events ----------------

  private hitBumper(b: Bumper) {
    const now = this.time.now;
    if (now < b.flashUntil) return;
    b.flashUntil = now + 60;
    this.addScore(b.points);
    this.popText(b.sprite.x, b.sprite.y - 28, `+${b.points}`, BRAND.cream);
    this.tweens.add({ targets: b.sprite, scale: { from: 1.25, to: 1 }, duration: 140 });
    AUDIO.bumper();
  }

  private hitTarget(t: Target) {
    if (t.hit) return;
    t.hit = true;
    t.rect.setFillStyle(BRAND.purpleDeep, 1);
    t.rect.setStrokeStyle(2, t.product.color);
    this.addScore(t.product.points);
    this.popText(t.rect.x, t.rect.y - 24, `${t.product.label}!`, t.product.color);
    AUDIO.target();
    if (this.targets.every((x) => x.hit)) this.completeMode();
  }

  private completeMode() {
    const bonus = 5000;
    this.addScore(bonus);
    this.flash(`${PRODUCTS[this.modeIdx].label.toUpperCase()} MODE — +${bonus}`, BRAND.yellow);
    AUDIO.mode();
    this.targets.forEach((t) => {
      t.hit = false;
      t.rect.setFillStyle(t.product.color, 1);
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
      fontFamily: 'Press Start 2P, monospace', fontSize: '10px',
      color: '#' + color.toString(16).padStart(6, '0'),
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private flash(msg: string, color: number) {
    this.flashText?.destroy();
    this.flashText = this.add.text(W / 2, H / 2 - 80, msg, {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px',
      color: '#' + color.toString(16).padStart(6, '0'), align: 'center',
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: this.flashText, scale: { from: 1.4, to: 1 }, duration: 200 });
  }

  private decayFlash() {
    if (!this.flashText) return;
    this.flashText.alpha -= 0.005;
    if (this.flashText.alpha <= 0) { this.flashText.destroy(); this.flashText = undefined; }
  }

  private endGame() {
    this.gameOver = true;
    AUDIO.stopMusic();
    AUDIO.gameOver();
    MatterLib.Body.setVelocity(this.ball.body as any, { x: 0, y: 0 });
    this.ball.setVisible(false);
    const ov = this.add.rectangle(W / 2, H / 2, W, H, BRAND.purpleDeep, 0.85).setDepth(50);
    const t1 = this.add.text(W / 2, H / 2 - 60, 'GAME OVER', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '28px', color: '#FFD23F',
    }).setOrigin(0.5).setDepth(51);
    const t2 = this.add.text(W / 2, H / 2, `Final Score: ${this.score}`, {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#FFF8F0',
    }).setOrigin(0.5).setDepth(51);
    const t3 = this.add.text(W / 2, H / 2 + 40, 'PARENTS APPROVE!', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#FF6B35',
    }).setOrigin(0.5).setDepth(51);
    const t4 = this.add.text(W / 2, H / 2 + 100, '> PRESS SPACE TO PLAY AGAIN <', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#00C896',
    }).setOrigin(0.5).setDepth(51);
    this.tweens.add({ targets: t4, alpha: { from: 1, to: 0.3 }, duration: 600, yoyo: true, repeat: -1 });
    const replay = () => {
      [ov, t1, t2, t3, t4].forEach((o) => o.destroy());
      this.score = 0;
      this.balls = 3;
      this.modeIdx = 0;
      this.gameOver = false;
      this.registry.set('score', 0);
      this.registry.set('balls', 3);
      this.registry.set('mode', PRODUCTS[0].label);
      this.targets.forEach((t) => {
        t.hit = false;
        t.rect.setFillStyle(t.product.color, 1);
        t.rect.setStrokeStyle(2, BRAND.cream);
      });
      this.ball.setVisible(true);
      this.respawn();
      AUDIO.startMusic();
    };
    this.keySpace.once('down', replay);
    this.input.once('pointerdown', replay);
  }

  private kickAudio() { AUDIO.ensure(); AUDIO.startMusic(); }
}
