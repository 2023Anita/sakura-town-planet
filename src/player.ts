import * as THREE from 'three';
import type { Physics } from './physics';
import { R, terrainHeight } from './planet';

const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _m = new THREE.Matrix4();

export interface MoveInput {
  x: number; // strafe right
  z: number; // forward
  run: boolean;
  jump: boolean;
}

function toon(color: THREE.ColorRepresentation, gradient: THREE.Texture) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient });
}

/** Chibi student with a yellow safety hat and a red randoseru. Faces +Z. */
function makeCharacter(gradient: THREE.Texture) {
  const g = new THREE.Group();
  const skin = toon('#ffe0c8', gradient), navy = toon('#2c3550', gradient), white = toon('#f7f7f7', gradient);
  const hair = toon('#3b2a24', gradient), yellow = toon('#ffd21f', gradient), red = toon('#c8202b', gradient), dark = toon('#222', gradient);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const legs: THREE.Group[] = [];
  for (const sx of [-0.11, 0.11]) {
    const leg = new THREE.Group();
    leg.position.set(sx, 0.5, 0);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8).translate(0, -0.21, 0), white, 0, 0, 0, leg);
    add(new THREE.BoxGeometry(0.14, 0.09, 0.22), dark, 0, -0.45, 0.03, leg);
    g.add(leg);
    legs.push(leg);
  }
  add(new THREE.CylinderGeometry(0.2, 0.24, 0.32, 10), navy, 0, 0.6, 0); // shorts/skirt
  const body = add(new THREE.CapsuleGeometry(0.2, 0.3, 4, 10), white, 0, 0.92, 0);
  body.scale.set(1, 1, 0.85);
  add(new THREE.BoxGeometry(0.1, 0.12, 0.04), toon('#e5578a', gradient), 0, 1.05, 0.18); // ribbon
  const arms: THREE.Group[] = [];
  for (const sx of [-0.27, 0.27]) {
    const arm = new THREE.Group();
    arm.position.set(sx, 1.12, 0);
    add(new THREE.CapsuleGeometry(0.06, 0.3, 3, 6).translate(0, -0.2, 0), white, 0, 0, 0, arm);
    add(new THREE.SphereGeometry(0.065, 8, 6), skin, 0, -0.42, 0, arm);
    g.add(arm);
    arms.push(arm);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.47, 0);
  g.add(head);
  add(new THREE.SphereGeometry(0.3, 18, 14), skin, 0, 0, 0, head);
  const hairM = add(new THREE.SphereGeometry(0.315, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, 0, 0.02, -0.02, head);
  hairM.rotation.x = -0.25;
  for (const sx of [-0.1, 0.1]) {
    add(new THREE.SphereGeometry(0.045, 8, 6), dark, sx, -0.02, 0.27, head).scale.set(0.8, 1.25, 0.5);
    add(new THREE.SphereGeometry(0.04, 8, 6), toon('#ffb3c4', gradient), sx * 1.7, -0.1, 0.24, head).scale.set(1.2, 0.6, 0.4);
  }
  const hat = add(new THREE.SphereGeometry(0.34, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), yellow, 0, 0.06, 0, head);
  hat.scale.set(1, 0.82, 1);
  add(new THREE.CylinderGeometry(0.42, 0.42, 0.025, 20), yellow, 0, 0.07, 0.02, head);
  // randoseru
  add(new THREE.BoxGeometry(0.36, 0.42, 0.18), red, 0, 1.0, -0.26);
  add(new THREE.BoxGeometry(0.37, 0.2, 0.2), toon('#a8161f', gradient), 0, 1.16, -0.27);
  add(new THREE.BoxGeometry(0.06, 0.03, 0.06), toon('#d9b54a', gradient), 0, 0.98, -0.36);
  return { g, legs, arms, head };
}

export class Player {
  readonly pos = new THREE.Vector3();
  readonly fwd = new THREE.Vector3(1, 0, 0);
  readonly up = new THREE.Vector3(0, 1, 0);
  /** heading of the character model (may lag the input direction) */
  private face = new THREE.Vector3(1, 0, 0);
  private vr = 0;
  onGround = true;
  speed = 0;
  readonly model: THREE.Group;
  private rig: ReturnType<typeof makeCharacter>;
  private walkT = 0;

