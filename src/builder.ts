import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { UVRect } from './textures';

export type ColorLike = THREE.ColorRepresentation | THREE.Color;

const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitPlane = new THREE.PlaneGeometry(1, 1);
const unitSphere = new THREE.IcosahedronGeometry(0.5, 1);
const cylCache = new Map<string, THREE.BufferGeometry>();

function prismGeometry() {
  // Triangular prism: base width 1 (x), height 1 (y), depth 1 (z); ridge along z.
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.lineTo(0.5, 0);
  s.lineTo(0, 1);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
}
const unitPrism = prismGeometry();

/**
 * Collects procedural parts and merges them into one mesh per material key, so a whole zone
 * renders in a handful of draw calls. Solid parts carry their colour as a vertex attribute.
 */
export class Builder {
  private parts = new Map<string, THREE.BufferGeometry[]>();

  add(key: string, geo: THREE.BufferGeometry, matrix: THREE.Matrix4 | null, color: ColorLike = 0xffffff, scale = 1) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    _c.set(color as THREE.ColorRepresentation);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r * scale;
      col[i * 3 + 1] = _c.g * scale;
      col[i * 3 + 2] = _c.b * scale;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    let list = this.parts.get(key);
    if (!list) this.parts.set(key, (list = []));
    list.push(g);
    return this;
  }

  private local(M: THREE.Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _m2.compose(_p, _q, _s);
    return _m.multiplyMatrices(M, _m2);
  }

  /** Box centred at (x, y, z) in the local space of M. */
  box(M: THREE.Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: ColorLike, opts: { key?: string; ry?: number; rx?: number; rz?: number; glow?: number } = {}) {
    return this.add(opts.key ?? 'toon', unitBox, this.local(M, x, y, z, sx, sy, sz, opts.ry, opts.rx, opts.rz), color, opts.glow ?? 1);
  }

  /** Box resting on y (base at y). */
  block(M: THREE.Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: ColorLike, opts: { key?: string; ry?: number; glow?: number } = {}) {
    return this.box(M, x, y + sy / 2, z, sx, sy, sz, color, opts);
  }

  cyl(M: THREE.Matrix4, x: number, y: number, z: number, rTop: number, rBot: number, h: number, color: ColorLike, opts: { key?: string; seg?: number; rx?: number; rz?: number; ry?: number; glow?: number; open?: boolean } = {}) {
    const seg = opts.seg ?? 8;
    const k = `${rTop.toFixed(3)}:${rBot.toFixed(3)}:${seg}:${opts.open ? 1 : 0}`;
    let g = cylCache.get(k);
    if (!g) cylCache.set(k, (g = new THREE.CylinderGeometry(rTop, rBot, 1, seg, 1, !!opts.open)));
    return this.add(opts.key ?? 'toon', g, this.local(M, x, y, z, 1, h, 1, opts.ry, opts.rx, opts.rz), color, opts.glow ?? 1);
  }

  sphere(M: THREE.Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: ColorLike, opts: { key?: string; glow?: number; ry?: number } = {}) {
    return this.add(opts.key ?? 'toon', unitSphere, this.local(M, x, y, z, sx, sy, sz, opts.ry), color, opts.glow ?? 1);
  }

  /** Gable roof prism: base at y, ridge along local z. */
  prism(M: THREE.Matrix4, x: number, y: number, z: number, w: number, h: number, d: number, color: ColorLike, opts: { key?: string; ry?: number } = {}) {
    return this.add(opts.key ?? 'toon', unitPrism, this.local(M, x, y, z, w, h, d, opts.ry), color);
  }

  /** Flat quad facing local +z (or rotated), mapped to an atlas rectangle. */
  quad(M: THREE.Matrix4, x: number, y: number, z: number, w: number, h: number, uv: UVRect | null, opts: { key?: string; ry?: number; rx?: number; color?: ColorLike; glow?: number } = {}) {
    const g = unitPlane.clone();
    if (uv) {
      const a = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) {
        a.setXY(i, uv.u0 + a.getX(i) * (uv.u1 - uv.u0), uv.v0 + a.getY(i) * (uv.v1 - uv.v0));
      }
    }
    return this.add(opts.key ?? 'signs', g, this.local(M, x, y, z, w, h, 1, opts.ry, opts.rx), opts.color ?? 0xffffff, opts.glow ?? 1);
  }

  /** Two-sided sign board: a thin box with the atlas image on front and back. */
  board(M: THREE.Matrix4, x: number, y: number, z: number, w: number, h: number, uv: UVRect, opts: { key?: string; ry?: number; frame?: ColorLike; depth?: number; glow?: number; back?: boolean } = {}) {
    const ry = opts.ry ?? 0;
    const d = opts.depth ?? 0.08;
    this.box(M, x, y, z, w + 0.06, h + 0.06, d, opts.frame ?? 0x3a3340, { ry });
    const ox = Math.sin(ry) * (d / 2 + 0.005), oz = Math.cos(ry) * (d / 2 + 0.005);
    this.quad(M, x + ox, y, z + oz, w, h, uv, { key: opts.key, ry, glow: opts.glow });
    if (opts.back !== false) this.quad(M, x - ox, y, z - oz, w, h, uv, { key: opts.key, ry: ry + Math.PI, glow: opts.glow });
    return this;
  }

  /** Thin tube through world-space points (wires, ropes). */
  tube(points: THREE.Vector3[], radius: number, color: ColorLike, key = 'toon', radial = 4) {
    const curve = new THREE.CatmullRomCurve3(points);
    const g = new THREE.TubeGeometry(curve, Math.max(4, points.length * 2), radius, radial, false);
    return this.add(key, g, null, color);
  }

  /** Raw world-space geometry (already positioned). */
  raw(key: string, g: THREE.BufferGeometry, color: ColorLike = 0xffffff) {
    return this.add(key, g, null, color);
  }

  build(materials: Record<string, THREE.Material>, name = 'zone') {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, list] of this.parts) {
      const mat = materials[key];
      if (!mat) throw new Error(`Unknown material key ${key}`);
      const geo = mergeGeometries(list, false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `${name}:${key}`;
      const ud = mat.userData as { noShadow?: boolean; noCast?: boolean };
      mesh.castShadow = !ud.noShadow && !ud.noCast;
      mesh.receiveShadow = !ud.noShadow;
      if (mat.transparent) mesh.renderOrder = 2;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    this.parts.clear();
    return group;
  }
}
