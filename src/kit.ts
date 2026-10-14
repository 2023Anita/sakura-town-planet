import * as THREE from 'three';
import type { Builder, ColorLike } from './builder';
import type { Physics } from './physics';
import type { Trees } from './trees';
import type { GlowPoints, LightPool } from './glow';
import type { SignAtlas, UVRect } from './textures';
import { Frame, R, dayFactor, terrainHeight } from './planet';

export interface Ctx {
  b: Builder;
  phys: Physics;
  trees: Trees;
  glows: GlowPoints;
  lights: LightPool;
  atlas: SignAtlas;
  rnd: () => number;
}

const _v = new THREE.Vector3();
export const wp = (M: THREE.Matrix4, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(M);

export function isNight(M: THREE.Matrix4) {
  _v.setFromMatrixPosition(M).normalize();
  return dayFactor(_v) < 0.12;
}

export const WALLS = ['#f3ead9', '#e9dcc6', '#d9d4cc', '#f1e3d3', '#cfd8dc', '#e8d2c0', '#ddd0b8', '#c9b9a6'];
export const ROOFS = ['#4a5568', '#3f4a5c', '#5a4a44', '#6b4f43', '#425a63', '#56606e'];

/** Flat ground patch that hugs the sphere (and terrain). UVs in metres / uvScale. */
export function patch(b: Builder, key: string, f: Frame, x0: number, x1: number, z0: number, z1: number, y = 0.04, uvScale = 4, step = 1) {
  const nx = Math.max(1, Math.ceil((x1 - x0) / step)), nz = Math.max(1, Math.ceil((z1 - z0) / step));
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const d = new THREE.Vector3();
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx, z = z0 + ((z1 - z0) * j) / nz;
      f.dirAt(x, z, d);
      const r = R + terrainHeight(d) + y;
      pos.push(d.x * r, d.y * r, d.z * r);
      nor.push(d.x, d.y, d.z);
      uv.push(x / uvScale, z / uvScale);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, bb = a + 1, c = a + nx + 1, dd = c + 1;
      idx.push(a, c, bb, bb, c, dd);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  b.raw(key, g);
}

/** Circular ground disc that hugs the terrain. */
export function disc(b: Builder, key: string, f: Frame, r0: number, r1: number, y = 0.05, uvScale = 4, seg = 64, rings = 10, color: ColorLike = 0xffffff) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const d = new THREE.Vector3();
  for (let j = 0; j <= rings; j++) {
    const rr = r0 + ((r1 - r0) * j) / rings;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      f.dirAt(x, z, d);
      const r = R + terrainHeight(d) + y;
      pos.push(d.x * r, d.y * r, d.z * r);
      nor.push(d.x, d.y, d.z);
      uv.push(x / uvScale, z / uvScale);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, bb = a + 1, c = a + seg + 1, dd = c + 1;
      idx.push(a, bb, c, bb, dd, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  b.raw(key, g, color);
}

function windowAt(c: Ctx, M: THREE.Matrix4, x: number, y: number, z: number, w: number, h: number, ry: number, lit: boolean) {
  const { b } = c;
  const ox = Math.sin(ry), oz = Math.cos(ry);
  b.box(M, x, y, z, w + 0.16, h + 0.16, 0.08, '#eeeae4', { ry });
  if (lit) {
    const warm = c.rnd() < 0.75;
    b.box(M, x + ox * 0.03, y, z + oz * 0.03, w, h, 0.06, warm ? '#ffcf86' : '#cfe3ff', { ry, key: 'glow', glow: warm ? 1.25 : 1.05 });
  } else {
    b.box(M, x + ox * 0.03, y, z + oz * 0.03, w, h, 0.06, c.rnd() < 0.5 ? '#5d7591' : '#6f8aa3', { ry });
    b.box(M, x + ox * 0.06, y, z + oz * 0.06, 0.05, h, 0.03, '#eeeae4', { ry });
  }
}

export interface HouseOpts {
  w: number; d: number; floors: number;
  wall?: string; roof?: string;
  gable?: boolean; balcony?: boolean;
  lit?: boolean;
}

/** Japanese two-storey house / small apartment. Front faces local +z. */
export function house(c: Ctx, M: THREE.Matrix4, o: HouseOpts) {
  const { b, rnd } = c;
  const wall = o.wall ?? WALLS[Math.floor(rnd() * WALLS.length)];
  const roof = o.roof ?? ROOFS[Math.floor(rnd() * ROOFS.length)];
  const lit = o.lit ?? isNight(M);
  const fh = 2.8;
  const H = o.floors * fh;
  b.block(M, 0, -2, 0, o.w + 0.2, 2.3, o.d + 0.2, '#a9a49c');
  b.block(M, 0, 0.3, 0, o.w, H, o.d, wall);
  for (let f = 1; f < o.floors; f++) b.block(M, 0, f * fh + 0.25, 0, o.w + 0.08, 0.14, o.d + 0.08, '#cfc7bb');
  const nWin = Math.max(1, Math.floor(o.w / 2.3));
  for (let f = 0; f < o.floors; f++) {
    const y = 0.3 + f * fh + 1.55;
    for (let i = 0; i < nWin; i++) {
      const x = -o.w / 2 + (o.w / nWin) * (i + 0.5);
      if (f === 0 && i === 0) continue;
      windowAt(c, M, x, y, o.d / 2 + 0.02, 1.2, 1.1, 0, lit && rnd() < 0.7);
    }
    if (o.d > 4) windowAt(c, M, o.w / 2 + 0.02, y, 0, 0.9, 1.0, Math.PI / 2, lit && rnd() < 0.5);
    if (o.d > 4) windowAt(c, M, -o.w / 2 - 0.02, y, -o.d / 4, 0.9, 1.0, -Math.PI / 2, lit && rnd() < 0.5);
  }
  // door + eave
  const dx = -o.w / 2 + o.w / nWin / 2;
  b.block(M, dx, 0.3, o.d / 2 + 0.03, 0.95, 2.05, 0.08, '#6b5243');
  b.box(M, dx + 0.32, 1.35, o.d / 2 + 0.09, 0.06, 0.2, 0.06, '#d8c08a');
  b.box(M, dx, 2.55, o.d / 2 + 0.4, 1.5, 0.08, 0.8, roof);
  b.block(M, dx, 0, o.d / 2 + 0.6, 1.1, 0.3, 0.9, '#bdb6aa');
  if (lit) {
    b.sphere(M, dx + 0.75, 2.2, o.d / 2 + 0.12, 0.16, 0.16, 0.16, '#ffd9a0', { key: 'glow', glow: 2 });
    c.glows.add(wp(M, dx + 0.75, 2.2, o.d / 2 + 0.2), '#ffcf8a', 0.9);
  }
  if (o.balcony && o.floors > 1) {
    const by = 0.3 + fh + 0.15;
    b.box(M, 0.4, by, o.d / 2 + 0.55, o.w * 0.6, 0.12, 1.1, '#cfc8bd');
    b.box(M, 0.4, by + 0.55, o.d / 2 + 1.08, o.w * 0.6, 0.9, 0.05, '#e8e4dc');
    b.box(M, 0.4, by + 1.02, o.d / 2 + 1.08, o.w * 0.6 + 0.04, 0.06, 0.1, '#9aa1a6');
    if (rnd() < 0.6) b.box(M, 0.4 + o.w * 0.2, by + 1.4, o.d / 2 + 0.8, 0.03, 0.03, 1.4, '#888', { ry: Math.PI / 2 });
  }
  // AC unit
  b.block(M, o.w / 2 + 0.3, 0.3, o.d / 4, 0.55, 0.55, 0.8, '#e6e6e2');
  b.cyl(M, o.w / 2 + 0.58, 0.58, o.d / 4, 0.22, 0.22, 0.02, '#777', { rz: Math.PI / 2, seg: 10 });
  // roof
  const top = 0.3 + H;
  if (o.gable ?? true) {
    b.block(M, 0, top, 0, o.w + 0.5, 0.15, o.d + 0.7, roof);
    b.prism(M, 0, top + 0.12, 0, o.w + 0.6, Math.min(2.2, o.w * 0.32), o.d + 0.8, roof, { ry: Math.PI / 2 });
  } else {
    b.block(M, 0, top, 0, o.w + 0.1, 0.4, o.d + 0.1, '#cbc4b8');
    b.block(M, o.w / 4, top + 0.4, -o.d / 4, 1.2, 1.4, 0.9, '#ddd');
  }
  c.phys.box(M, 0, 0, o.w / 2 + 0.35, o.d / 2 + 0.1, H + 2);
}

export interface ShopOpts {
  w: number; d: number; floors: number;
  sign: string; sub?: string;
  signBg?: string; signFg?: string;
  awning?: string;
  blade?: string; bladeBg?: string; bladeFg?: string;
  wall?: string;
  neon?: boolean;
  noren?: string;
  goods?: 'books' | 'veg' | 'none';
}

/** Shopping-street shop with awning, sign board and apartment above. Front faces +z. */
export function shop(c: Ctx, M: THREE.Matrix4, o: ShopOpts) {
  const { b, atlas, rnd } = c;
  const lit = isNight(M) || o.neon === true;
  const wall = o.wall ?? WALLS[Math.floor(rnd() * WALLS.length)];
  const fh = 2.9;
  const H = o.floors * fh + 0.4;
  b.block(M, 0, -2, 0, o.w, 2.1, o.d, '#9b968e');
  b.block(M, 0, 0, 0, o.w, H, o.d, wall);
  // storefront recess
  const sw = o.w - 0.6;
  b.block(M, 0, 0.1, o.d / 2 - 0.05, sw, 2.5, 0.2, lit ? '#ffe2b0' : '#9fb4c4', { key: lit ? 'glow' : 'toon', glow: lit ? 1.1 : 1 });
  for (let i = 0; i <= 3; i++) b.block(M, -sw / 2 + (sw * i) / 3, 0.1, o.d / 2 + 0.07, 0.08, 2.5, 0.08, '#555b60');
  b.block(M, 0, 0, o.d / 2 + 0.05, sw + 0.1, 0.1, 0.25, '#555b60');
  if (lit) c.lights.add(wp(M, 0, 1.6, o.d / 2 + 1.2), '#ffcf96', 5, 8);
  // awning
  const aw = o.awning ?? ['#2f6f5e', '#a33a3a', '#2d4f84', '#c27a2a', '#6b4c8a'][Math.floor(rnd() * 5)];
  b.box(M, 0, 2.85, o.d / 2 + 0.55, o.w - 0.1, 0.08, 1.15, aw, { rx: 0.22 });
  b.box(M, 0, 2.66, o.d / 2 + 1.1, o.w - 0.1, 0.32, 0.05, aw);
  // sign board
  const uv = atlas.sign(o.sign, o.w - 0.8, 0.85, { bg: o.signBg ?? '#fffaf0', fg: o.signFg ?? '#2a2a2a', sub: o.sub, neon: lit && !!o.neon });
  b.box(M, 0, 3.55, o.d / 2 + 0.06, o.w - 0.7, 0.95, 0.1, '#3a3340');
  b.quad(M, 0, 3.55, o.d / 2 + 0.12, o.w - 0.8, 0.85, uv, { key: lit ? 'neon' : 'signs', glow: lit ? 1.2 : 1 });
  if (o.blade) {
    const bu = atlas.sign(o.blade, 0.5, 2.0, { vertical: true, bg: o.bladeBg ?? '#c0392b', fg: o.bladeFg ?? '#fff', neon: lit });
    b.board(M, o.w / 2 - 0.35, 4.6, o.d / 2 + 0.45, 0.5, 2.0, bu, { ry: Math.PI / 2, key: lit ? 'neon' : 'signs', glow: lit ? 1.6 : 1 });
    if (lit) c.glows.add(wp(M, o.w / 2 - 0.35, 4.6, o.d / 2 + 0.45), o.bladeBg ?? '#ff6a6a', 3.0);
  }
  if (o.noren) {
    const nu = atlas.sign(o.noren, 1.6, 0.7, { bg: '#1f2a44', fg: '#ffffff', font: undefined });
    b.quad(M, 0, 2.15, o.d / 2 + 0.25, 1.6, 0.7, nu, { key: 'signs' });
  }
  if (o.goods === 'books') {
    for (let i = 0; i < 2; i++) {
      const gx = -sw / 3 + i * (sw / 1.5);
      b.block(M, gx, 0, o.d / 2 + 0.7, 1.3, 0.8, 0.6, '#7a5a3e');
      for (let k = 0; k < 8; k++) b.block(M, gx - 0.55 + k * 0.15, 0.8, o.d / 2 + 0.7, 0.12, 0.25 + rnd() * 0.1, 0.4, ['#c0392b', '#2e86de', '#f6b93b', '#38ada9', '#eee'][k % 5]);
    }
  } else if (o.goods === 'veg') {
    b.block(M, 0, 0, o.d / 2 + 0.8, sw * 0.8, 0.7, 0.8, '#8a6a48');
    for (let k = 0; k < 10; k++) b.sphere(M, -sw * 0.35 + k * sw * 0.08, 0.8, o.d / 2 + 0.8, 0.28, 0.22, 0.28, ['#e74c3c', '#f39c12', '#27ae60', '#f1c40f'][k % 4]);
  }
  // upper floors
  for (let f = 1; f < o.floors; f++) {
    const y = f * fh + 1.6;
    const n = Math.max(1, Math.floor(o.w / 2.2));
    for (let i = 0; i < n; i++) windowAt(c, M, -o.w / 2 + (o.w / n) * (i + 0.5), y, o.d / 2 + 0.02, 1.1, 1.1, 0, lit && rnd() < 0.6);
  }
  b.block(M, 0, H, 0, o.w + 0.1, 0.35, o.d + 0.1, '#bbb3a7');
  if (rnd() < 0.5) b.block(M, -o.w / 4, H + 0.35, -o.d / 4, 1.0, 1.1, 1.0, '#ddd');
  c.phys.box(M, 0, 0, o.w / 2, o.d / 2 + 0.1, H);
}

/** Concrete utility pole. Returns the world positions of its wire anchors (left, right, low). */
export function pole(c: Ctx, M: THREE.Matrix4, h = 8.5) {
  const { b } = c;
  b.cyl(M, 0, h / 2 - 0.5, 0, 0.13, 0.18, h + 1, '#9c9a94');
  b.box(M, 0, h - 0.4, 0, 1.6, 0.12, 0.12, '#6f6c66');
  b.box(M, 0, h - 1.2, 0, 1.1, 0.1, 0.1, '#6f6c66');
  b.cyl(M, 0.32, h - 2.1, 0.2, 0.22, 0.22, 0.7, '#7d8085', { seg: 8 });
  b.box(M, 0, 2.6, 0.12, 0.25, 0.35, 0.05, '#f5d142');
  for (let i = 0; i < 6; i++) b.box(M, 0, 2.2 + i * 0.35, -0.15, 0.25, 0.04, 0.04, '#666', { ry: (i % 2) * Math.PI / 2 });
  c.phys.circle(M, 0, 0, 0.22, h);
  return [wp(M, -0.7, h - 0.35, 0), wp(M, 0.7, h - 0.35, 0), wp(M, -0.45, h - 1.15, 0)];
}

/** Sagging wire between two world points. */
export function wire(c: Ctx, a: THREE.Vector3, b2: THREE.Vector3, sag = 0.5, color: ColorLike = '#2b2b30', radius = 0.018) {
  const pts: THREE.Vector3[] = [];
  const up = a.clone().add(b2).normalize();
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(a.clone().lerp(b2, t).addScaledVector(up, -sag * 4 * t * (1 - t)));
  }
  c.b.tube(pts, radius, color);
  return pts;
}

/** Red paper lantern (chochin), hung at local (x, y, z). */
export function chochin(c: Ctx, M: THREE.Matrix4, x: number, y: number, z: number, opts: { s?: number; color?: string; light?: boolean; text?: UVRect } = {}) {
  const s = opts.s ?? 1;
  const col = opts.color ?? '#ff5a3c';
  const lit = isNight(M) || !!opts.light;
  const { b } = c;
  b.cyl(M, x, y + 0.3 * s, z, 0.13 * s, 0.13 * s, 0.07 * s, '#1d1b1f', { seg: 10 });
  b.cyl(M, x, y - 0.3 * s, z, 0.13 * s, 0.13 * s, 0.07 * s, '#1d1b1f', { seg: 10 });
  b.sphere(M, x, y, z, 0.42 * s, 0.6 * s, 0.42 * s, col, { key: lit ? 'glow' : 'toon', glow: lit ? 1.7 : 1 });
  if (opts.text) b.quad(M, x, y, z + 0.215 * s, 0.22 * s, 0.4 * s, opts.text, { key: lit ? 'neon' : 'signs', glow: lit ? 1.2 : 1 });
  if (lit) c.glows.add(wp(M, x, y, z), col, 1.6 * s, 1);
}

/** Stone lantern (tōrō). */
export function toro(c: Ctx, M: THREE.Matrix4, x: number, z: number, s = 1) {
  const { b } = c;
  const st = '#a8a39a';
  b.block(M, x, 0, z, 0.8 * s, 0.25 * s, 0.8 * s, st);
  b.cyl(M, x, 0.85 * s, z, 0.14 * s, 0.18 * s, 1.2 * s, st);
  b.block(M, x, 1.45 * s, z, 0.7 * s, 0.15 * s, 0.7 * s, st);
  b.block(M, x, 1.6 * s, z, 0.5 * s, 0.5 * s, 0.5 * s, '#ffe3a1', { key: 'glow', glow: 1.9 });
  for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.block(M, x + ox * 0.22 * s, 1.6 * s, z + oz * 0.22 * s, 0.08 * s, 0.5 * s, 0.08 * s, st);
  b.cyl(M, x, 2.25 * s, z, 0.05 * s, 0.62 * s, 0.32 * s, st, { seg: 6 });
  b.sphere(M, x, 2.47 * s, z, 0.16 * s, 0.2 * s, 0.16 * s, st);
  c.glows.add(wp(M, x, 1.85 * s, z), '#ffc46b', 2.0 * s, 1);
  c.phys.circle(M, x, z, 0.45 * s, 2.5);
}

/** Vermilion torii. Spans local x, faces +z. */
export function torii(c: Ctx, M: THREE.Matrix4, z: number, w = 6, h = 6, plaque?: UVRect) {
  const { b } = c;
  const red = '#d9442b';
  for (const sx of [-1, 1]) {
    b.cyl(M, (sx * w) / 2, h / 2, z, 0.26, 0.3, h, red, { seg: 12 });
    b.cyl(M, (sx * w) / 2, 0.4, z, 0.36, 0.36, 0.8, '#222', { seg: 12 });
    c.phys.circle(M, (sx * w) / 2, z, 0.38, h);
  }
  b.box(M, 0, h - 1.1, z, w + 1.0, 0.36, 0.36, red);
  b.box(M, 0, h + 0.05, z, w + 2.2, 0.4, 0.55, red);
  b.box(M, 0, h + 0.35, z, w + 2.6, 0.26, 0.7, '#1e1c1f');
  b.box(M, 0, h + 0.48, z, w + 2.7, 0.08, 0.72, '#1e1c1f', { rz: 0 });
  b.box(M, 0, h - 0.5, z, 0.3, 0.9, 0.3, red);
  if (plaque) {
    b.box(M, 0, h - 0.5, z + 0.16, 0.9, 1.15, 0.08, '#1e1c1f');
    b.quad(M, 0, h - 0.5, z + 0.21, 0.78, 1.0, plaque, { key: 'signs' });
  }
}

/** Shimenawa rope with shide paper between two local x positions. */
export function shimenawa(c: Ctx, M: THREE.Matrix4, x0: number, x1: number, y: number, z: number) {
  const a = wp(M, x0, y, z), e = wp(M, x1, y, z);
  wire(c, a, e, 0.35, '#d9c38a', 0.09);
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const x = x0 + (x1 - x0) * t;
    const yy = y - 0.35 * 4 * t * (1 - t);
    c.b.box(M, x, yy - 0.35, z, 0.16, 0.45, 0.02, '#ffffff', { rz: 0.05 });
  }
}

