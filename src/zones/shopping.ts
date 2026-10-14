import * as THREE from 'three';
import type { Ctx, ShopOpts } from '../kit';
import { chochin, pole, shop, streetLamp, wire, wp } from '../kit';
import { F } from './layout';
import { FONT_ROUND } from '../textures';

type S = Omit<ShopOpts, 'd' | 'floors'> & { floors?: number };

const NORTH: S[] = [
  { w: 6.5, sign: 'ひばり書店', sub: '本・雑誌・まんが', blade: '本', bladeBg: '#2d4f84', goods: 'books', awning: '#2d4f84' },
  { w: 5.5, sign: 'ラーメン 一番', blade: 'ラーメン', bladeBg: '#c0392b', noren: '中華そば', signBg: '#ffd84a', awning: '#a33a3a' },
  { w: 5, sign: '喫茶 さくら', blade: '珈琲', bladeBg: '#6b4226', signBg: '#fff0f4', signFg: '#b03060' },
  { w: 6, sign: '八百屋 まるやま', goods: 'veg', awning: '#2f6f5e' },
  { w: 5, sign: '和菓子 春月', noren: '和菓子', signBg: '#2a2a2a', signFg: '#ffe9c2', blade: 'だんご', bladeBg: '#e7799d' },
  { w: 6, sign: 'くすりのヒバリ', blade: '薬', bladeBg: '#1e8449', signBg: '#e8f8ef', signFg: '#1e8449' },
  { w: 5.5, sign: '時計・めがね', signBg: '#f5f5f5', awning: '#6b4c8a' },
  { w: 6, sign: 'パン工房 こむぎ', blade: 'パン', bladeBg: '#c27a2a', signBg: '#fff6e5' },
  { w: 5.5, sign: '金物 たなか', signBg: '#ffffff' },
  { w: 6, sign: '銭湯 ひばり湯', noren: 'ゆ', blade: 'ゆ', bladeBg: '#2d6fb0', signBg: '#e8f1fb', signFg: '#1d4f86' },
];
const SOUTH: S[] = [
  { w: 6, sign: '肉のたなか', sub: 'コロッケ 一個 80円', blade: 'コロッケ', bladeBg: '#d35400', signBg: '#fff2d6' },
  { w: 5.5, sign: '花屋 はなことば', signBg: '#fbe9f0', signFg: '#b8326a', awning: '#e7799d' },
  { w: 5, sign: '文房具 えんぴつ堂', signBg: '#fffbe6' },
  { w: 6.5, sign: 'お好み焼 ふじ', blade: 'お好み焼', bladeBg: '#8e44ad', noren: 'お好み焼', signBg: '#fde68a' },
  { w: 5, sign: 'クリーニング', signBg: '#e3f2fd', signFg: '#1565c0' },
  { w: 6, sign: '鮮魚 うみのや', blade: '魚', bladeBg: '#1f6f8b', signBg: '#e0f4f7' },
  { w: 5.5, sign: 'おもちゃ ゆめや', signBg: '#fff3e0', signFg: '#d84315', awning: '#e74c3c' },
  { w: 6, sign: '理容 カット', blade: 'BARBER', bladeBg: '#2c3e50', signBg: '#ffffff' },
  { w: 5.5, sign: 'たい焼き', blade: 'たい焼', bladeBg: '#b9770e', signBg: '#fdebd0' },
  { w: 6, sign: 'ひばり郵便局', signBg: '#e74c3c', signFg: '#ffffff', awning: '#c0392b' },
];

