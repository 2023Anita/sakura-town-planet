import * as THREE from 'three';
import { mulberry32 } from './noise';

export interface UVRect { u0: number; v0: number; u1: number; v1: number }

export const FONT_GOTHIC = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", "Noto Sans CJK JP", "WenQuanYi Micro Hei", "Droid Sans Fallback", sans-serif';
export const FONT_MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", "Noto Serif CJK JP", "MS Mincho", "WenQuanYi Micro Hei", serif';
export const FONT_ROUND = '"Hiragino Maru Gothic ProN", "Yu Gothic UI", "Noto Sans JP", "WenQuanYi Micro Hei", sans-serif';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function tex(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* ---------------- sign atlas ---------------- */

export interface SignStyle {
  bg?: string;
  fg?: string;
  border?: string;
  vertical?: boolean;
  font?: string;
  weight?: number;
  sub?: string;
  neon?: boolean;
  /** pixels per metre */
  ppm?: number;
  radius?: number;
}

/** One big canvas holding every sign, so all signs on the planet share two materials. */
export class SignAtlas {
  readonly W = 4096;
  readonly H = 2048;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  private x = 2;
  private y = 2;
  private rowH = 0;

  constructor() {
    [this.canvas, this.ctx] = canvas(this.W, this.H);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, 8, 8);
    this.x = 10;
    this.texture = tex(this.canvas, false);
    this.texture.anisotropy = 8;
  }

  get used() {
    return (this.y + this.rowH) / this.H;
  }

  alloc(w: number, h: number): { x: number; y: number; uv: UVRect } {
    w = Math.ceil(w);
    h = Math.ceil(h);
    if (this.x + w + 2 > this.W) {
      this.x = 2;
      this.y += this.rowH + 2;
      this.rowH = 0;
    }
    if (this.y + h > this.H) {
      console.warn('Sign atlas full');
      this.y = 2;
    }
    const x = this.x, y = this.y;
    this.x += w + 2;
    this.rowH = Math.max(this.rowH, h);
    const { W, H } = this;
    // Inset half a texel to avoid bleeding.
    return { x, y, uv: { u0: (x + 0.5) / W, u1: (x + w - 0.5) / W, v0: 1 - (y + h - 0.5) / H, v1: 1 - (y + 0.5) / H } };
  }

  /** Custom drawing into a w×h pixel region. */
  draw(w: number, h: number, fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): UVRect {
    const r = this.alloc(w, h);
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, w, h);
    ctx.clip();
    ctx.translate(r.x, r.y);
    fn(ctx, w, h);
    ctx.restore();
    this.texture.needsUpdate = true;
    return r.uv;
  }

  /** Text sign of physical size wm × hm metres. */
  sign(text: string, wm: number, hm: number, s: SignStyle = {}): UVRect {
    const ppm = s.ppm ?? 110;
    const w = Math.max(16, Math.round(wm * ppm)), h = Math.max(16, Math.round(hm * ppm));
    return this.draw(w, h, (ctx) => {
      ctx.fillStyle = s.bg ?? '#ffffff';
      ctx.fillRect(0, 0, w, h);
      if (s.border) {
        ctx.strokeStyle = s.border;
        ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.06);
        const r = s.radius ?? 0;
        roundRect(ctx, ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2, r);
        ctx.stroke();
      }
      ctx.fillStyle = s.fg ?? '#222';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const font = s.font ?? FONT_GOTHIC;
      const weight = s.weight ?? 800;
      if (s.neon) {
        ctx.shadowColor = s.fg ?? '#fff';
        ctx.shadowBlur = Math.min(w, h) * 0.12;
      }
      const chars = [...text];
      if (s.vertical) {
        const subH = s.sub ? h * 0.18 : 0;
        const cell = Math.min(w * 0.78, (h * 0.86 - subH) / chars.length);
        ctx.font = `${weight} ${cell * 0.92}px ${font}`;
        const top = (h - subH - cell * chars.length) / 2 + cell / 2;
        chars.forEach((ch, i) => ctx.fillText(ch, w / 2, top + i * cell));
        if (s.sub) {
          ctx.font = `600 ${Math.min(subH * 0.4, w * 0.16)}px ${font}`;
          ctx.fillText(s.sub, w / 2, h - subH * 0.55);
        }
      } else {
        const subH = s.sub ? h * 0.3 : 0;
        let size = Math.min((h - subH) * 0.68, (w * 0.88) / Math.max(1, measure(ctx, text, weight, font)));
        ctx.font = `${weight} ${size}px ${font}`;
        ctx.fillText(text, w / 2, (h - subH) / 2 + size * 0.04);
        if (s.sub) {
          size = Math.min(subH * 0.6, (w * 0.86) / Math.max(1, measure(ctx, s.sub, 600, font)));
          ctx.font = `600 ${size}px ${font}`;
          ctx.fillText(s.sub, w / 2, h - subH * 0.55);
        }
      }
      if (s.neon) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = s.fg ?? '#fff';
        ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.03);
        roundRect(ctx, ctx.lineWidth * 2, ctx.lineWidth * 2, w - ctx.lineWidth * 4, h - ctx.lineWidth * 4, Math.min(w, h) * 0.15);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  }
}

