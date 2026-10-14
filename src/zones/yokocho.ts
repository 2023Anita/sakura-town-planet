import * as THREE from 'three';
import type { Ctx } from '../kit';
import { chochin, patch, shop, vending, wire, wp } from '../kit';
import { F } from './layout';
import { FONT_ROUND } from '../textures';

const BARS = [
  { sign: 'スナック 夢', blade: 'スナック', col: '#ff4fa3' },
  { sign: '居酒屋 とり吉', blade: '焼鳥', col: '#ff6a2b' },
  { sign: 'BAR 月あかり', blade: 'BAR', col: '#5ad1ff' },
  { sign: 'おでん 小春', blade: 'おでん', col: '#ffd34a' },
  { sign: '立ち飲み 角', blade: '酒', col: '#ff3b3b' },
  { sign: '餃子の王将軒', blade: '餃子', col: '#ffef5a' },
  { sign: 'カラオケ 星', blade: 'カラオケ', col: '#b46bff' },
  { sign: '純喫茶 夜船', blade: '喫茶', col: '#6bffcf' },
  { sign: '串カツ だるま', blade: '串カツ', col: '#ff7a3b' },
  { sign: 'もつ焼 ひばり', blade: 'もつ', col: '#ff4a6a' },
  { sign: 'ラーメン 夜鳴', blade: 'ラーメン', col: '#ffb02e' },
  { sign: 'スナック 蘭', blade: 'スナック', col: '#ff5ad1' },
];

/** Zone 3 — night yokocho: wet stone, lanterns, neon snack signs and their reflections. */
export function buildYokocho(c: Ctx) {
  const f = F.yokocho;
  const { b, atlas, rnd } = c;
  const half = 1.9;
  const depth = 5;

  patch(b, 'wet', f, -half - 0.2, half + 0.2, -16, 16, 0.05, 2, 1);
  patch(b, 'wet', f, -3.2, 3.2, -16.4, -14.6, 0.055, 2, 1);

  let i = 0;
  for (const side of [-1, 1]) {
    let z = -14.5;
    while (z < 14) {
      const w = 3.6 + rnd() * 1.1;
      const bar = BARS[i++ % BARS.length];
      const M = f.matrix(side * (half + depth / 2), z + w / 2, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      shop(c, M, {
        w, d: depth, floors: 2, sign: bar.sign, neon: true,
        signBg: '#120c18', signFg: bar.col, blade: bar.blade, bladeBg: '#120c18', bladeFg: bar.col,
        noren: rnd() < 0.6 ? bar.blade : undefined, awning: '#2a1f2a', wall: ['#5a4a46', '#4b4352', '#6a5548', '#3f4048'][i % 4],
      });
      // a pair of red lanterns at each door
      const lz = depth / 2 + 0.35;
      chochin(c, M, -w / 2 + 0.6, 2.25, lz, { s: 0.75, light: true });
      chochin(c, M, w / 2 - 0.6, 2.25, lz, { s: 0.75, light: true, color: i % 3 ? '#ff5a3c' : '#ffe0a8' });
      // neon reflections smeared on the wet stone
      const col = new THREE.Color(bar.col);
      const Mr = f.matrix(side * (half - 0.7), z + w / 2);
      b.quad(Mr, 0, 0.09, 0, 0.7, 3.2, null, { key: 'streak', rx: -Math.PI / 2, color: col, glow: 0.55 });
      b.quad(Mr, -side * 0.6, 0.085, 0.4, 0.5, 2.0, null, { key: 'streak', rx: -Math.PI / 2, color: '#ff6a3c', glow: 0.4 });
      c.lights.add(wp(M, 0, 2.6, depth / 2 + 1.2), bar.col, 5, 7);
      z += w + 0.1;
    }
  }

  // Entrance arch
  {
    const M = f.matrix(0, -15.5);
    const uv = atlas.sign('ひばり横丁', 3.4, 0.9, { bg: '#1a0f14', fg: '#ff5a5a', font: FONT_ROUND, neon: true, sub: 'HIBARI YOKOCHO' });
    for (const sx of [-1, 1]) b.block(M, sx * 2.1, 0, 0, 0.18, 5.2, 0.18, '#2b2b30');
    b.box(M, 0, 4.6, 0, 4.2, 1.1, 0.25, '#1a0f14');
    b.quad(M, 0, 4.6, -0.14, 3.4, 0.9, uv, { key: 'neon', glow: 2.0, ry: Math.PI });
    b.quad(M, 0, 4.6, 0.14, 3.4, 0.9, uv, { key: 'neon', glow: 2.0 });
    c.glows.add(wp(M, 0, 4.6, -0.6), '#ff4a4a', 6, 1);
    c.lights.add(wp(M, 0, 3.8, -1.5), '#ff5a5a', 8, 10);
    for (let k = 0; k < 4; k++) chochin(c, M, -1.5 + k, 3.75, -0.2, { s: 0.6, light: true });
    vending(c, f.matrix(-3.0, -15.9), 0, 0, Math.PI, '#2e6fd1');
    vending(c, f.matrix(-4.1, -15.9), 0, 0, Math.PI, '#d23a3a');
  }

  // Zig-zag string lights overhead
  for (let z = -13; z < 14; z += 2.6) {
    const a = f.point(-half - 0.1, z, 4.3), e = f.point(half + 0.1, z + 1.3, 4.3);
    const pts = wire(c, a, e, 0.35, '#1a1a1a', 0.012);
    for (let k = 1; k < pts.length - 1; k += 2) {
      const M = new THREE.Matrix4().copy(f.matrix(0, z)).setPosition(pts[k]);
      b.sphere(M, 0, -0.08, 0, 0.12, 0.12, 0.12, '#ffd28a', { key: 'glow', glow: 2.2 });
      c.glows.add(pts[k].clone(), '#ffc070', 0.7, 1);
    }
  }

  // Puddles (dark glossy ellipses) + crates, bins and a bicycle
  for (let k = 0; k < 9; k++) {
    const M = f.matrix((rnd() - 0.5) * 2.4, -13 + k * 3.3 + rnd());
    b.quad(M, 0, 0.065, 0, 0.8 + rnd(), 0.5 + rnd() * 0.8, null, { key: 'streak', rx: -Math.PI / 2, ry: rnd() * 3, color: '#3a5a9a', glow: 0.35 });
  }
  for (let k = 0; k < 6; k++) {
    const side = k % 2 ? 1 : -1;
    const M = f.matrix(side * (half - 0.35), -11 + k * 4.4);
    b.block(M, 0, 0, 0, 0.5, 0.35, 0.4, '#d9c35a');
    b.block(M, 0, 0.35, 0, 0.5, 0.35, 0.4, '#3e7bc4');
    c.phys.box(M, 0, 0, 0.25, 0.2, 0.8);
  }
}
