import type {
  CloudData,
  DamageRecord,
  DamageType,
  Footprint,
  InspectionDataset,
  InspectionMeta,
  TemporalEntry,
} from "../types";

/** Deterministic PRNG so the demo scene is stable across reloads. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DamageSpec {
  id: string;
  type: DamageType;
  confidence: number;
  theta: number; // angular position on tube wall
  x: number; // axial position
  spread: number;
  count: number;
  length: number;
  prevLength: number | null;
}

export { TUNNEL_SPECS };
export type { DamageSpec };

const TUNNEL_SPECS: DamageSpec[] = [
  { id: "D-001", type: "crack", confidence: 0.94, theta: 0.7, x: -6.5, spread: 0.28, count: 900, length: 1.24, prevLength: 0.8 },
  { id: "D-002", type: "crack", confidence: 0.88, theta: 2.4, x: 3.2, spread: 0.22, count: 700, length: 0.86, prevLength: 0.61 },
  { id: "D-003", type: "spalling", confidence: 0.91, theta: 1.5, x: -1.0, spread: 0.35, count: 1100, length: 0.64, prevLength: 0.5 },
  { id: "D-004", type: "corrosion", confidence: 0.83, theta: 4.4, x: 7.8, spread: 0.4, count: 1000, length: 0.52, prevLength: null },
  { id: "D-005", type: "crack", confidence: 0.77, theta: 5.3, x: -11.0, spread: 0.2, count: 600, length: 0.43, prevLength: 0.4 },
  { id: "D-006", type: "surface_damage", confidence: 0.71, theta: 3.3, x: 11.5, spread: 0.45, count: 800, length: 0.71, prevLength: null },
  { id: "D-007", type: "spalling", confidence: 0.86, theta: 0.15, x: 6.0, spread: 0.3, count: 950, length: 0.58, prevLength: 0.44 },
  { id: "D-008", type: "corrosion", confidence: 0.79, theta: 2.9, x: -9.2, spread: 0.33, count: 850, length: 0.47, prevLength: 0.39 },
];

const RADIUS = 4.5;
const AXIS_Y = 3.0;
const LENGTH = 30;

function wallPoint(theta: number, x: number): [number, number, number] {
  return [x, AXIS_Y + RADIUS * Math.sin(theta), RADIUS * Math.cos(theta)];
}

/** Procedural tunnel tube + floor, concrete-gray with stains. */
export function generateTunnelCloud(seed = 7, wallCount = 38000, floorCount = 9000): CloudData {
  const rand = mulberry32(seed);
  const total = wallCount + floorCount;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  let k = 0;
  const paint = (x: number, y: number, z: number, base: number, jitter: number) => {
    positions[k * 3] = x;
    positions[k * 3 + 1] = y;
    positions[k * 3 + 2] = z;
    const v = Math.max(60, Math.min(225, base + (rand() - 0.5) * jitter));
    const warm = rand() < 0.12 ? -18 : 0; // damp stains
    colors[k * 3] = v + warm;
    colors[k * 3 + 1] = v + warm;
    colors[k * 3 + 2] = v + warm * 0.5;
    k++;
  };
  for (let i = 0; i < wallCount; i++) {
    const theta = rand() * Math.PI * 2;
    const x = (rand() - 0.5) * LENGTH;
    const r = RADIUS + (rand() - 0.5) * 0.12;
    paint(x, AXIS_Y + r * Math.sin(theta), r * Math.cos(theta), 168, 26);
  }
  for (let i = 0; i < floorCount; i++) {
    paint((rand() - 0.5) * LENGTH, 0.02 + rand() * 0.05, (rand() - 0.5) * 9, 148, 30);
  }
  return { positions, colors, count: total };
}

