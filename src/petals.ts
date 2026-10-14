import * as THREE from 'three';
import { petalTexture } from './textures';

interface P { x: number; y: number; z: number; vx: number; vz: number; fall: number; rot: THREE.Euler; spin: THREE.Vector3; phase: number }

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _basis = new THREE.Matrix4();
const _right = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/** Falling sakura petals that drift around the viewer, in the viewer's local tangent frame. */
export class Petals {
  readonly mesh: THREE.InstancedMesh;
  private ps: P[] = [];
  private span = 26;
  private height = 12;

  constructor(count = 700) {
    const geo = new THREE.PlaneGeometry(0.11, 0.11);
    const mat = new THREE.MeshBasicMaterial({ map: petalTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: true, fog: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) this.ps.push(this.spawn(true));
  }

  private spawn(initial: boolean): P {
    const s = this.span;
    return {
      x: (Math.random() - 0.5) * s * 2,
      z: (Math.random() - 0.5) * s * 2,
      y: initial ? Math.random() * this.height : this.height * (0.8 + Math.random() * 0.3),
      vx: 0.4 + Math.random() * 0.5,
      vz: (Math.random() - 0.5) * 0.6,
      fall: 0.55 + Math.random() * 0.5,
      rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      spin: new THREE.Vector3(Math.random() * 3, Math.random() * 2, Math.random() * 3),
      phase: Math.random() * 10,
    };
  }

  /**
   * Petals live in a box around `center` (local frame: up = outward). As the viewer walks, the
   * box is re-centred and petals that fall out are wrapped to the opposite side.
   */
  update(dt: number, t: number, center: THREE.Vector3, up: THREE.Vector3, moved: THREE.Vector3) {
    _fwd.set(0, 0, 1).addScaledVector(up, -up.z);
    if (_fwd.lengthSq() < 1e-4) _fwd.set(1, 0, 0).addScaledVector(up, -up.x);
    _fwd.normalize();
    _right.crossVectors(up, _fwd);
    _basis.makeBasis(_right, up, _fwd);
    const mx = moved.dot(_right), mz = moved.dot(_fwd);
    const s = this.span;
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      p.x += (p.vx + Math.sin(t * 0.9 + p.phase) * 0.5) * dt - mx;
      p.z += (p.vz + Math.cos(t * 0.7 + p.phase) * 0.3) * dt - mz;
      p.y -= p.fall * dt;
      if (p.x > s) p.x -= 2 * s;
      if (p.x < -s) p.x += 2 * s;
      if (p.z > s) p.z -= 2 * s;
      if (p.z < -s) p.z += 2 * s;
      if (p.y < -0.5) Object.assign(p, this.spawn(false), { x: p.x, z: p.z });
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      // drop with curvature so the box hugs the sphere
      const d2 = (p.x * p.x + p.z * p.z) / (2 * 80);
      _p.set(p.x, p.y - d2, p.z).applyMatrix4(_basis).add(center);
      _q.setFromEuler(p.rot);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
