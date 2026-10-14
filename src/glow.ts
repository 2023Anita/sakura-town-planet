import * as THREE from 'three';

/** Soft additive halos for lanterns, neon and lamps — all in a single draw call. */
export class GlowPoints {
  private pos: number[] = [];
  private col: number[] = [];
  private size: number[] = [];
  private phase: number[] = [];
  material!: THREE.ShaderMaterial;

  add(p: THREE.Vector3, color: THREE.ColorRepresentation, size: number, flicker = 0) {
    const c = new THREE.Color(color);
    this.pos.push(p.x, p.y, p.z);
    this.col.push(c.r, c.g, c.b);
    this.size.push(size);
    this.phase.push(flicker > 0 ? Math.random() * 100 : -1);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.Float32BufferAttribute(this.size, 1));
    g.setAttribute('phase', new THREE.Float32BufferAttribute(this.phase, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uNight: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float phase;
        attribute vec3 color;
        uniform float uTime;
        uniform float uScale;
        varying vec3 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float f = phase < 0.0 ? 1.0 : 0.85 + 0.15 * sin(uTime * 7.0 + phase) * sin(uTime * 3.1 + phase * 1.7);
          vColor = color * f;
          gl_PointSize = clamp(size * uScale / -mv.z, 0.0, 140.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        uniform float uNight;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d) * 2.0;
          float a = pow(max(0.0, 1.0 - r), 2.2);
          gl_FragColor = vec4(vColor * a * uNight, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, this.material);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    return pts;
  }
}

interface LightSource { p: THREE.Vector3; color: THREE.Color; intensity: number; distance: number }

/**
 * A fixed pool of PointLights that hop to the light sources nearest the viewer. Keeping the
 * count constant avoids shader recompiles while still giving lanterns real light.
 */
export class LightPool {
  sources: LightSource[] = [];
  lights: THREE.PointLight[] = [];
  private timer = 0;

  constructor(count = 8) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      this.lights.push(l);
    }
  }

  add(p: THREE.Vector3, color: THREE.ColorRepresentation, intensity = 6, distance = 9) {
    this.sources.push({ p: p.clone(), color: new THREE.Color(color), intensity, distance });
  }

  update(dt: number, viewer: THREE.Vector3, force = false) {
    this.timer -= dt;
    if (this.timer > 0 && !force) return;
    this.timer = 0.35;
    const sorted = this.sources
      .map((s) => ({ s, d: s.p.distanceToSquared(viewer) }))
      .filter((e) => e.d < 45 * 45)
      .sort((a, b) => a.d - b.d);
    this.lights.forEach((l, i) => {
      const e = sorted[i];
      if (!e) {
        l.intensity = 0;
        return;
      }
      l.position.copy(e.s.p);
      l.color.copy(e.s.color);
      l.distance = e.s.distance;
      l.intensity = e.s.intensity * 0.55;
    });
  }
}