/** Damage footprint clusters pasted onto the tube wall + matching records. */
export function generateTunnelDamages(
  seed = 7,
  specs: DamageSpec[] = TUNNEL_SPECS,
  sourceNames?: string[],
): { damages: DamageRecord[]; footprints: Footprint[] } {
  const rand = mulberry32(seed + 1000);
  const damages: DamageRecord[] = [];
  const footprints: Footprint[] = [];
  for (const s of specs) {
    const [cx, cy, cz] = wallPoint(s.theta, s.x);
    const pos = new Float32Array(s.count * 3);
    for (let i = 0; i < s.count; i++) {
      // elongated along the tube axis for cracks, blob otherwise
      const ax = (rand() - 0.5) * s.spread * (s.type === "crack" ? 6 : 2);
      const th = s.theta + (rand() - 0.5) * s.spread * (s.type === "crack" ? 0.6 : 2);
      const rr = RADIUS + 0.03 + rand() * 0.05;
      pos[i * 3] = s.x + ax;
      pos[i * 3 + 1] = AXIS_Y + rr * Math.sin(th);
      pos[i * 3 + 2] = rr * Math.cos(th);
    }
    footprints.push({ damageId: s.id, type: s.type, positions: pos });
    const n = damages.length;
    damages.push({
      id: s.id,
      type: s.type,
      confidence: s.confidence,
      location: { x: +cx.toFixed(3), y: +cy.toFixed(3), z: +cz.toFixed(3) },
      length: s.length,
      inspectionDate: "2026-10-01",
      sourceImages: sourceNames?.length
        ? [sourceNames[n % sourceNames.length], sourceNames[(n + 1) % sourceNames.length]]
        : [`IMG_${String(40 + n).padStart(3, "0")}`, `IMG_${String(47 + n).padStart(3, "0")}`],
      numObservations: 2 + Math.floor(rand() * 3),
      num3dPoints: s.count,
    });
  }
  return { damages, footprints };
}

export function generateCameras(n = 10): number[][] {
  const cams: number[][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    cams.push([Math.cos(t) * 9, 2.2 + Math.sin(t * 2) * 0.8, Math.sin(t) * 9]);
  }
  return cams;
}

function toTemporal(damages: DamageRecord[], specs: DamageSpec[]): TemporalEntry[] {
  return damages.map((d, i) => {
    const spec = specs[i];
    if (spec.prevLength == null) {
      return { prevId: null, currId: d.id, type: d.type, lenPrev: null, lenCurr: d.length, growth: null, status: "new" as const };
    }
    return {
      prevId: `D-${String(i + 1).padStart(3, "0")}`,
      currId: d.id,
      type: d.type,
      lenPrev: spec.prevLength,
      lenCurr: d.length,
      growth: +(d.length - spec.prevLength).toFixed(2),
      status: "persisted" as const,
    };
  });
}

function buildDataset(
  key: string,
  meta: InspectionMeta,
  seed: number,
): InspectionDataset {
  const cloud = generateTunnelCloud(seed);
  const { damages, footprints } = generateTunnelDamages(seed);
  return { key, meta, damages, cloud, footprints, cameras: generateCameras(), temporal: toTemporal(damages, TUNNEL_SPECS), source: "demo" };
}

/** Variant used by the simulated inspection flow (subset of specs + real file names). */
export function buildCustomDataset(
  key: string,
  meta: InspectionMeta,
  seed: number,
  specs: DamageSpec[],
  sourceNames: string[],
): InspectionDataset {
  const cloud = generateTunnelCloud(seed);
  const { damages, footprints } = generateTunnelDamages(seed, specs, sourceNames);
  return { key, meta, damages, cloud, footprints, cameras: generateCameras(8), temporal: toTemporal(damages, specs), source: "demo" };
}

export const DEMO_INSPECTIONS: InspectionDataset[] = [
  buildDataset(
    "ins-2026-tunnel",
    {
      inspectionId: "INS-2026-001",
      infrastructureId: "TUNNEL-001",
      infrastructureType: "tunnel",
      inspectionDate: "2026-10-01",
      inspector: "A. Rahmadi",
      numInputImages: 89,
      numUsableImages: 84,
      coverage: 91,
      pointCount: 2011922,
    },
    7,
  ),
  buildDataset(
    "ins-2026-bridge",
    {
      inspectionId: "INS-2026-002",
      infrastructureId: "BRIDGE-014",
      infrastructureType: "bridge",
      inspectionDate: "2026-09-14",
      inspector: "S. Maharani",
      numInputImages: 64,
      numUsableImages: 61,
      coverage: 88,
      pointCount: 1440030,
    },
    21,
  ),
  buildDataset(
    "ins-2026-dam",
    {
      inspectionId: "INS-2026-003",
      infrastructureId: "DAM-002",
      infrastructureType: "dam",
      inspectionDate: "2026-08-30",
      inspector: "B. Santoso",
      numInputImages: 52,
      numUsableImages: 49,
      coverage: 84,
      pointCount: 980415,
    },
    42,
  ),
];