/** Komainu guardian lion-dog on a pedestal. */
export function komainu(c: Ctx, M: THREE.Matrix4, x: number, z: number, ry: number, mouthOpen: boolean) {
  const m = M.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0, z)).multiply(new THREE.Matrix4().makeRotationY(ry));
  const { b } = c;
  const st = '#9f9a90', dk = '#7f7a72';
  b.block(m, 0, 0, 0, 1.3, 0.9, 1.6, '#8c877e');
  b.block(m, 0, 0.9, 0, 1.15, 0.2, 1.45, st);
  b.sphere(m, 0, 1.55, -0.2, 0.8, 0.95, 1.0, st);
  b.box(m, -0.28, 1.35, 0.35, 0.2, 0.7, 0.25, st);
  b.box(m, 0.28, 1.35, 0.35, 0.2, 0.7, 0.25, st);
  b.sphere(m, 0, 2.25, 0.25, 0.85, 0.8, 0.8, dk);
  b.sphere(m, 0, 2.25, 0.45, 0.6, 0.6, 0.6, st);
  b.box(m, 0, mouthOpen ? 2.08 : 2.12, 0.72, 0.36, mouthOpen ? 0.16 : 0.06, 0.06, '#5a4a44');
  b.sphere(m, -0.15, 2.38, 0.72, 0.1, 0.1, 0.06, '#3b3633');
  b.sphere(m, 0.15, 2.38, 0.72, 0.1, 0.1, 0.06, '#3b3633');
  b.sphere(m, 0, 1.9, -0.75, 0.4, 0.55, 0.35, dk);
  c.phys.box(m, 0, 0, 0.7, 0.85, 2.6);
}

