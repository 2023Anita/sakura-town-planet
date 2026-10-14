import * as THREE from 'three';
import type { Ctx } from '../kit';
import { bench, chochin, disc, komainu, patch, railing, schoolItems, shimenawa, streetLamp, toro, torii, treeBench, wire, wp } from '../kit';
import { APPROACH_LEN, F, PARK_R } from './layout';
import { FONT_MINCHO, FONT_ROUND } from '../textures';

/** Zone 4 — shrine approach: torii, komainu, stone lanterns and gravel, climbing toward dawn. */
export function buildApproach(c: Ctx) {
  const f = F.approach;
  const { b, atlas, rnd } = c;
  const L = APPROACH_LEN;

  patch(b, 'gravel', f, -4.5, 4.5, -1, L + 0.5, 0.04, 3, 1);
  patch(b, 'stoneSlab', f, -1.1, 1.1, -1, L + 0.5, 0.07, 1.1, 0.55);

  const plaque = atlas.sign('ひばり神社', 0.78, 1.0, { vertical: true, bg: '#1e1c1f', fg: '#e8c66a', font: FONT_MINCHO, weight: 800 });
  const M0 = f.matrix(0, 3, Math.PI);
  torii(c, M0, 0, 5.4, 6.2, plaque);
  shimenawa(c, f.matrix(0, 3), -2.5, 2.5, 5.0, 0);
  {
    const M1 = f.matrix(0, L - 1.5, Math.PI);
    torii(c, M1, 0, 4.0, 4.6);
  }

  for (let z = 7.5; z < L - 4; z += 5.2) {
    for (const sx of [-1, 1]) toro(c, f.matrix(sx * 2.8, z), 0, 0, 0.95);
  }
  komainu(c, f.matrix(-2.7, L - 6), 0, 0, Math.PI + 0.55, true);
  komainu(c, f.matrix(2.7, L - 6), 0, 0, Math.PI - 0.55, false);

  // Nobori banners
  const nob = atlas.sign('奉納 ひばり稲荷', 0.5, 2.6, { vertical: true, bg: '#c8352b', fg: '#ffffff', font: FONT_MINCHO, weight: 800 });
  for (let k = 0; k < 6; k++) {
    const z = 9 + k * 5.2;
    const M = f.matrix(-4.0, z + 1.4, Math.PI / 2);
    b.cyl(M, 0, 1.8, 0, 0.03, 0.03, 3.6, '#ddd');
    b.quad(M, 0.27, 2.0, 0, 0.5, 2.6, nob, { key: 'signs' });
    b.quad(M, 0.27, 2.0, -0.01, 0.5, 2.6, nob, { key: 'signs', ry: Math.PI });
  }

  // Chozuya (purification basin)
  {
    const M = f.matrix(3.4, L - 11, -Math.PI / 2);
    b.block(M, 0, 0, 0, 1.6, 0.7, 0.8, '#8f8a82');
    b.block(M, 0, 0.62, 0, 1.4, 0.06, 0.6, '#5d8fb0');
    for (const [x, z] of [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]]) b.block(M, x, 0, z, 0.15, 2.3, 0.15, '#c8352b');
    b.prism(M, 0, 2.3, 0, 2.4, 0.7, 1.7, '#3d3b40', { ry: Math.PI / 2 });
    c.phys.box(M, 0, 0, 1.0, 0.6, 2.5);
  }

  // Forest edges
  for (let z = 1; z < L; z += 3.3) {
    for (const sx of [-1, 1]) {
      const kind = rnd() < 0.45 ? 'sakura' : 'cedar';
      c.trees.add(kind, f.matrix(sx * (6.5 + rnd() * 2.5), z + rnd() * 2), 0.9 + rnd() * 0.4);
    }
  }
}