  private phys: Physics;

  constructor(gradient: THREE.Texture, phys: Physics) {
    this.phys = phys;
    this.rig = makeCharacter(gradient);
    this.model = this.rig.g;
  }

  teleport(p: THREE.Vector3, fwd: THREE.Vector3) {
    this.up.copy(p).normalize();
    this.pos.copy(this.up).multiplyScalar(R + terrainHeight(this.up) + 0.05);
    this.fwd.copy(fwd).addScaledVector(this.up, -fwd.dot(this.up)).normalize();
    this.face.copy(this.fwd);
    this.vr = 0;
    this.syncModel(0);
  }

  /** `yawFwd` is the camera's horizontal forward on the local tangent plane. */
  update(dt: number, input: MoveInput, yawFwd: THREE.Vector3) {
    _up.copy(this.pos).normalize();
    const fwd = yawFwd;
    _right.crossVectors(fwd, _up).normalize();
    _move.set(0, 0, 0).addScaledVector(fwd, input.z).addScaledVector(_right, input.x);
    const len = _move.length();
    const target = len > 0.01 ? (input.run ? 9 : 4.6) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    if (len > 0.01) {
      _move.divideScalar(len);
      this.face.lerp(_move, Math.min(1, dt * 12)).normalize();
    }

    const r = this.pos.length();
    if (this.speed > 0.01 && len > 0.01) this.pos.addScaledVector(_move, this.speed * dt * Math.min(1, len));

    // keep radius, resolve obstacles in the tangent plane
    this.pos.setLength(r);
    this.phys.resolve(this.pos, 0.32);

    // radial gravity toward the planet centre
    const dir = _up.copy(this.pos).normalize();
    const ground = R + terrainHeight(dir);
    const floor = this.phys.floorRadius(this.pos, ground, r);
    if (input.jump && this.onGround) {
      this.vr = 6.2;
      this.onGround = false;
    }
    this.vr -= 18 * dt;
    let nr = r + this.vr * dt;
    if (nr <= floor + 0.001) {
      // snap down gently on slopes, step up onto small ledges
      nr = floor;
      this.vr = 0;
      this.onGround = true;
    } else if (this.onGround && nr - floor < 0.35 && this.vr <= 0) {
      nr = floor;
      this.vr = 0;
    } else {
      this.onGround = false;
    }
    this.pos.copy(dir).multiplyScalar(nr);
    this.up.copy(dir);
    // parallel transport the facing vectors to the new tangent plane
    this.fwd.copy(fwd).addScaledVector(dir, -fwd.dot(dir)).normalize();
    this.face.addScaledVector(dir, -this.face.dot(dir)).normalize();
    this.syncModel(dt);
  }

  private syncModel(dt: number) {
    const z = this.face, y = this.up;
    const x = _right.crossVectors(y, z).normalize();
    _m.makeBasis(x, y, z);
    this.model.quaternion.setFromRotationMatrix(_m);
    this.model.position.copy(this.pos);

    const moving = this.speed > 0.3 && this.onGround;
    this.walkT += dt * (moving ? this.speed * 2.4 : 0);
    const s = moving ? Math.sin(this.walkT) : 0;
    const amp = Math.min(1, this.speed / 5) * 0.75;
    this.rig.legs[0].rotation.x = s * amp;
    this.rig.legs[1].rotation.x = -s * amp;
    this.rig.arms[0].rotation.x = -s * amp * 0.8;
    this.rig.arms[1].rotation.x = s * amp * 0.8;
    this.rig.head.position.y = 1.47 + Math.abs(s) * 0.04 * amp;
    if (!this.onGround) {
      this.rig.legs[0].rotation.x = 0.5;
      this.rig.legs[1].rotation.x = -0.2;
      this.rig.arms[0].rotation.x = this.rig.arms[1].rotation.x = -2.4;
    }
  }
}
