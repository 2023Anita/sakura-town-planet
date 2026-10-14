import * as THREE from 'three';
import type { Ctx } from '../kit';
import { bench, patch, vending, wp } from '../kit';
import { F } from './layout';
import { FONT_GOTHIC } from '../textures';

/** Bonus zone — ひばりが丘駅: platform, track and a walk-in train car interior. */
export function buildStation(c: Ctx) {
  const f = F.station;
  const { b, atlas } = c;
  const TX = -2;

  patch(b, 'gravel', f, -3.6, -0.5, -30, 30, 0.03, 2, 1);
  // Rails & sleepers, chunked to follow the curvature
  for (let z = -30; z < 30; z += 2) {
    for (const sx of [-0.55, 0.55]) {
      const M = f.matrix(TX + sx, z + 1);
      b.block(M, 0, 0, 0, 0.08, 0.16, 2.02, '#7c7f86');
    }
  }
  for (let z = -29.6; z < 30; z += 0.65) b.block(f.matrix(TX, z), 0, 0, 0, 1.7, 0.08, 0.24, '#6b5a4a');
  for (const z of [-30, 30]) {
    const M = f.matrix(TX, z);
    b.block(M, 0, 0, 0, 1.8, 0.9, 0.4, '#d6c23a');
    b.block(M, 0, 0.9, 0, 1.8, 0.1, 0.45, '#2b2b2b');
    c.phys.box(M, 0, 0, 0.95, 0.25, 1);
  }

  // Platform segments
  for (let z = -13; z < 13; z += 2) {
    const M = f.matrix(1.75, z + 1);
    b.block(M, 0, -1.2, 0, 4.5, 1.65, 2.02, '#c7c2b8');
    b.block(M, -2.0, 0.451, 0, 0.3, 0.005, 2.02, '#f2d13a');
    b.block(M, -2.22, 0.452, 0, 0.05, 0.005, 2.02, '#ffffff');
    c.phys.floor(M, 0, 0, 2.25, 1.0, 0.45);
  }
  // Canopy
  for (let z = -10; z <= 10; z += 5) {
    const M = f.matrix(2.9, z);
    b.cyl(M, 0, 1.9, 0, 0.08, 0.08, 3.0, '#5b636b');
    c.phys.circle(M, 0, 0, 0.14, 4);
  }
  for (let z = -11; z < 11; z += 2.75) {
    const M = f.matrix(2.0, z + 1.375);
    b.box(M, 0, 3.45, 0, 3.6, 0.12, 2.8, '#7e8790', { rz: 0.08 });
  }
  // Station name board
  const nameUv = atlas.draw(560, 200, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 64px ${FONT_GOTHIC}`;
    ctx.fillText('ひばりが丘', w / 2, 62);
    ctx.font = `600 22px ${FONT_GOTHIC}`;
    ctx.fillText('HIBARIGAOKA', w / 2, 112);
    ctx.fillStyle = '#2e7d4f';
    ctx.fillRect(0, 140, w, 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 24px ${FONT_GOTHIC}`;
    ctx.textAlign = 'left';
    ctx.fillText('← さくら台', 16, 170);
    ctx.textAlign = 'right';
    ctx.fillText('ゆめの台 →', w - 16, 170);
  });
  for (const z of [-6.5, 7.5]) {
    const M = f.matrix(1.9, z, Math.PI / 2);
    b.block(M, -1.1, 0.45, 0, 0.08, 2.2, 0.08, '#5b636b');
    b.block(M, 1.1, 0.45, 0, 0.08, 2.2, 0.08, '#5b636b');
    b.board(M, 0, 2.15, 0, 2.24, 0.8, nameUv, { frame: '#5b636b' });
    c.phys.box(M, 0, 0, 1.2, 0.1, 3);
  }
  bench(c, f.matrix(3.4, -2, -Math.PI / 2), 0, 0, 0, 1.8);
  bench(c, f.matrix(3.4, 3, -Math.PI / 2), 0, 0, 0, 1.8);
  vending(c, f.matrix(3.6, 10.5, -Math.PI / 2), 0, 0, 0, '#2e7d4f');

  buildTrain(c, f.matrix(TX, 0));

  // Level crossing signal by the footpath
  {
    const M = f.matrix(0.6, -18);
    b.cyl(M, 0, 1.8, 0, 0.07, 0.07, 3.6, '#f2f2f2');
    for (let k = 0; k < 6; k++) b.cyl(M, 0, 0.3 + k * 0.6, 0.0, 0.075, 0.075, 0.3, '#1d1d1d');
    b.box(M, 0, 3.2, 0.1, 1.0, 0.16, 0.04, '#f2c200', { rz: 0.6 });
    b.box(M, 0, 3.2, 0.1, 1.0, 0.16, 0.04, '#f2c200', { rz: -0.6 });
    for (const sx of [-0.32, 0.32]) {
      b.cyl(M, sx, 2.55, 0.12, 0.13, 0.13, 0.08, '#e3312a', { rx: Math.PI / 2, seg: 14, key: 'glow', glow: 1.5 });
      b.box(M, sx, 2.55, 0.05, 0.36, 0.36, 0.06, '#1d1d1d');
    }
    const fumi = atlas.sign('踏切注意', 0.7, 0.22, { bg: '#f2c200', fg: '#1d1d1d' });
    b.quad(M, 0, 1.9, 0.08, 0.7, 0.22, fumi, { key: 'signs' });
    c.phys.circle(M, 0, 0, 0.12, 4);
  }
}

