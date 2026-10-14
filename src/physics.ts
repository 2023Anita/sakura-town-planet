import * as THREE from 'three';

interface Solid {
  c: THREE.Vector3;
  up: THREE.Vector3;
  ax: THREE.Vector3;
  az: THREE.Vector3;
  hx: number;
  hz: number;
  /** circle radius when > 0 (then hx/hz unused) */
  r: number;
  top: number;
  reach: number;
}

const _v = new THREE.Vector3();
const _c = new THREE.Vector3();

/**
 * Collision on a sphere: every obstacle is a box or circle living in the tangent plane at its
 * own position, so obstacles anywhere on the planet behave the same way.
 */
export class Physics {
  solids: Solid[] = [];
  floors: Solid[] = [];
  /** regions where the follow camera should stay close (interiors) */
  interiors: Solid[] = [];

  private make(M: THREE.Matrix4, x: number, z: number, hx: number, hz: number, top: number, r = 0): Solid {
    const c = new THREE.Vector3(x, 0, z).applyMatrix4(M);
    const e = M.elements;
    const ax = new THREE.Vector3(e[0], e[1], e[2]).normalize();
    const up = new THREE.Vector3(e[4], e[5], e[6]).normalize();
    const az = new THREE.Vector3(e[8], e[9], e[10]).normalize();
    return { c, up, ax, az, hx, hz, r, top, reach: (r || Math.hypot(hx, hz)) + 1.5 };
  }

  /** Box footprint centred at local (x, z) in M, half extents hx/hz, height top. */
  box(M: THREE.Matrix4, x: number, z: number, hx: number, hz: number, top = 10) {
    this.solids.push(this.make(M, x, z, hx, hz, top));
  }

  circle(M: THREE.Matrix4, x: number, z: number, r: number, top = 10) {
    this.solids.push(this.make(M, x, z, 0, 0, top, r));
  }

  floor(M: THREE.Matrix4, x: number, z: number, hx: number, hz: number, top: number) {
    this.floors.push(this.make(M, x, z, hx, hz, top));
  }

  interior(M: THREE.Matrix4, x: number, z: number, hx: number, hz: number) {
    this.interiors.push(this.make(M, x, z, hx, hz, 4));
  }

  private inside(s: Solid, p: THREE.Vector3, pad: number) {
    _v.subVectors(p, s.c);
    const lx = _v.dot(s.ax), lz = _v.dot(s.az);
    return Math.abs(lx) < s.hx + pad && Math.abs(lz) < s.hz + pad;
  }

  /** Radius of the walkable floor under p if any floor is within step height. */
  floorRadius(p: THREE.Vector3, groundR: number, currentR: number, step = 0.55) {
    let best = groundR;
    for (const f of this.floors) {
      if (_v.subVectors(p, f.c).lengthSq() > f.reach * f.reach) continue;
      if (!this.inside(f, p, 0)) continue;
      const fr = f.c.length() + f.top;
      if (fr <= currentR + step && fr > best) best = fr;
    }
    return best;
  }

  isInterior(p: THREE.Vector3) {
    for (const s of this.interiors) {
      if (_v.subVectors(p, s.c).lengthSq() > s.reach * s.reach) continue;
      if (this.inside(s, p, 0)) return true;
    }
    return false;
  }

  /** Pushes p out of all solids (modifies p). */
  resolve(p: THREE.Vector3, radius = 0.35) {
    for (let iter = 0; iter < 2; iter++) {
      for (const s of this.solids) {
        _v.subVectors(p, s.c);
        if (_v.lengthSq() > (s.reach + radius) ** 2) continue;
        const h = _v.dot(s.up);
        if (h > s.top || h < -3) continue;
        if (s.r > 0) {
          _c.copy(_v).addScaledVector(s.up, -h);
          const d = _c.length();
          const min = s.r + radius;
          if (d < min && d > 1e-6) p.addScaledVector(_c, (min - d) / d);
          continue;
        }
        const lx = _v.dot(s.ax), lz = _v.dot(s.az);
        const px = s.hx + radius - Math.abs(lx);
        const pz = s.hz + radius - Math.abs(lz);
        if (px > 0 && pz > 0) {
          if (px < pz) p.addScaledVector(s.ax, Math.sign(lx || 1) * px);
          else p.addScaledVector(s.az, Math.sign(lz || 1) * pz);
        }
      }
    }
    return p;
  }
}
