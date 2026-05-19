import Phaser from 'phaser';
import { AUDIO } from '../audio';

export class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }

  create() {
    const W = this.scale.width;
    const game = this.scene.get('Game');

    const title = this.add.text(W / 2, 6, 'GABB PINBALL', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '11px', color: '#FFD23F',
    }).setOrigin(0.5, 0).setDepth(100);
    title.setShadow(1, 1, '#FF6B35', 1, true, true);

    const score = this.add.text(20, 30, 'SCORE 0', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '12px', color: '#FFF8F0',
    }).setDepth(100);

    const balls = this.add.text(W - 20, 30, 'BALLS 3', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '12px', color: '#00C896',
    }).setOrigin(1, 0).setDepth(100);

    const mode = this.add.text(W / 2, 55, 'MODE: GABB WATCH', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '9px', color: '#FF6B35',
    }).setOrigin(0.5, 0).setDepth(100);

    this.add.text(W / 2, this.scale.height - 12,
      'Z / M = FLIPPERS  •  HOLD SPACE = LAUNCH  •  X = MUTE', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '7px', color: '#FFF8F0',
    }).setOrigin(0.5, 1).setAlpha(0.55).setDepth(100);

    const muteBtn = this.add.text(W - 20, 55, '[SOUND ON]', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '8px', color: '#FFD23F',
    }).setOrigin(1, 0).setDepth(100).setInteractive({ useHandCursor: true });
    const toggleMute = () => {
      const m = AUDIO.toggleMute();
      muteBtn.setText(m ? '[SOUND OFF]' : '[SOUND ON]');
      muteBtn.setColor(m ? '#FF5C8A' : '#FFD23F');
    };
    muteBtn.on('pointerdown', toggleMute);
    this.input.keyboard?.addKey('X').on('down', toggleMute);

    game.registry.events.on('changedata', (_p: unknown, key: string, val: unknown) => {
      if (key === 'score') score.setText(`SCORE ${val}`);
      if (key === 'balls') balls.setText(`BALLS ${val}`);
      if (key === 'mode') mode.setText(`MODE: ${String(val).toUpperCase()}`);
    });
  }
}
