import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { BRAND } from './brand';

export const W = 540;
export const H = 860;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: BRAND.purpleDeep,
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1.1 },
      debug: false,
      enableSleeping: false,
      positionIterations: 10,
      velocityIterations: 8,
    },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, GameScene, HUDScene],
});

document.getElementById('loading')?.classList.add('hidden');