/** Zone 5 — circular shrine park & overlook with the sakura ring and wrap-around bench. */
export function buildPark(c: Ctx) {
  const f = F.park;
  const { b, atlas, rnd } = c;
  const M = f.matrix(0, 0);

  disc(b, 'pavers', f, 0, PARK_R - 0.5, 0.05, 3.2, 72, 16);
  patch(b, 'stoneSlab', f, -1.1, 1.1, -PARK_R - 1, -PARK_R + 1, 0.07, 1.1, 0.5);

  // Great tree with the octagonal bench + the hat and randoseru
  c.trees.add('sakura', M, 1.9);
  treeBench(c, M, 2.6);
  const cover = atlas.sign('交通安全', 0.34, 0.3, { bg: '#ffd21f', fg: '#1e8449', font: FONT_ROUND, sub: 'ひばりが丘小学校' });
  const Ms = M.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 2.62));
  schoolItems(c, Ms, cover);
  {
    const Mp = f.matrix(0.9, -2.0, Math.PI);
    const uv = atlas.sign('ソメイヨシノ', 0.6, 0.32, { bg: '#ffffff', fg: '#222', border: '#444', sub: 'バラ科サクラ属' });
    b.block(Mp, 0, 0, 0, 0.04, 0.35, 0.04, '#555');
    b.box(Mp, 0, 0.45, 0, 0.62, 0.34, 0.03, '#555', { rx: -0.5 });
    b.quad(Mp, 0, 0.46, 0.02, 0.6, 0.32, uv, { key: 'signs', rx: -0.5 });
  }

  // Sakura ring
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const x = Math.sin(a) * 11.2, z = Math.cos(a) * 11.2;
    if (z < -9 && Math.abs(x) < 3.5) continue;
    if (z > 9 && Math.abs(x) < 3) continue;
    c.trees.add('sakura', f.matrix(x, z), 1.1 + rnd() * 0.2);
    if (i % 2 === 0) bench(c, f.matrix(Math.sin(a) * 8.6, Math.cos(a) * 8.6, a + Math.PI), 0, 0, 0, 1.8);
  }

  // Hanami lantern lines between the ring trees
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    pts.push(f.point(Math.sin(a) * 10.2, Math.cos(a) * 10.2, 3.6));
  }
  for (let i = 0; i < 28; i += 2) {
    const a = pts[i], e = pts[i + 2];
    const w = wire(c, a, e, 0.35, '#3a2f2a', 0.012);
    const Mi = new THREE.Matrix4().copy(f.matrix(0, 0)).setPosition(w[4]);
    chochin(c, Mi, 0, -0.35, 0, { s: 0.55, color: i % 4 ? '#ffffff' : '#ff8fb4' });
  }

  // Small shrine hall at the back
  {
    const Mh = f.matrix(0, 12.6, Math.PI);
    b.block(Mh, 0, 0, 0, 3.6, 0.6, 3.0, '#8f8a82');
    b.block(Mh, 0, 0.6, -0.2, 3.0, 2.2, 2.4, '#7a4a32');
    b.block(Mh, 0, 0.6, 1.0, 2.6, 1.9, 0.05, '#e9dfc8');
    for (const sx of [-1, 1]) b.block(Mh, sx * 1.45, 0.6, 1.2, 0.18, 2.3, 0.18, '#c8352b');
    b.prism(Mh, 0, 2.8, -0.1, 3.4, 1.4, 4.0, '#2f3a3f', { ry: 0 });
    b.box(Mh, 0, 2.85, -0.1, 4.4, 0.12, 3.8, '#2f3a3f');
    b.block(Mh, 0, 0.6, 1.7, 1.2, 0.7, 0.6, '#5a3a28');
    const sai = atlas.sign('賽銭', 1.0, 0.25, { bg: '#5a3a28', fg: '#f0d58a', font: FONT_MINCHO });
    b.quad(Mh, 0, 0.95, 2.01, 1.0, 0.25, sai, { key: 'signs' });
    b.cyl(Mh, 0, 2.0, 1.4, 0.03, 0.03, 1.6, '#e0c060');
    b.sphere(Mh, 0, 2.8, 1.4, 0.3, 0.3, 0.3, '#c9a43a');
    shimenawa(c, Mh, -1.4, 1.4, 2.6, 1.25);
    c.phys.box(Mh, 0, 0, 1.9, 1.9, 4);
  }

  // Overlook railing (open at the approach)
  const rail: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI + 0.22 + (i / 40) * (Math.PI * 2 - 0.44);
    rail.push([Math.sin(a) * (PARK_R - 0.6), Math.cos(a) * (PARK_R - 0.6)]);
  }
  railing(c, M, rail);

  // Coin binoculars at the overlook + lamps
  for (const a of [Math.PI * 0.5, -Math.PI * 0.5]) {
    const Mb = f.matrix(Math.sin(a) * 13.4, Math.cos(a) * 13.4, a);
    b.cyl(Mb, 0, 0.6, 0, 0.07, 0.1, 1.2, '#3d6fa8');
    b.block(Mb, 0, 1.15, 0, 0.35, 0.3, 0.6, '#3d6fa8');
    b.cyl(Mb, -0.1, 1.33, 0.32, 0.07, 0.07, 0.2, '#222', { rx: Math.PI / 2 });
    b.cyl(Mb, 0.1, 1.33, 0.32, 0.07, 0.07, 0.2, '#222', { rx: Math.PI / 2 });
    c.phys.circle(Mb, 0, 0, 0.3, 1.5);
  }
  for (const a of [0.9, 2.3, 4.0, 5.4]) streetLamp(c, f.matrix(Math.sin(a) * 13.6, Math.cos(a) * 13.6), 0, 0, a + Math.PI);
  const sign = atlas.sign('さくら見晴らし公園', 2.0, 0.5, { bg: '#5b3a29', fg: '#fff3e0', font: FONT_ROUND });
  {
    const Mg = f.matrix(3.2, -PARK_R + 0.8, Math.PI + 0.2);
    for (const sx of [-0.9, 0.9]) b.block(Mg, sx, 0, 0, 0.12, 1.4, 0.12, '#5b3a29');
    b.board(Mg, 0, 1.25, 0, 2.0, 0.5, sign, { frame: '#3e271b' });
    c.phys.box(Mg, 0, 0, 1.1, 0.15, 1.6);
  }
  void wp;
}
