import * as THREE from 'three';
import { Frame, addShaper, dirFromLatLon, geoDist } from '../planet';
import { smoothstep } from '../noise';

export interface ZoneMeta {
  id: string;
  jp: string;
  en: string;
  frame: Frame;
  /** local spawn point and facing (radians, 0 = frame forward) */
  spawn: { x: number; z: number; yaw: number };
  /** rough radius used for "you are here" detection */
  radius: number;
  center: THREE.Vector3;
}

export const PARK_H = 3;
export const PARK_R = 15;

export const F = {
  school: Frame.at(0, 0, 0),
  shopping: Frame.at(0, 55, 0),
  station: Frame.at(-13.5, 28, 0),
  yokocho: Frame.at(-15.8, 112, -90),
  approach: Frame.toward(dirFromLatLon(4.3, -150), dirFromLatLon(32, -118)),
  park: new Frame(dirFromLatLon(32, -118), dirFromLatLon(32, -118).sub(dirFromLatLon(4.3, -150))),
};

export const APPROACH_LEN = geoDist(F.approach.n, F.park.n) - PARK_R + 1;

export function approachHeight(z: number) {
  return PARK_H * smoothstep(APPROACH_LEN * 0.3, APPROACH_LEN - 3, z);
}

addShaper({ frame: F.school, x0: -16, x1: 36, z0: -32, z1: 32, blend: 12, height: () => 0 });
addShaper({ frame: F.shopping, x0: -15, x1: 15, z0: -36, z1: 36, blend: 10, height: () => 0 });
addShaper({ frame: F.station, x0: -9, x1: 9, z0: -30, z1: 30, blend: 10, height: () => 0 });
addShaper({ frame: F.yokocho, x0: -9, x1: 9, z0: -18, z1: 18, blend: 10, height: () => 0 });
addShaper({ frame: F.park, x0: -PARK_R - 2, x1: PARK_R + 2, z0: -PARK_R - 2, z1: PARK_R + 2, blend: 9, height: () => PARK_H });
addShaper({ frame: F.approach, x0: -8, x1: 8, z0: -2, z1: APPROACH_LEN + 1, blend: 8, height: (_x, z) => approachHeight(z) });

export const ZONES: ZoneMeta[] = [
  { id: 'school', jp: '県立ひばりが丘高等学校', en: 'School gate · spring entrance day', frame: F.school, spawn: { x: -1.5, z: -14, yaw: 0.5 }, radius: 30, center: F.school.dirAt(8, 0) },
  { id: 'shopping', jp: 'ひばりが丘商店街', en: 'Shopping street at dusk', frame: F.shopping, spawn: { x: 0, z: -36, yaw: 0 }, radius: 34, center: F.shopping.n.clone() },
  { id: 'yokocho', jp: 'ひばり横丁', en: 'Night alley · lanterns & neon', frame: F.yokocho, spawn: { x: 0, z: -19, yaw: 0 }, radius: 20, center: F.yokocho.n.clone() },
  { id: 'approach', jp: 'ひばり神社 参道', en: 'Shrine approach · torii & tōrō', frame: F.approach, spawn: { x: 0, z: -3, yaw: 0 }, radius: 22, center: F.approach.dirAt(0, APPROACH_LEN / 2) },
  { id: 'park', jp: 'さくら見晴らし公園', en: 'Shrine park overlook · sakura ring', frame: F.park, spawn: { x: 1.5, z: -7.5, yaw: -0.15 }, radius: 17, center: F.park.n.clone() },
  { id: 'train', jp: 'ひばりが丘駅', en: 'Station & train car (bonus)', frame: F.station, spawn: { x: 3, z: -10, yaw: 0 }, radius: 18, center: F.station.n.clone() },
];

/** True when dir is inside any zone footprint (plus margin) — keeps filler out. */
const rects: { f: Frame; x0: number; x1: number; z0: number; z1: number }[] = [
  { f: F.school, x0: -16, x1: 36, z0: -32, z1: 32 },
  { f: F.shopping, x0: -15, x1: 15, z0: -36, z1: 36 },
  { f: F.station, x0: -9, x1: 9, z0: -30, z1: 30 },
  { f: F.yokocho, x0: -9, x1: 9, z0: -18, z1: 18 },
  { f: F.park, x0: -PARK_R - 2, x1: PARK_R + 2, z0: -PARK_R - 2, z1: PARK_R + 2 },
  { f: F.approach, x0: -8, x1: 8, z0: -2, z1: APPROACH_LEN + 1 },
];
export function inZone(dir: THREE.Vector3, margin = 3) {
  for (const r of rects) {
    if (dir.dot(r.f.n) < 0.6) continue;
    const { x, z } = r.f.local(dir);
    if (x > r.x0 - margin && x < r.x1 + margin && z > r.z0 - margin && z < r.z1 + margin) return true;
  }
  return false;
}