function measure(ctx: CanvasRenderingContext2D, text: string, weight: number, font: string) {
  ctx.font = `${weight} 100px ${font}`;
  return ctx.measureText(text).width / 100;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------- small procedural textures ---------------- */

function petalPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.bezierCurveTo(-0.9, 0.4, -0.7, -0.8, -0.18, -0.95);
  ctx.lineTo(0, -0.7);
  ctx.lineTo(0.18, -0.95);
  ctx.bezierCurveTo(0.7, -0.8, 0.9, 0.4, 0, 1);
  ctx.fill();
  ctx.restore();
}

export function petalTexture() {
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createLinearGradient(0, 60, 0, 4);
  g.addColorStop(0, '#ff9ec0');
  g.addColorStop(1, '#fff0f5');
  ctx.fillStyle = g;
  petalPath(ctx, 32, 32, 28, Math.PI);
  return tex(c, false);
}

export function petalScatterTexture(seed = 7) {
  const [c, ctx] = canvas(256, 256);
  const rnd = mulberry32(seed);
  for (let i = 0; i < 70; i++) {
    const r = Math.hypot(rnd() - 0.5, rnd() - 0.5);
    if (r > 0.5 * rnd() + 0.05) continue;
    const x = 128 + (rnd() - 0.5) * 240 * (0.3 + rnd() * 0.7);
    const y = 128 + (rnd() - 0.5) * 240 * (0.3 + rnd() * 0.7);
    ctx.fillStyle = `hsla(${340 + rnd() * 15}, ${70 + rnd() * 25}%, ${82 + rnd() * 12}%, ${0.75 + rnd() * 0.25})`;
    petalPath(ctx, x, y, 4 + rnd() * 4, rnd() * Math.PI * 2);
  }
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.8) * 118;
    ctx.fillStyle = `hsla(${340 + rnd() * 15}, 80%, ${80 + rnd() * 14}%, ${0.55 + rnd() * 0.4})`;
    petalPath(ctx, 128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 2.5 + rnd() * 3.5, rnd() * Math.PI * 2);
  }
  return tex(c, false);
}

export function radialTexture() {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return tex(c, false, false);
}

/** Vertical streak used for wet-ground reflections and light shafts. */
export function streakTexture() {
  const [c, ctx] = canvas(64, 256);
  const gx = ctx.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)');
  gx.addColorStop(0.5, 'rgba(255,255,255,1)');
  gx.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, 64, 256);
  ctx.globalCompositeOperation = 'destination-in';
  const gy = ctx.createLinearGradient(0, 0, 0, 256);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.2, 'rgba(0,0,0,0.9)');
  gy.addColorStop(0.75, 'rgba(0,0,0,0.6)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, 64, 256);
  return tex(c, false, false);
}

function noiseFill(ctx: CanvasRenderingContext2D, w: number, h: number, base: [number, number, number], amp: number, rnd: () => number, n = 4000, size = 2) {
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const k = (rnd() - 0.5) * amp;
    ctx.fillStyle = `rgba(${base[0] + k},${base[1] + k},${base[2] + k},0.6)`;
    ctx.fillRect(rnd() * w, rnd() * h, size * (0.5 + rnd()), size * (0.5 + rnd()));
  }
}

