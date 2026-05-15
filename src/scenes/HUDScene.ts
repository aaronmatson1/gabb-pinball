import Phaser from 'phaser';
import { BRAND } from '../brand';
import { AUDIO } from '../audio';

export class HUDScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private ballText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;

  constructor() { super('HUD'); }

  create() {
    const W = this.scale.width;
    const game = this.scene.get('Game');

    this.titleText = this.add.text(W / 2, 6, 'GABB PINBALL', {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '11px',
      color: '#FFD23F',
    }).setOrigin(0.5, 0).setDepth(100);
    this.titleText.setShadow(1, 1, '#FF6B35', 1, true, true);

    this.scoreText = this.add.text(20, 30, 'SCORE 0', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '12px', color: '#FFF8F0',
    }).setDepth(100);

    this.ballText = this.add.text(W - 20, 30, 'BALLS 3', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '12px', color: '#00C896',
    }).setOrigin(1, 0).setDepth(100);

    this.modeText = this.add.text(W / 2, 55, 'MODE: GABB WATCH', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '9px', color: '#FF6B35',
    }).setOrigin(0.5, 0).setDepth(100);

    // controls hint
    this.add.text(W / 2, this.scale.height - 12, 'Z / M = FLIPPERS  •  SPACE = LAUNCH  •  TAP SIDES ON TOUCH', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '7px', color: '#FFF8F0',
    }).setOrigin(0.5, 1).setAlpha(0.55).setDepth(100);

    // mute button
    const muteBtn = this.add.text(W - 20, 55, '[SOUND ON]', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '8px', color: '#FFD23F',
    }).setOrigin(1, 0).setDepth(100).setInteractive({ useHandCursor: true });
    muteBtn.on('pointerdown', () => {
      const muted = AUDIO.toggleMute();
      muteBtn.setText(muted ? '[SOUND OFF]' : '[SOUND ON]');
      muteBtn.setColor(muted ? '#FF5C8A' : '#FFD23F');
    });
    // M-key would conflict with right flipper, so use the keyboard shortcut "X"
    this.input.keyboard?.addKey('X').on('down', () => {
      const muted = AUDIO.toggleMute();
      muteBtn.setText(muted ? '[SOUND OFF]' : '[SOUND ON]');
      muteBtn.setColor(muted ? '#FF5C8A' : '#FFD23F');
    });

    game.registry.events.on('changedata', (_p: unknown, key: string, val: unknown) => {
      if (key === 'score') this.scoreText.setText(`SCORE ${val}`);
      if (key === 'balls') this.ballText.setText(`BALLS ${val}`);
      if (key === 'mode') this.modeText.setText(`MODE: ${String(val).toUpperCase()}`);
    });
  }
}
