import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { BRAND } from './brand';

const WIDTH = 540;
const HEIGHT = 860;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: BRAND.purpleDeep,
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 520 }, debug: false },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, GameScene, HUDScene],
});

document.getElementById('loading')?.classList.add('hidden');

export const GAME = { WIDTH, HEIGHT };