function buildTrain(c: Ctx, Mc: THREE.Matrix4) {
  const { b, atlas } = c;
  const L = 14, HW = 1.4, FL = 0.45;
  const doors = [-4.5, 0, 4.5];
  const DW = 0.65;
  const cream = '#f1e9d2', green = '#2e7d4f', seat = '#3f7d5a';
  const isDoor = (z: number) => doors.some((d) => Math.abs(z - d) < DW);

  // Underframe, bogies and wheels
  b.block(Mc, 0, 0.12, 0, 2.6, 0.3, L - 0.4, '#3b3d42');
  for (const bz of [-4.6, 4.6]) {
    b.block(Mc, 0, 0.05, bz, 1.9, 0.35, 2.4, '#2a2b2f');
    for (const wz of [-0.75, 0.75]) for (const sx of [-0.62, 0.62]) b.cyl(Mc, sx, 0.33, bz + wz, 0.33, 0.33, 0.14, '#1d1e22', { rz: Math.PI / 2, seg: 14 });
  }
  b.block(Mc, 0, FL - 0.1, 0, HW * 2, 0.1, L, '#8f969d');

  // Side walls: green skirt, open windows, cream upper band. +x side has open doors.
  const step = 0.5;
  for (const s of [-1, 1]) {
    for (let z = -L / 2; z < L / 2 - 1e-6; z += step) {
      const zc = z + step / 2;
      const door = s > 0 && isDoor(zc);
      const doorFace = s < 0 && isDoor(zc);
      if (!door) {
        b.box(Mc, s * HW, FL + 0.45, zc, 0.08, 0.9, step + 0.01, doorFace ? '#2a6b44' : green);
        const idx = Math.round((z + L / 2) / step);
        const pillar = doorFace || idx % 3 === 0 || isDoor(zc - step) || isDoor(zc + step);
        if (pillar) b.box(Mc, s * HW, FL + 1.3, zc, 0.08, 0.8, step + 0.01, cream);
      } else {
        b.box(Mc, s * HW, 0.25, zc, 0.12, 0.08, step, '#cfcfcf');
      }
      b.box(Mc, s * HW, FL + 2.15, zc, 0.08, 0.9, step + 0.01, cream);
    }
    // collision: wall pieces between doors
    if (s < 0) c.phys.box(Mc, s * HW, 0, 0.08, L / 2, 3.2);
    else {
      const edges = [-L / 2, ...doors.flatMap((d) => [d - DW, d + DW]), L / 2];
      for (let i = 0; i < edges.length; i += 2) {
        const z0 = edges[i], z1 = edges[i + 1];
        c.phys.box(Mc, s * HW, (z0 + z1) / 2, 0.08, (z1 - z0) / 2, 3.2);
      }
    }
  }
  // Ends with cab windows
  for (const e of [-1, 1]) {
    const z = e * (L / 2);
    b.box(Mc, 0, FL + 0.45, z, HW * 2, 0.9, 0.1, green);
    b.box(Mc, -0.95, FL + 1.3, z, 0.9, 0.8, 0.1, cream);
    b.box(Mc, 0.95, FL + 1.3, z, 0.9, 0.8, 0.1, cream);
    b.box(Mc, 0, FL + 1.3, z, 1.0, 0.8, 0.06, '#26343f');
    b.box(Mc, 0, FL + 2.15, z, HW * 2, 0.9, 0.1, cream);
    const dest = atlas.sign('さくら台', 0.8, 0.22, { bg: '#111', fg: '#ffb340', neon: true });
    b.quad(Mc, 0, FL + 2.3, z + e * 0.06, 0.8, 0.22, dest, { key: 'neon', ry: e > 0 ? 0 : Math.PI, glow: 1.6 });
    for (const sx of [-0.85, 0.85]) b.sphere(Mc, sx, FL + 0.55, z + e * 0.06, 0.16, 0.16, 0.05, '#fff6d8', { key: 'glow', glow: 1.6 });
    c.phys.box(Mc, 0, z, HW, 0.1, 3.2);
  }
  // Roof
  b.block(Mc, 0, FL + 2.6, 0, HW * 2 + 0.1, 0.18, L + 0.1, '#d8d2c2');
  b.block(Mc, 0, FL + 2.78, 0, HW * 1.4, 0.14, L - 0.6, '#c9c3b3');
  for (const z of [-4, 2.5]) b.block(Mc, 0, FL + 2.92, z, 1.2, 0.3, 1.8, '#9ea4aa');
  b.box(Mc, 0, FL + 3.4, -2, 1.2, 0.05, 0.05, '#333', { rx: 0.7 });
  b.box(Mc, 0, FL + 3.4, -1.6, 1.2, 0.05, 0.05, '#333', { rx: -0.7 });
  b.box(Mc, 0, FL + 3.7, -1.8, 1.4, 0.06, 0.12, '#333');

  // Interior: longitudinal seats, poles, straps, lights and ads
  for (const s of [-1, 1]) {
    for (let z = -L / 2 + 0.3; z < L / 2 - 0.3; z += step) {
      const zc = z + step / 2;
      if (isDoor(zc) || isDoor(zc - 0.25) || isDoor(zc + 0.25)) continue;
      b.box(Mc, s * (HW - 0.32), FL + 0.22, zc, 0.5, 0.2, step + 0.01, seat);
      b.box(Mc, s * (HW - 0.32), FL + 0.06, zc, 0.44, 0.12, step + 0.01, '#6a7076');
      b.box(Mc, s * (HW - 0.1), FL + 0.6, zc, 0.12, 0.5, step + 0.01, seat);
    }
  }
  // seat blocks as colliders (between doors)
  {
    const edges = [-L / 2 + 0.3, ...doors.flatMap((d) => [d - DW - 0.25, d + DW + 0.25]), L / 2 - 0.3];
    for (let i = 0; i < edges.length; i += 2) {
      const z0 = edges[i], z1 = edges[i + 1];
      for (const s of [-1, 1]) c.phys.box(Mc, s * (HW - 0.32), (z0 + z1) / 2, 0.25, (z1 - z0) / 2, 0.9);
    }
  }
  for (const d of doors) {
    for (const s of [-1, 1]) for (const dz of [-DW - 0.1, DW + 0.1]) b.cyl(Mc, s * 0.95, FL + 1.25, d + dz, 0.025, 0.025, 2.5, '#d6d9dc');
  }
  for (const s of [-1, 1]) {
    b.cyl(Mc, s * 0.72, FL + 2.1, 0, 0.022, 0.022, L - 0.4, '#d6d9dc', { rx: Math.PI / 2 });
    const ring = new THREE.TorusGeometry(0.075, 0.012, 5, 12);
    for (let z = -L / 2 + 0.6; z < L / 2 - 0.5; z += 0.55) {
      b.box(Mc, s * 0.72, FL + 1.98, z, 0.02, 0.24, 0.03, '#f5f5f5');
      const m = Mc.clone().multiply(new THREE.Matrix4().makeTranslation(s * 0.72, FL + 1.8, z)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      b.add('toon', ring, m, '#f5f5f5');
    }
    b.box(Mc, s * 0.45, FL + 2.48, 0, 0.16, 0.04, L - 0.6, '#f4f8ff', { key: 'glow', glow: 1.4 });
  }
  const ads = [
    atlas.sign('春の新生活フェア', 1.2, 0.36, { bg: '#ffe3ee', fg: '#c2185b', sub: 'ひばりが丘商店街 3/20〜4/10' }),
    atlas.sign('さくら惑星 観光協会', 1.2, 0.36, { bg: '#e3f2fd', fg: '#1565c0', sub: '一周たったの五百メートル' }),
    atlas.sign('英会話 はじめよう', 1.2, 0.36, { bg: '#fffde7', fg: '#e65100', sub: '駅前すぐ・無料体験' }),
    atlas.sign('ひばり湯', 1.2, 0.36, { bg: '#e8f5e9', fg: '#2e7d32', sub: '営業 15:00〜24:00' }),
  ];
  let k = 0;
  for (const s of [-1, 1]) {
    for (let z = -5.8; z < 6; z += 2.25) {
      if (isDoor(z)) continue;
      b.quad(Mc, s * (HW - 0.05), FL + 1.9, z, 1.2, 0.36, ads[k++ % ads.length], { key: 'signs', ry: -s * Math.PI / 2 });
    }
  }
  const route = atlas.draw(420, 80, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2e7d4f';
    ctx.fillRect(20, 36, w - 40, 8);
    const st = ['さくら台', 'ひばりが丘', 'ゆめの台', 'ほしの浜'];
    ctx.font = `700 15px ${FONT_GOTHIC}`;
    ctx.textAlign = 'center';
    st.forEach((n, i) => {
      const x = 40 + (i * (w - 80)) / 3;
      ctx.beginPath();
      ctx.fillStyle = i === 1 ? '#e53935' : '#ffffff';
      ctx.strokeStyle = '#2e7d4f';
      ctx.lineWidth = 4;
      ctx.arc(x, 40, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#222';
      ctx.fillText(n, x, 72);
    });
    ctx.font = `800 14px ${FONT_GOTHIC}`;
    ctx.fillText('ひばり線 路線図', w / 2, 16);
  });
  for (const d of doors) b.quad(Mc, HW - 0.05, FL + 2.25, d, 1.1, 0.21, route, { key: 'signs', ry: -Math.PI / 2 });
  for (let z = -5; z <= 5; z += 2.5) {
    b.board(Mc, 0, FL + 1.95, z, 0.8, 0.24, ads[(k++ + 1) % ads.length], { depth: 0.01, frame: '#ffffff' });
  }

  // Walkable floor + interior marker so the camera tucks in
  for (let z = -L / 2; z < L / 2; z += 2) c.phys.floor(Mc, 0, z + 1, HW, 1.0, FL);
  c.phys.interior(Mc, 0, 0, HW, L / 2);
  c.lights.add(wp(Mc, 0, FL + 2.2, 0), '#eef4ff', 3, 7);
}