export function vending(c: Ctx, M: THREE.Matrix4, x: number, z: number, ry: number, color = '#d23a3a') {
  const m = M.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0, z)).multiply(new THREE.Matrix4().makeRotationY(ry));
  const { b } = c;
  b.block(m, 0, 0, 0, 1.0, 1.85, 0.8, color);
  b.block(m, 0, 0.95, 0.41, 0.84, 0.75, 0.02, '#eaf4ff', { key: 'glow', glow: 1.6 });
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) b.block(m, -0.33 + k * 0.13, 1.0 + r * 0.24, 0.43, 0.07, 0.15, 0.03, ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#ecf0f1', '#9b59b6'][(k + r) % 6]);
  b.block(m, 0, 0.25, 0.41, 0.6, 0.2, 0.05, '#222');
  b.block(m, 0.33, 0.62, 0.41, 0.12, 0.2, 0.04, '#bbb');
  c.glows.add(wp(m, 0, 1.3, 0.6), '#cfe6ff', 2.2);
  c.lights.add(wp(m, 0, 1.2, 0.9), '#d6ecff', 3.5, 6);
  c.phys.box(m, 0, 0, 0.5, 0.4, 1.9);
}

export function bench(c: Ctx, M: THREE.Matrix4, x: number, z: number, ry: number, len = 1.8) {
  const m = M.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0, z)).multiply(new THREE.Matrix4().makeRotationY(ry));
  const { b } = c;
  for (let i = 0; i < 3; i++) b.box(m, 0, 0.45, -0.18 + i * 0.18, len, 0.05, 0.14, '#9a6a45');
  for (let i = 0; i < 2; i++) b.box(m, 0, 0.7 + i * 0.2, -0.32, len, 0.12, 0.04, '#9a6a45');
  for (const sx of [-1, 1]) {
    b.box(m, sx * (len / 2 - 0.15), 0.22, 0, 0.06, 0.45, 0.5, '#3c5a46');
    b.box(m, sx * (len / 2 - 0.15), 0.7, -0.33, 0.06, 0.55, 0.05, '#3c5a46');
  }
  c.phys.box(m, 0, 0, len / 2, 0.3, 1);
}