/** Zone 2 — dusk shopping street with bookstore / ramen signs, poles, chochin and petals. */
export function buildShopping(c: Ctx) {
  const f = F.shopping;
  const { b, atlas } = c;
  const depth = 7;
  const setback = 5.6;

  for (const [list, side] of [[NORTH, 1], [SOUTH, -1]] as const) {
    let z = -30;
    for (const s of list) {
      const zc = z + s.w / 2;
      const M = f.matrix(side * (setback + depth / 2), zc, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      shop(c, M, { ...s, d: depth, floors: s.floors ?? 2 + (c.rnd() < 0.4 ? 1 : 0), neon: true });
      z += s.w + 0.15;
    }
  }

  // Arches at both ends
  const archUv = atlas.sign('ひばりが丘商店街', 7.5, 1.1, { bg: '#7a1f2b', fg: '#ffe7b0', font: FONT_ROUND, neon: true, sub: 'HIBARIGAOKA SHOTENGAI' });
  for (const z of [-32, 32]) {
    const M = f.matrix(0, z, z > 0 ? Math.PI : 0);
    for (const sx of [-1, 1]) {
      b.cyl(M, sx * 5, 3.3, 0, 0.18, 0.2, 6.6, '#6b6f78', { seg: 10 });
      c.phys.circle(M, sx * 5, 0, 0.25, 6);
    }
    b.box(M, 0, 6.4, 0, 10.6, 1.4, 0.35, '#3a3340');
    b.quad(M, 0, 6.4, 0.18, 7.5, 1.1, archUv, { key: 'neon', glow: 1.5 });
    b.quad(M, 0, 6.4, -0.18, 7.5, 1.1, archUv, { key: 'neon', glow: 1.5, ry: Math.PI });
    for (let i = 0; i < 6; i++) {
      const x = -4.2 + i * 1.68;
      b.sphere(M, x, 7.35, 0, 0.42, 0.42, 0.42, i % 2 ? '#ff9fc0' : '#ffffff', { key: 'glow', glow: 1.3 });
    }
    c.glows.add(wp(M, 0, 6.4, 0.5), '#ff9a5a', 6);
    c.lights.add(wp(M, 0, 5.4, 1.5), '#ffb070', 8, 12);
  }

  // Chochin strings across the street
  const kanji = ['祭', '春', '桜', '福'].map((t) => atlas.sign(t, 0.22, 0.4, { bg: '#ff5a3c', fg: '#1d1b1f', vertical: true }));
  for (let z = -26; z <= 26; z += 8.5) {
    const a = f.point(-setback, z, 5.6), e = f.point(setback, z + 1.5, 5.6);
    const pts = wire(c, a, e, 0.6, '#3a2f2a', 0.015);
    for (let i = 1; i < 8; i += 1.5) {
      const p = pts[Math.round(i)];
      const M = new THREE.Matrix4().copy(f.matrix(0, z)).setPosition(p);
      chochin(c, M, 0, -0.45, 0, { s: 0.8, color: i % 3 < 1.5 ? '#ff5a3c' : '#ffe0a8', light: true, text: kanji[Math.round(i) % 4] });
    }
    // warm pools of light on the asphalt
    b.quad(f.matrix(0, z + 0.7), 0, 0.08, 0, 7, 5, null, { key: 'add', rx: -Math.PI / 2, color: '#ff9a4a', glow: 0.35 });
    c.lights.add(f.point(0, z + 0.7, 4.6), '#ffa560', 6, 10);
  }

  // Utility poles both sides, wires along the street
  for (const side of [-1, 1]) {
    let prev: THREE.Vector3[] | null = null;
    for (let z = -28; z <= 28; z += 14) {
      const p = pole(c, f.matrix(side * 5.1, z + side * 3));
      if (prev) for (let k = 0; k < 3; k++) wire(c, prev[k], p[k], 0.5);
      prev = p;
    }
  }
  for (const z of [-20, 0, 20]) streetLamp(c, f.matrix(-5.1, z + 6), 0, 0, Math.PI / 2, '#ffe0b8');

  // Sakura bookends
  for (const [x, z] of [[-8, -40], [8, -41], [-8, 40], [9, 41], [12, -36], [-12, 37]]) c.trees.add('sakura', f.matrix(x, z), 1.1);
}
