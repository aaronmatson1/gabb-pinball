import Phaser from 'phaser';
import { BRAND } from '../brand';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.makeBallTexture();
    this.makeBumperTextures();
    this.makeFlipperTexture();
    this.makeDogTexture();
    this.makeStarTexture();
  }

  create() {
    this.scene.start('Game');
    this.scene.launch('HUD');
  }

  private makeBallTexture() {
    const g = this.add.graphics();
    const r = 12;
    g.fillStyle(BRAND.cream, 1);
    g.fillCircle(r, r, r);
    g.fillStyle(BRAND.white, 1);
    g.fillCircle(r - 4, r - 4, 4);
    g.lineStyle(2, BRAND.purpleDeep, 0.5);
    g.strokeCircle(r, r, r);
    g.generateTexture('ball', r * 2, r * 2);
    g.destroy();
  }

  private makeBumperTextures() {
    const colors: Array<{ name: string; color: number }> = [
      { name: 'bumper_coral', color: BRAND.coral },
      { name: 'bumper_teal', color: BRAND.teal },
      { name: 'bumper_pink', color: BRAND.pink },
      { name: 'bumper_yellow', color: BRAND.yellow },
    ];
    colors.forEach(({ name, color }) => {
      const g = this.add.graphics();
      const r = 28;
      g.fillStyle(BRAND.purpleDeep, 1);
      g.fillCircle(r, r, r);
      g.fillStyle(color, 1);
      g.fillCircle(r, r, r - 4);
      g.fillStyle(BRAND.white, 0.45);
      g.fillCircle(r - 6, r - 6, 6);
      g.lineStyle(3, BRAND.cream, 1);
      g.strokeCircle(r, r, r - 4);
      g.generateTexture(name, r * 2, r * 2);
      g.destroy();
    });
  }

  private makeFlipperTexture() {
    const g = this.add.graphics();
    const w = 90, h = 22;
    g.fillStyle(BRAND.yellow, 1);
    g.fillRoundedRect(0, 0, w, h, 11);
    g.lineStyle(3, BRAND.coral, 1);
    g.strokeRoundedRect(0, 0, w, h, 11);
    g.fillStyle(BRAND.purpleDeep, 1);
    g.fillCircle(h / 2, h / 2, 5);
    g.generateTexture('flipper', w, h);
    g.destroy();
  }

  private makeDogTexture() {
    // simple stylized Gabb dog silhouette
    const g = this.add.graphics();
    const w = 64, h = 64;
    g.fillStyle(BRAND.cream, 1);
    g.fillRoundedRect(8, 22, 48, 32, 10); // body
    g.fillCircle(48, 28, 14);               // head
    g.fillTriangle(40, 18, 50, 6, 52, 22); // ear
    g.fillStyle(BRAND.purpleDeep, 1);
    g.fillCircle(52, 26, 2.2);              // eye
    g.fillCircle(52, 32, 1.5);              // nose
    g.fillStyle(BRAND.coral, 1);
    g.fillTriangle(8, 30, 4, 26, 8, 38);   // tail
    g.generateTexture('dog', w, h);
    g.destroy();
  }

  private makeStarTexture() {
    const g = this.add.graphics();
    const r = 14;
    g.fillStyle(BRAND.yellow, 1);
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      pts.push(r + Math.cos(a) * rad, r + Math.sin(a) * rad);
    }
    g.fillPoints(
      pts.reduce<{ x: number; y: number }[]>((acc, _, i, arr) => {
        if (i % 2 === 0) acc.push({ x: arr[i], y: arr[i + 1] });
        return acc;
      }, []),
      true
    );
    g.lineStyle(2, BRAND.coral, 1);
    g.strokePoints(
      pts.reduce<{ x: number; y: number }[]>((acc, _, i, arr) => {
        if (i % 2 === 0) acc.push({ x: arr[i], y: arr[i + 1] });
        return acc;
      }, []),
      true
    );
    g.generateTexture('star', r * 2, r * 2);
    g.destroy();
  }
}
