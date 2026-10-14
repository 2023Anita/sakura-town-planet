import * as THREE from 'three';
import type { Ctx } from '../kit';
import { bicycle, house, patch, pole, streetLamp, wire, wp } from '../kit';
import { F } from './layout';
import { SUN_DIR } from '../planet';
import { FONT_MINCHO } from '../textures';

/** Zone 1 — 県立ひばりが丘高等学校: gate pillars, crest, 入学式 sign, sakura and light shafts. */
export function buildSchool(c: Ctx) {
  const f = F.school;
  const { b, atlas, rnd } = c;

  patch(b, 'dirt', f, 7.3, 36, -30, 30, 0.035, 5, 1.5);
  patch(b, 'stoneSlab', f, 5.5, 23, -2.6, 2.6, 0.06, 2, 1);
  patch(b, 'pavers', f, 5.5, 7.3, -30, 30, 0.05, 3, 1);

  // Perimeter wall, chunked so it hugs the curvature.
  for (let z = -30; z < 30; z += 3) {
    const zc = z + 1.5;
    if (Math.abs(zc) < 3.6) continue;
    const M = f.matrix(7.2, zc);
    b.block(M, 0, -1, 0, 0.35, 2.4, 3.02, '#d8d3c9');
    b.block(M, 0, 1.4, 0, 0.45, 0.12, 3.04, '#b9b2a6');
    for (let k = 0; k < 3; k++) b.block(M, 0, 1.52, -1 + k, 0.05, 0.9, 0.05, '#4d6b55');
    b.block(M, 0, 2.38, 0, 0.05, 0.05, 3.02, '#4d6b55');
    c.phys.box(M, 0, 0, 0.25, 1.52, 2.5);
  }
  for (const side of [-1, 1]) {
    const zc = side * 30;
    const M = f.matrix(21.6, zc);
    for (let k = -7; k < 7; k++) {
      const Mk = f.matrix(7.3 + 14.3 + k * 2, zc);
      b.block(Mk, 0, -1, 0, 2.02, 2.4, 0.35, '#d8d3c9');
      c.phys.box(Mk, 0, 0, 1.02, 0.25, 2.5);
    }
    void M;
  }

  // Gate pillars, plaque and crest.
  const plaque = atlas.sign('県立ひばりが丘高等学校', 0.42, 2.3, { vertical: true, bg: '#f4efe4', fg: '#1d1d1d', font: FONT_MINCHO, weight: 700, border: '#6b6457' });
  const crest = atlas.draw(256, 256, (ctx, w) => {
    ctx.fillStyle = '#f4efe4';
    ctx.fillRect(0, 0, w, w);
    ctx.translate(w / 2, w / 2);
    ctx.strokeStyle = '#2a3d6b';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 108, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e46a93';
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i / 5) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, -46, 26, 44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#2a3d6b';
    ctx.font = `900 64px ${FONT_MINCHO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('高', 0, 4);
  });
  for (const side of [-1, 1]) {
    const M = f.matrix(7.2, side * 3.3, -Math.PI / 2);
    b.block(M, 0, -0.5, 0, 0.9, 3.3, 0.9, '#c9c2b6');
    b.block(M, 0, 2.8, 0, 1.05, 0.25, 1.05, '#aaa397');
    b.sphere(M, 0, 3.15, 0, 0.5, 0.35, 0.5, '#aaa397');
    if (side < 0) b.quad(M, 0, 1.4, 0.47, 0.42, 2.3, plaque, { key: 'signs' });
    else b.quad(M, 0, 2.05, 0.47, 0.7, 0.7, crest, { key: 'signs' });
    c.phys.box(M, 0, 0, 0.5, 0.5, 3.2);
    // folded sliding gate
    b.block(f.matrix(7.6, side * 4.5), 0, 0, 0, 0.3, 1.5, 1.6, '#3c3f45');
  }
  // gate rail
  b.block(f.matrix(7.2, 0), 0, -0.02, 0, 0.12, 0.06, 5.8, '#7b7f86');

  // 入学式 standing sign with paper flowers
  {
    const M = f.matrix(6.3, -5.2, -Math.PI / 2 + 0.25);
    const uv = atlas.sign('入学式', 0.85, 2.3, { vertical: true, bg: '#ffffff', fg: '#111', font: FONT_MINCHO, weight: 800, sub: '令和八年度 第七十八回' });
    b.block(M, 0, 0, 0, 1.0, 0.1, 0.5, '#555');
    b.block(M, -0.42, 0, 0, 0.08, 2.75, 0.08, '#7a5b3f');
    b.block(M, 0.42, 0, 0, 0.08, 2.75, 0.08, '#7a5b3f');
    b.block(M, 0, 0.35, 0, 0.95, 2.45, 0.06, '#e2ddd2');
    b.quad(M, 0, 1.58, 0.035, 0.85, 2.3, uv, { key: 'signs' });
    for (let i = 0; i < 7; i++) b.sphere(M, -0.42 + i * 0.14, 2.88 + Math.sin(i) * 0.06, 0.05, 0.2, 0.2, 0.12, i % 2 ? '#ffffff' : '#ff9fbf');
    b.sphere(M, -0.5, 2.55, 0.06, 0.22, 0.22, 0.12, '#ff7aa8');
    b.sphere(M, 0.5, 2.55, 0.06, 0.22, 0.22, 0.12, '#ff7aa8');
    c.phys.box(M, 0, 0, 0.55, 0.3, 3);
  }

  // School building (front faces the gate / road).
  {
    const bx = 27, len = 26, dep = 9, floors = 3, fh = 3.4;
    const M = f.matrix(bx, 0, -Math.PI / 2);
    const H = floors * fh;
    b.block(M, 0, -2.5, 0, len, 2.6, dep, '#a8a298');
    b.block(M, 0, 0, 0, len, H, dep, '#f2efe8');
    for (let fl = 0; fl < floors; fl++) {
      b.block(M, 0, fl * fh + 0.2, dep / 2 + 0.05, len + 0.1, 0.2, 0.15, '#d9d3c8');
      for (let i = 0; i < 9; i++) {
        const x = -len / 2 + 1.6 + i * 2.85;
        if (Math.abs(x) < 3.3) continue;
        b.box(M, x, fl * fh + 1.8, dep / 2 + 0.02, 2.3, 1.6, 0.08, '#e9e6df');
        b.box(M, x, fl * fh + 1.8, dep / 2 + 0.06, 2.1, 1.4, 0.05, rnd() < 0.3 ? '#a9c4d8' : '#7c9ab3');
        b.box(M, x, fl * fh + 1.8, dep / 2 + 0.09, 0.05, 1.4, 0.03, '#e9e6df');
      }
    }
    // central tower with clock + crest
    b.block(M, 0, 0, 0.5, 6, H + 3.2, dep + 1, '#f6f4ee');
    b.block(M, 0, 0, dep / 2 + 1, 4, 2.6, 0.3, '#6d8fa8');
    b.box(M, 0, 2.9, dep / 2 + 1.6, 5, 0.18, 1.6, '#cfc8bc');
    const clock = atlas.draw(256, 256, (ctx, w) => {
      ctx.fillStyle = '#f6f4ee';
      ctx.fillRect(0, 0, w, w);
      ctx.translate(w / 2, w / 2);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 112, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        ctx.save();
        ctx.rotate((i / 12) * Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fillRect(-4, -100, 8, 20);
        ctx.restore();
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -80);
      ctx.moveTo(0, 0);
      ctx.lineTo(55, 20);
      ctx.stroke();
    });
    b.quad(M, 0, H + 1.3, dep / 2 + 1.02, 2.4, 2.4, clock, { key: 'signs' });
    b.quad(M, 0, H - 1.6, dep / 2 + 1.02, 1.3, 1.3, crest, { key: 'signs' });
    const nameUv = atlas.sign('県立ひばりが丘高等学校', 4.2, 0.55, { bg: '#f6f4ee', fg: '#2a3d6b', font: FONT_MINCHO, weight: 800 });
    b.quad(M, 0, H - 3.1, dep / 2 + 1.02, 4.2, 0.55, nameUv, { key: 'signs' });
    b.block(M, 0, H, 0, len + 0.3, 0.4, dep + 0.3, '#d6d0c5');
    for (let i = 0; i < 26; i++) b.block(M, -len / 2 + i, H + 0.4, dep / 2, 0.04, 1.1, 0.04, '#6d7b72');
    b.block(M, 0, H + 1.45, dep / 2, len, 0.05, 0.05, '#6d7b72');
    c.phys.box(M, 0, 0.5, len / 2, dep / 2 + 1, H + 4);
    // banner on the facade
    const ban = atlas.sign('祝 入学', 0.9, 4.2, { vertical: true, bg: '#ffffff', fg: '#c0283c', font: FONT_MINCHO, weight: 900, border: '#c0283c' });
    b.quad(M, -6.2, H - 3.6, dep / 2 + 0.1, 0.9, 4.2, ban, { key: 'signs' });
  }

  // Sakura avenue
  for (const z of [-25, -19, -12.5, 9, 15, 21, 27]) c.trees.add('sakura', f.matrix(10.3, z), 1.15);
  for (const z of [-25, -9, 7, 23]) c.trees.add('sakura', f.matrix(-7.6, z), 1.05);
  for (const [x, z] of [[17, -16], [18, 14], [31, -26], [32, 25]]) c.trees.add('sakura', f.matrix(x, z), 1.3);
  for (const z of [-27, 27]) c.trees.add('round', f.matrix(33, z * 0.5), 1.1, false);

  // Light shafts slanting from the sun through the canopies
  {
    const s = new THREE.Vector3(SUN_DIR.dot(f.right), SUN_DIR.dot(f.n), SUN_DIR.dot(f.fwd)).normalize();
    const plane = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    for (let i = 0; i < 9; i++) {
      const x = 8 + rnd() * 6, z = -14 + rnd() * 28;
      const base = f.matrix(x, z);
      const yAxis = s.clone();
      const xAxis = new THREE.Vector3(1, 0, 0).sub(yAxis.clone().multiplyScalar(yAxis.x)).normalize();
      const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
      const rot = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
      const w = 0.8 + rnd() * 1.2;
      for (const ry of [0, Math.PI / 2]) {
        const m = base.clone().multiply(rot).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeScale(w, 11, 1));
        b.add('shaft', plane, m, '#fff3d6', 0.09);
      }
    }
  }

  // Houses across the road
  for (const [z, w] of [[-27, 6.5], [-16, 7]] as const) {
    house(c, f.matrix(-11.5, z, Math.PI / 2), { w, d: 7, floors: 2, balcony: true });
  }
  // Crosswalk at the gate
  for (let i = 0; i < 6; i++) b.box(f.matrix(-2.75 + i * 1.1, 0), 0, 0.04, 0, 0.55, 0.02, 3.2, '#f4f2ea');
  // School zone road sign + bikes
  {
    const M = f.matrix(5.0, -9);
    b.cyl(M, 0, 1.4, 0, 0.04, 0.04, 2.8, '#888');
    b.cyl(M, 0, 2.6, 0.03, 0.38, 0.38, 0.04, '#2f6fd1', { rx: Math.PI / 2, seg: 20 });
    const uv = atlas.sign('スクールゾーン', 0.7, 0.2, { bg: '#ffffff', fg: '#2f6fd1' });
    b.quad(M, 0, 2.1, 0.06, 0.7, 0.2, uv, { key: 'signs' });
    for (let i = 0; i < 4; i++) bicycle(c, f.matrix(9 + i * 0.7, 4.5), 0, 0, 0.1, ['#c0392b', '#2e86de', '#ecf0f1', '#27ae60'][i]);
  }
  streetLamp(c, f.matrix(-4.8, 14), 0, 0, Math.PI / 2);
  // poles + wires along the south side
  let prev: THREE.Vector3[] | null = null;
  for (let z = -28; z <= 28; z += 14) {
    const p = pole(c, f.matrix(-5.2, z));
    if (prev) for (let k = 0; k < 3; k++) wire(c, prev[k], p[k], 0.45);
    prev = p;
  }
  void wp;
}