/** Octagonal wooden bench wrapped around a tree (homage to the reference still). */
export function treeBench(c: Ctx, M: THREE.Matrix4, r = 2.4) {
  const { b } = c;
  const n = 8;
  const side = 2 * r * Math.tan(Math.PI / n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = M.clone().multiply(new THREE.Matrix4().makeRotationY(a));
    for (let k = 0; k < 4; k++) {
      const rr = r - 0.15 + k * 0.16;
      b.box(m, 0, 0.48, rr, 2 * rr * Math.tan(Math.PI / n) - 0.04, 0.05, 0.12, '#8d5b3a');
    }
    for (let k = 0; k < 3; k++) b.box(m, 0, 0.75 + k * 0.17, r - 0.3, side * 0.84, 0.1, 0.04, '#8d5b3a');
    b.box(m, 0, 0.2, r + 0.4, side * 0.86, 0.06, 0.06, '#33473a');
    for (const sx of [-1, 1]) {
      b.box(m, sx * side * 0.42, 0.23, r + 0.35, 0.07, 0.48, 0.07, '#33473a');
      b.box(m, sx * side * 0.42, 0.6, r - 0.3, 0.07, 1.2, 0.07, '#33473a');
    }
  }
  // planter curb
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const m = M.clone().multiply(new THREE.Matrix4().makeRotationY(a));
    b.block(m, 0, 0, r - 0.6, 2 * (r - 0.6) * Math.tan(Math.PI / 16) + 0.02, 0.3, 0.3, '#d7d2c8');
  }
  for (let i = 0; i < 26; i++) {
    const a = c.rnd() * Math.PI * 2, rr = 0.6 + c.rnd() * (r - 1.4);
    b.box(M, Math.cos(a) * rr, 0.15, Math.sin(a) * rr, 0.05, 0.35, 0.05, '#6aa84f', { rz: (c.rnd() - 0.5) * 0.6, ry: c.rnd() * 3 });
  }
  c.phys.circle(M, 0, 0, r + 0.45, 1.0);
}