export function asphaltRoadTexture() {
  const [c, ctx] = canvas(256, 512);
  const rnd = mulberry32(3);
  noiseFill(ctx, 256, 512, [92, 92, 104], 40, rnd, 9000, 2);
  ctx.fillStyle = '#f2f0ea';
  ctx.fillRect(14, 0, 7, 512);
  ctx.fillRect(235, 0, 7, 512);
  ctx.fillStyle = '#f0f0e8';
  ctx.fillRect(124, 0, 8, 260);
  // curb bands
  ctx.fillStyle = '#b9b5ad';
  ctx.fillRect(0, 0, 10, 512);
  ctx.fillRect(246, 0, 10, 512);
  return tex(c);
}

export function tileTexture(base: string, line: string, cells = 4, seed = 5, jitter = 14) {
  const [c, ctx] = canvas(256, 256);
  const rnd = mulberry32(seed);
  ctx.fillStyle = line;
  ctx.fillRect(0, 0, 256, 256);
  const s = 256 / cells;
  const b = new THREE.Color(base);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const k = (rnd() - 0.5) * jitter / 255;
      ctx.fillStyle = `rgb(${(b.r + k) * 255},${(b.g + k) * 255},${(b.b + k) * 255})`;
      ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
    }
  }
  return tex(c);
}

/** Irregular warm stone pavers like the park in the reference still. */
export function paverTexture() {
  const [c, ctx] = canvas(512, 512);
  const rnd = mulberry32(21);
  ctx.fillStyle = '#9c938a';
  ctx.fillRect(0, 0, 512, 512);
  const rows = 6;
  const rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 60;
    while (x < 512) {
      const w = 50 + rnd() * 70;
      const l = 168 + rnd() * 30;
      ctx.fillStyle = `rgb(${l + 14},${l + 4},${l - 6})`;
      roundRect(ctx, x + 3, r * rh + 3, w - 6, rh - 6, 6);
      ctx.fill();
      for (let k = 0; k < 18; k++) {
        ctx.fillStyle = `rgba(120,110,100,${rnd() * 0.15})`;
        ctx.fillRect(x + rnd() * w, r * rh + rnd() * rh, 3, 3);
      }
      if (x + w > 512) {
        ctx.fillStyle = `rgb(${l + 14},${l + 4},${l - 6})`;
        roundRect(ctx, x + 3 - 512, r * rh + 3, w - 6, rh - 6, 6);
        ctx.fill();
      }
      x += w;
    }
  }
  return tex(c);
}

export function gravelTexture() {
  const [c, ctx] = canvas(256, 256);
  const rnd = mulberry32(9);
  noiseFill(ctx, 256, 256, [206, 198, 182], 70, rnd, 7000, 3);
  return tex(c);
}

export function dirtTexture() {
  const [c, ctx] = canvas(256, 256);
  const rnd = mulberry32(11);
  noiseFill(ctx, 256, 256, [214, 190, 150], 30, rnd, 5000, 3);
  return tex(c);
}

export function wetStoneTexture() {
  const [c, ctx] = canvas(256, 256);
  const rnd = mulberry32(13);
  ctx.fillStyle = '#25232c';
  ctx.fillRect(0, 0, 256, 256);
  const s = 64;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const l = 52 + rnd() * 20;
      ctx.fillStyle = `rgb(${l},${l - 4},${l + 6})`;
      ctx.fillRect(x * s + 3 + (y % 2) * 0, y * s + 3, s - 6, s - 6);
    }
  }
  return tex(c);
}

/** Planet-wide grass detail (tiling, tinted by vertex colours). */
export function grassTexture() {
  const [c, ctx] = canvas(256, 256);
  const rnd = mulberry32(17);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const l = 200 + rnd() * 55;
    ctx.fillStyle = `rgb(${l},${l},${l})`;
    const x = rnd() * 256, y = rnd() * 256;
    ctx.fillRect(x, y, 1.5, 3 + rnd() * 4);
  }
  return tex(c);
}

export function toonGradient() {
  const data = new Uint8Array([105, 105, 105, 255, 165, 165, 165, 255, 220, 220, 220, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
