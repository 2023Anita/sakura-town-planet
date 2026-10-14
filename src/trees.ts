import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, noise3 } from './noise';
import type { Builder } from './builder';
import type { Physics } from './physics';

type Kind = 'sakura' | 'round' | 'cedar';

function colored(g: THREE.BufferGeometry, c: THREE.ColorRepresentation, jitter = 0, rnd?: () => number) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const base = new THREE.Color(c);
  const tmp = new THREE.Color();
  for (let i = 0; i < n; i += 3) {
    const k = rnd ? (rnd() - 0.5) * jitter : 0;
    tmp.copy(base).offsetHSL(0, 0, k);
    for (let j = 0; j < 3; j++) col.set([tmp.r, tmp.g, tmp.b], (i + j) * 3);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function trunkGeo(rnd: () => number, kind: Kind) {
  const parts: THREE.BufferGeometry[] = [];
  const bark = kind === 'sakura' ? 0x5b4038 : 0x6a4d3a;
  const h = kind === 'cedar' ? 2.2 : 2.6;
  const t = new THREE.CylinderGeometry(0.17, 0.3, h, 7);
  t.translate(0, h / 2 - 0.2, 0);
  parts.push(colored(t, bark));
  if (kind === 'sakura') {
    for (let i = 0; i < 4; i++) {
      const len = 1.5 + rnd() * 0.9;
      const b = new THREE.CylinderGeometry(0.06, 0.13, len, 5);
      b.translate(0, len / 2, 0);
      b.rotateZ(0.6 + rnd() * 0.35);
      b.rotateY((i / 4) * Math.PI * 2 + rnd() * 0.6);
      b.translate(0, 2.0 + rnd() * 0.4, 0);
      parts.push(colored(b, bark));
    }
  }
  return mergeGeometries(parts)!;
}

function canopyGeo(rnd: () => number, kind: Kind) {
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'cedar') {
    for (let i = 0; i < 3; i++) {
      const c = new THREE.ConeGeometry(1.6 - i * 0.4, 2.2, 8);
      c.translate(0, 2.6 + i * 1.3, 0);
      parts.push(colored(c, 0x3f6b4a, 0.06, rnd));
    }
    return mergeGeometries(parts)!;
  }
  const blobs = kind === 'sakura' ? 8 : 6;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rnd();
    const rr = i === 0 ? 0 : 1.1 + rnd() * 0.9;
    const s = (kind === 'sakura' ? 1.2 : 1.05) + rnd() * 0.6;
    const base = new THREE.IcosahedronGeometry(s, 1);
    base.deleteAttribute('normal');
    base.deleteAttribute('uv');
    const g = mergeVertices(base);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const seed = rnd() * 100;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      const k = 1 + (noise3(x * 1.7 + seed, y * 1.7, z * 1.7) - 0.5) * 0.45;
      pos.setXYZ(v, x * k, y * k * 0.8, z * k);
    }
    g.computeVertexNormals();
    const y = 3.4 + rnd() * 1.1 + (i === 0 ? 0.9 : 0);
    g.translate(Math.cos(a) * rr, y, Math.sin(a) * rr);
    const color = kind === 'sakura'
      ? new THREE.Color().setHSL(0.94 + rnd() * 0.03, 0.75, 0.8 + (y - 3.4) * 0.04)
      : new THREE.Color().setHSL(0.26 + rnd() * 0.05, 0.42, 0.42 + rnd() * 0.08);
    parts.push(colored(g, color, 0.07, rnd));
  }
  return mergeGeometries(parts)!;
}

/** All trees on the planet: one InstancedMesh per kind and part. */
export class Trees {
  private mats: Record<Kind, THREE.Matrix4[]> = { sakura: [], round: [], cedar: [] };
  private rnd = mulberry32(99);

  private builder: Builder;
  private phys: Physics;

  constructor(builder: Builder, phys: Physics) {
    this.builder = builder;
    this.phys = phys;
  }

  add(kind: Kind, M: THREE.Matrix4, scale = 1, petals = kind === 'sakura') {
    const m = M.clone().multiply(new THREE.Matrix4().makeRotationY(this.rnd() * Math.PI * 2)).multiply(new THREE.Matrix4().makeScale(scale, scale * (0.9 + this.rnd() * 0.2), scale));
    this.mats[kind].push(m);
    this.phys.circle(M, 0, 0, 0.35 * scale, 3);
    if (petals) {
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = this.rnd() * Math.PI * 2, r = this.rnd() * 2.2 * scale;
        const s = (2.2 + this.rnd() * 1.6) * scale;
        this.builder.quad(M, Math.cos(a) * r, 0.06 + i * 0.004, Math.sin(a) * r, s, s, null, { key: 'petals', rx: -Math.PI / 2, ry: this.rnd() * 6 });
      }
    }
  }

  /** One InstancedMesh per tree kind per sphere cell, so cells past the horizon can be culled. */
  build(gradient: THREE.Texture) {
    const group = new THREE.Group();
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
    // Petal canopies scatter light: lift their shadowed side so backlit sakura stay pink.
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * 0.2;');
    };
    const rnd = mulberry32(5);
    const p = new THREE.Vector3();
    const tint = new THREE.Color();
    for (const kind of Object.keys(this.mats) as Kind[]) {
      const list = this.mats[kind];
      if (!list.length) continue;
      const geo = mergeGeometries([trunkGeo(rnd, kind), canopyGeo(rnd, kind)])!;
      const cells = new Map<string, THREE.Matrix4[]>();
      for (const m of list) {
        p.setFromMatrixPosition(m).normalize();
        const lat = Math.floor((Math.asin(p.y) / Math.PI + 0.5) * 8);
        const lon = Math.floor(((Math.atan2(p.x, p.z) / Math.PI + 1) / 2) * 16);
        const k = `${lat}:${lon}`;
        let c = cells.get(k);
        if (!c) cells.set(k, (c = []));
        c.push(m);
      }
      for (const [k, ms] of cells) {
        const mesh = new THREE.InstancedMesh(geo, mat, ms.length);
        ms.forEach((m, i) => {
          mesh.setMatrixAt(i, m);
          tint.setHSL(0, 0, 0.9 + rnd() * 0.12);
          mesh.setColorAt(i, tint);
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        mesh.name = `trees:${kind}:${k}`;
        group.add(mesh);
      }
    }
    return group;
  }
}