/** Yellow school hat + red randoseru (交通安全 cover) resting on a bench. */
export function schoolItems(c: Ctx, M: THREE.Matrix4, uvCover: UVRect) {
  const { b } = c;
  b.sphere(M, -0.5, 0.56, 0, 0.42, 0.34, 0.42, '#ffd21f');
  b.cyl(M, -0.5, 0.53, 0, 0.36, 0.36, 0.02, '#ffd21f', { seg: 16 });
  b.cyl(M, -0.5, 0.6, 0, 0.215, 0.215, 0.05, '#2b2b2b', { seg: 16 });
  b.block(M, 0.45, 0.5, 0, 0.42, 0.5, 0.3, '#c8202b');
  b.box(M, 0.45, 0.95, 0.02, 0.44, 0.1, 0.33, '#b01b25', { rx: 0.2 });
  b.quad(M, 0.45, 0.76, 0.157, 0.34, 0.3, uvCover, { key: 'signs' });
}

export function streetLamp(c: Ctx, M: THREE.Matrix4, x: number, z: number, ry = 0, color = '#fff0d0') {
  const m = M.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0, z)).multiply(new THREE.Matrix4().makeRotationY(ry));
  const { b } = c;
  b.cyl(m, 0, 2.5, 0, 0.06, 0.09, 5, '#6c727a');
  b.box(m, 0, 4.95, 0.45, 0.08, 0.08, 0.9, '#6c727a');
  b.box(m, 0, 4.85, 0.9, 0.3, 0.12, 0.5, '#e8ecef');
  const night = isNight(M);
  if (night) {
    b.box(m, 0, 4.78, 0.9, 0.24, 0.04, 0.42, color, { key: 'glow', glow: 2 });
    c.glows.add(wp(m, 0, 4.7, 0.9), color, 2.2);
    c.lights.add(wp(m, 0, 4.4, 0.9), color, 7, 11);
  }
  c.phys.circle(m, 0, 0, 0.12, 5);
}

