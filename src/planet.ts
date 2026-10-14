import * as THREE from 'three';
import { fbm3, lerp, smoothstep } from './noise';

/** Planet radius in metres. Small on purpose: you can see the curvature from street level. */
export const R = 80;

const DEG = Math.PI / 180;

/** Unit direction for latitude / longitude in degrees. lon=0 faces +Z, lat=90 is +Y. */
export function dirFromLatLon(lat: number, lon: number, out = new THREE.Vector3()) {
  const la = lat * DEG, lo = lon * DEG;
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

/** The sun is fixed in space; zones are laid out so they sit at noon, dusk, night and dawn. */
export const SUN_DIR = dirFromLatLon(25, -30);

export function dayFactor(dir: THREE.Vector3) {
  return dir.dot(SUN_DIR);
}

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/**
 * A local tangent frame on the sphere. Local coordinates: x = right, z = forward, y = up (outward).
 * Positions are mapped with the exponential map so distances on the surface stay true.
 */
export class Frame {
  readonly n: THREE.Vector3;
  readonly fwd: THREE.Vector3;
  readonly right: THREE.Vector3;

  constructor(n: THREE.Vector3, fwdHint: THREE.Vector3) {
    this.n = n.clone().normalize();
    const f = fwdHint.clone().addScaledVector(this.n, -fwdHint.dot(this.n));
    if (f.lengthSq() < 1e-8) f.set(1, 0, 0).addScaledVector(this.n, -this.n.x);
    this.fwd = f.normalize();
    this.right = new THREE.Vector3().crossVectors(this.n, this.fwd).normalize();
  }

  /** heading 0 = east, 90 = north. */
  static at(lat: number, lon: number, heading = 0) {
    const n = dirFromLatLon(lat, lon);
    const lo = lon * DEG, la = lat * DEG, h = heading * DEG;
    const east = new THREE.Vector3(Math.cos(lo), 0, -Math.sin(lo));
    const north = new THREE.Vector3(-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo));
    return new Frame(n, east.multiplyScalar(Math.cos(h)).addScaledVector(north, Math.sin(h)));
  }

  /** Frame at `a` whose forward points along the great circle towards `b`. */
  static toward(a: THREE.Vector3, b: THREE.Vector3) {
    return new Frame(a, b.clone().sub(a));
  }

  /** Frame translated to local (x, z), forward parallel-transported. */
  sub(x: number, z: number, rotY = 0) {
    const d = this.dirAt(x, z);
    _q.setFromUnitVectors(this.n, d);
    const f = this.fwd.clone().applyQuaternion(_q);
    const r = this.right.clone().applyQuaternion(_q);
    const fr = f.multiplyScalar(Math.cos(rotY)).addScaledVector(r, Math.sin(rotY));
    return new Frame(d, fr);
  }

  dirAt(x: number, z: number, out = new THREE.Vector3()) {
    const dist = Math.hypot(x, z);
    if (dist < 1e-9) return out.copy(this.n);
    const a = dist / R;
    _v.copy(this.right).multiplyScalar(x / dist).addScaledVector(this.fwd, z / dist);
    return out.copy(this.n).multiplyScalar(Math.cos(a)).addScaledVector(_v, Math.sin(a)).normalize();
  }

  /** Inverse of dirAt (valid within ~a quarter of the planet). */
  local(dir: THREE.Vector3) {
    const c = THREE.MathUtils.clamp(dir.dot(this.n), -1, 1);
    const a = Math.acos(c);
    _v2.copy(dir).addScaledVector(this.n, -c);
    const len = _v2.length();
    if (len < 1e-9) return { x: 0, z: 0 };
    return { x: (a * R * _v2.dot(this.right)) / len, z: (a * R * _v2.dot(this.fwd)) / len };
  }

  /** World position at local (x, z) resting on the terrain, plus y metres up. */
  point(x: number, z: number, y = 0, out = new THREE.Vector3()) {
    const d = this.dirAt(x, z, out);
    return d.multiplyScalar(R + terrainHeight(d) + y);
  }

  /**
   * Object matrix at local (x, z): +Y = outward normal, +Z = frame forward (parallel transported),
   * rotated by rotY around the local up. `baseH` overrides the terrain height under the origin.
   */
  matrix(x: number, z: number, rotY = 0, y = 0, baseH?: number, out = new THREE.Matrix4()) {
    const d = this.dirAt(x, z);
    _q.setFromUnitVectors(this.n, d);
    const f = this.fwd.clone().applyQuaternion(_q);
    const r = this.right.clone().applyQuaternion(_q);
    const h = baseH ?? terrainHeight(d);
    out.makeBasis(r, d, f);
    out.setPosition(d.clone().multiplyScalar(R + h + y));
    if (rotY !== 0) out.multiply(new THREE.Matrix4().makeRotationY(rotY));
    return out;
  }

  /** Lowest terrain height over a rotated footprint — used so buildings never float on slopes. */
  minHeight(x: number, z: number, w: number, d: number, rotY = 0) {
    let m = Infinity;
    const c = Math.cos(rotY), s = Math.sin(rotY);
    for (const [ax, az] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = (ax * w) / 2, lz = (az * d) / 2;
      const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
      m = Math.min(m, terrainHeight(this.dirAt(px, pz)));
    }
    return m;
  }
}

/* ---------------- terrain ---------------- */

export interface Shaper {
  frame: Frame;
  x0: number; x1: number; z0: number; z1: number;
  blend: number;
  height: (x: number, z: number) => number;
}

const shapers: Shaper[] = [];
export function addShaper(s: Shaper) {
  shapers.push(s);
}

/** Half-width (m) of the flattened band around the equator that carries the ring road. */
export const ROAD_BAND = 6;

export function terrainHeight(d: THREE.Vector3): number {
  let h = (fbm3(d.x * 2.6 + 11, d.y * 2.6, d.z * 2.6 - 4, 4) - 0.42) * 16;
  h += (fbm3(d.x * 9, d.y * 9, d.z * 9, 2) - 0.5) * 1.2;
  h = Math.max(h, -2.5 + (h + 2.5) * 0.3);

  const latM = Math.abs(Math.asin(THREE.MathUtils.clamp(d.y, -1, 1))) * R;
  const wRoad = 1 - smoothstep(ROAD_BAND, ROAD_BAND + 12, latM);
  h = lerp(h, 0, wRoad);

  for (const s of shapers) {
    if (d.dot(s.frame.n) < 0.6) continue;
    const { x, z } = s.frame.local(d);
    const cx = Math.min(Math.max(x, s.x0), s.x1);
    const cz = Math.min(Math.max(z, s.z0), s.z1);
    const dist = Math.hypot(x - cx, z - cz);
    if (dist >= s.blend) continue;
    const w = 1 - smoothstep(0, s.blend, dist);
    h = lerp(h, s.height(cx, cz), w);
  }
  return h;
}

export function surfacePoint(d: THREE.Vector3, y = 0, out = new THREE.Vector3()) {
  return out.copy(d).normalize().multiplyScalar(R + terrainHeight(d) + y);
}

/** Geodesic distance in metres between two unit directions. */
export function geoDist(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) * R;
}
