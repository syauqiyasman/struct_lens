export type DamageType = "crack" | "spalling" | "corrosion" | "surface_damage";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface DamageRecord {
  id: string;
  type: DamageType;
  confidence: number;
  location: Vec3;
  length: number;
  inspectionDate: string;
  sourceImages: string[];
  numObservations: number;
  num3dPoints?: number;
}

export interface CalibrationValidation {
  real: number;
  measuredVggt: number;
  errorPct: number;
}

export interface Calibration {
  method: "reference" | "manual";
  scale: number;
  refVggt?: number;
  refReal?: number;
  updatedAt: number;
  validation?: CalibrationValidation | null;
}

export type ReviewStatus = "pending" | "confirmed" | "rejected";

export interface InspectionMeta {
  inspectionId: string;
  infrastructureId: string;
  infrastructureType: string;
  inspectionDate: string;
  inspector: string;
  numInputImages: number;
  numUsableImages: number;
  coverage: number;
  pointCount: number;
}

export interface TemporalEntry {
  prevId: string | null;
  currId: string;
  type: DamageType;
  lenPrev: number | null;
  lenCurr: number;
  growth: number | null;
  status: "persisted" | "new";
}

export interface CloudData {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
}

export interface Footprint {
  damageId: string;
  type: DamageType;
  positions: Float32Array;
}

export interface InspectionDataset {
  key: string;
  meta: InspectionMeta;
  damages: DamageRecord[];
  cloud: CloudData;
  footprints: Footprint[];
  cameras: number[][];
  temporal: TemporalEntry[];
  source: "demo" | "upload";
}

export const TYPE_COLORS: Record<DamageType, string> = {
  crack: "#ff2d2d",
  spalling: "#ff8c1a",
  corrosion: "#8a2be2",
  surface_damage: "#1e90ff",
};

export const TYPE_RGB: Record<DamageType, [number, number, number]> = {
  crack: [255, 45, 45],
  spalling: [255, 140, 26],
  corrosion: [138, 43, 226],
  surface_damage: [30, 144, 255],
};