export function railing(c: Ctx, M: THREE.Matrix4, pts: [number, number][], color = '#55606a') {
  const { b } = c;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ry = Math.atan2(x1 - x0, z1 - z0);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    b.box(M, mx, 1.0, mz, 0.06, 0.06, len, color, { ry });
    b.box(M, mx, 0.55, mz, 0.04, 0.04, len, color, { ry });
    b.box(M, x0, 0.5, z0, 0.07, 1.0, 0.07, color);
    const m = M.clone().multiply(new THREE.Matrix4().makeTranslation(mx, 0, mz)).multiply(new THREE.Matrix4().makeRotationY(ry));
    c.phys.box(m, 0, 0, 0.1, len / 2, 1.2);
  }
}

/** Simple bicycle (for the park & station). */
export function bicycle(c: Ctx, M: THREE.Matrix4, x: number, z: number, ry: number, color = '#c0392b') {
  const m = M.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0, z)).multiply(new THREE.Matrix4().makeRotationY(ry));
  const { b } = c;
  for (const sz of [-0.55, 0.55]) {
    b.cyl(m, 0, 0.35, sz, 0.34, 0.34, 0.04, '#222', { rz: Math.PI / 2, seg: 14 });
    b.cyl(m, 0, 0.35, sz, 0.27, 0.27, 0.05, '#ccc', { rz: Math.PI / 2, seg: 14 });
  }
  b.box(m, 0, 0.62, 0, 0.05, 0.05, 1.0, color, { rx: 0.15 });
  b.box(m, 0, 0.5, -0.25, 0.05, 0.5, 0.05, color, { rx: -0.4 });
  b.box(m, 0, 0.9, -0.3, 0.12, 0.04, 0.25, '#222');
  b.box(m, 0, 0.98, 0.5, 0.5, 0.04, 0.04, '#888');
  b.box(m, 0, 0.82, 0.62, 0.32, 0.2, 0.22, '#9aa');
}
