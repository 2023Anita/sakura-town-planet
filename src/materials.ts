import * as THREE from 'three';
import {
  SignAtlas, asphaltRoadTexture, dirtTexture, gravelTexture, paverTexture, petalScatterTexture,
  radialTexture, streakTexture, tileTexture, toonGradient, wetStoneTexture,
} from './textures';

export interface World {
  atlas: SignAtlas;
  gradient: THREE.DataTexture;
  mats: Record<string, THREE.Material>;
}

function flags<T extends THREE.Material>(m: T, f: { noShadow?: boolean; noCast?: boolean }) {
  Object.assign(m.userData, f);
  return m;
}

export function createMaterials(): World {
  const atlas = new SignAtlas();
  const gradient = toonGradient();
  const radial = radialTexture();
  const streak = streakTexture();

  const toon = (o: THREE.MeshToonMaterialParameters = {}) => new THREE.MeshToonMaterial({ gradientMap: gradient, ...o });
  const additive = (map: THREE.Texture, side: THREE.Side = THREE.FrontSide) =>
    flags(new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side, fog: false }), { noShadow: true });
  const ground = (map: THREE.Texture, extra: THREE.MeshToonMaterialParameters = {}) =>
    flags(toon({ map, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra }), { noCast: true });

  const mats: Record<string, THREE.Material> = {
    toon: toon({ vertexColors: true }),
    toon2: toon({ vertexColors: true, side: THREE.DoubleSide }),
    glow: flags(new THREE.MeshBasicMaterial({ vertexColors: true }), { noCast: true }),
    signs: toon({ map: atlas.texture, vertexColors: true }),
    neon: flags(new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true }), { noCast: true }),
    add: additive(radial),
    addDouble: additive(radial, THREE.DoubleSide),
    streak: additive(streak),
    shaft: additive(streak, THREE.DoubleSide),
    petals: flags(toon({ map: petalScatterTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, vertexColors: true }), { noCast: true }),
    road: ground(asphaltRoadTexture()),
    sidewalk: ground(tileTexture('#c9c3bb', '#9f988f', 4, 5)),
    pavers: ground(paverTexture()),
    gravel: ground(gravelTexture()),
    dirt: ground(dirtTexture()),
    stoneSlab: ground(tileTexture('#b7b0a6', '#7f786f', 2, 8, 22)),
    wet: flags(new THREE.MeshStandardMaterial({
      map: wetStoneTexture(), roughness: 0.18, metalness: 0.2,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }), { noCast: true }),
  };
  return { atlas, gradient, mats };
}
