import Phaser from 'phaser';
import { BRAND } from '../brand';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.makeBall();
    this.makeBumper('bumper_coral', BRAND.coral);
    this.makeBumper('bumper_teal', BRAND.teal);
    this.makeBumper('bumper_pink', BRAND.pink);
    this.makeBumper('bumper_yellow', BRAND.yellow);
    this.makeFlipper();
    this.makeDog();
  }

  create() {
    this.scene.start('Game');
    this.scene.launch('HUD');
  }

  private makeBall() {
    const g = this.add.graphics();
    const r = 12;
    g.fillStyle(BRAND.cream, 1); g.fillCircle(r, r, r);
    g.fillStyle(BRAND.white, 1); g.fillCircle(r - 4, r - 4, 4);
    g.lineStyle(2, BRAND.purpleDeep, 0.5); g.strokeCircle(r, r, r);
    g.generateTexture('ball', r * 2, r * 2);
    g.destroy();
  }

  private makeBumper(key: string, color: number) {
    const g = this.add.graphics();
    const r = 28;
    g.fillStyle(BRAND.purpleDeep, 1); g.fillCircle(r, r, r);
    g.fillStyle(color, 1); g.fillCircle(r, r, r - 4);
    g.fillStyle(BRAND.white, 0.45); g.fillCircle(r - 6, r - 6, 6);
    g.lineStyle(3, BRAND.cream, 1); g.strokeCircle(r, r, r - 4);
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
  }

  private makeFlipper() {
    const g = this.add.graphics();
    const w = 96, h = 22;
    g.fillStyle(BRAND.yellow, 1); g.fillRoundedRect(0, 0, w, h, 11);
    g.lineStyle(3, BRAND.coral, 1); g.strokeRoundedRect(0, 0, w, h, 11);
    g.fillStyle(BRAND.purpleDeep, 1); g.fillCircle(h / 2, h / 2, 5);
    g.generateTexture('flipper', w, h);
    g.destroy();
  }

  private makeDog() {
    const g = this.add.graphics();
    const w = 64, h = 64;
    g.fillStyle(BRAND.cream, 1);
    g.fillRoundedRect(8, 22, 48, 32, 10);
    g.fillCircle(48, 28, 14);
    g.fillTriangle(40, 18, 50, 6, 52, 22);
    g.fillStyle(BRAND.purpleDeep, 1);
    g.fillCircle(52, 26, 2.2); g.fillCircle(52, 32, 1.5);
    g.fillStyle(BRAND.coral, 1); g.fillTriangle(8, 30, 4, 26, 8, 38);
    g.generateTexture('dog', w, h);
    g.destroy();
  }
}
