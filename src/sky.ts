import * as THREE from 'three';
import { mulberry32, smoothstep } from './noise';
import { R, SUN_DIR } from './planet';

const C = (h: string) => new THREE.Color(h);
const DAY = { zen: C('#5fa8f0'), hor: C('#d9efff') };
const DUSK = { zen: C('#4a4f9e'), hor: C('#ffa27c') };
const NIGHT = { zen: C('#040820'), hor: C('#1b2452') };

/** Sky colours for a given local day factor (dot of local up with the sun). */
export function skyColors(day: number) {
  const zen = new THREE.Color(), hor = new THREE.Color();
  if (day > 0.15) {
    const t = smoothstep(0.15, 0.55, day);
    zen.copy(DUSK.zen).lerp(DAY.zen, t);
    hor.copy(DUSK.hor).lerp(DAY.hor, t);
  } else {
    const t = smoothstep(-0.35, 0.15, day);
    zen.copy(NIGHT.zen).lerp(DUSK.zen, t);
    hor.copy(NIGHT.hor).lerp(DUSK.hor, t);
  }
  return { zen, hor };
}

export class Sky {
  readonly group = new THREE.Group();
  readonly dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  readonly atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;

  constructor() {
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uUp: { value: new THREE.Vector3(0, 1, 0) },
          uSun: { value: SUN_DIR.clone() },
          uZen: { value: new THREE.Color() },
          uHor: { value: new THREE.Color() },
          uSpace: { value: 0 },
          uDay: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
            vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uUp, uSun, uZen, uHor;
          uniform float uSpace, uDay;
          varying vec3 vDir;
          void main() {
            vec3 v = normalize(vDir);
            float h = dot(v, uUp);
            vec3 sky = mix(uHor, uZen, smoothstep(-0.15, 0.55, h));
            float s = max(dot(v, uSun), 0.0);
            float dusk = 1.0 - smoothstep(0.1, 0.6, abs(uDay));
            sky = mix(sky, vec3(1.0, 0.52, 0.42), dusk * (1.0 - smoothstep(-0.05, 0.4, h)) * 0.55);
            sky += vec3(1.0, 0.6, 0.35) * pow(s, 6.0) * 0.6 * dusk;
            sky += vec3(1.0, 0.95, 0.8) * (pow(s, 900.0) * 6.0 + pow(s, 60.0) * 0.25);
            vec3 space = vec3(0.004, 0.006, 0.018) + vec3(1.0, 0.95, 0.85) * (pow(s, 1500.0) * 12.0 + pow(s, 40.0) * 0.08);
            gl_FragColor = vec4(mix(sky, space, uSpace), 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.group.add(this.dome);

    const rnd = mulberry32(8);
    const n = 3500;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (v.lengthSq() < 0.01) v.set(0, 1, 0);
      v.normalize().multiplyScalar(850);
      pos.set([v.x, v.y, v.z], i * 3);
      c.setHSL(0.55 + rnd() * 0.15 - (rnd() < 0.2 ? 0.5 : 0), 0.5, 0.65 + rnd() * 0.35);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    this.group.add(this.stars);

    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.16, 64, 32),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uSun: { value: SUN_DIR.clone() }, uOpacity: { value: 1 } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vView; varying vec3 vWorld;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = normalize(w.xyz);
            vN = normalize(mat3(modelMatrix) * normal);
            vView = normalize(cameraPosition - w.xyz);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun; uniform float uOpacity;
          varying vec3 vN; varying vec3 vView; varying vec3 vWorld;
          void main() {
            float rim = pow(1.0 - abs(dot(vN, vView)), 2.0);
            float edge = smoothstep(0.0, 0.35, abs(dot(vN, vView)));
            float lit = smoothstep(-0.35, 0.4, dot(vWorld, uSun));
            vec3 col = mix(vec3(0.15, 0.12, 0.45), vec3(0.45, 0.7, 1.0), lit);
            col = mix(col, vec3(1.0, 0.55, 0.6), (1.0 - abs(dot(vWorld, uSun) * 2.0 - 0.2)) * 0.35 * lit);
            gl_FragColor = vec4(col * rim * edge * 1.6 * uOpacity, 1.0);
          }`,
      }),
    );
    this.atmosphere.renderOrder = 1;
  }

  update(camera: THREE.Camera, up: THREE.Vector3, day: number, space: number) {
    this.group.position.copy(camera.position);
    const u = this.dome.material.uniforms;
    u.uUp.value.copy(up);
    const { zen, hor } = skyColors(day);
    u.uZen.value.copy(zen);
    u.uHor.value.copy(hor);
    u.uSpace.value = space;
    u.uDay.value = day;
    this.stars.material.opacity = Math.max(space, 1 - smoothstep(-0.25, 0.12, day)) * 0.95;
    this.atmosphere.material.uniforms.uOpacity.value = smoothstep(0.05, 0.6, space);
  }
}
