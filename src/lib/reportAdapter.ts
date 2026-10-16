import type { DamageRecord, DamageType, InspectionDataset, InspectionMeta, TemporalEntry } from "../types";
import { parsePLY } from "./ply";
import type { CloudData, Footprint } from "../types";

const VALID: DamageType[] = ["crack", "spalling", "corrosion", "surface_damage"];

function toType(t: unknown): DamageType {
  return VALID.includes(t as DamageType) ? (t as DamageType) : "surface_damage";
}

interface RawDamage {
  id?: string;
  type?: string;
  confidence?: number;
  location?: { x?: number; y?: number; z?: number };
  size?: { length?: number };
  inspection_date?: string;
  source_images?: string[];
  num_observations?: number;
  num_3d_points?: number;
}

/** Adapt a FR-23/FR-24 pipeline report (*_report.json) into viewer records. */
export function adaptReport(json: unknown): { meta: InspectionMeta; damages: DamageRecord[]; temporal: TemporalEntry[] } {
  const r = json as Record<string, unknown>;
  const rec = (r.reconstruction ?? {}) as Record<string, number>;
  const meta: InspectionMeta = {
    inspectionId: String(r.inspection_id ?? "INS-UPLOAD-001"),
    infrastructureId: String(r.infrastructure ?? "UPLOADED"),
    infrastructureType: String(r.infrastructure_type ?? "structure"),
    inspectionDate: String(r.inspection_date ?? ""),
    inspector: String(r.inspector ?? ""),
    numInputImages: Number(r.num_input_images ?? 0),
    numUsableImages: Number(r.num_usable_images ?? 0),
    coverage: Number(rec.reconstruction_coverage ?? 0),
    pointCount: Number(rec.num_points ?? 0),
  };
  const raw = (r.damages ?? []) as RawDamage[];
  const damages: DamageRecord[] = raw.map((d, i) => ({
    id: String(d.id ?? `D-${String(i + 1).padStart(3, "0")}`),
    type: toType(d.type),
    confidence: Number(d.confidence ?? 0),
    location: {
      x: Number(d.location?.x ?? 0),
      y: Number(d.location?.y ?? 0),
      z: Number(d.location?.z ?? 0),
    },
    length: Number(d.size?.length ?? 0),
    inspectionDate: String(d.inspection_date ?? meta.inspectionDate),
    sourceImages: (d.source_images ?? []).map(String),
    numObservations: Number(d.num_observations ?? 1),
    num3dPoints: d.num_3d_points != null ? Number(d.num_3d_points) : undefined,
  }));
  const t = (r.temporal ?? {}) as { status?: string; matches?: Array<Record<string, unknown>> };
  const temporal: TemporalEntry[] = Array.isArray(t.matches)
    ? t.matches.map((m) => ({
        prevId: m.damage_id_prev != null ? String(m.damage_id_prev) : null,
        currId: String(m.damage_id_curr ?? ""),
        type: toType(m.type),
        lenPrev: m.len_prev != null ? Number(m.len_prev) : null,
        lenCurr: Number(m.len_curr ?? 0),
        growth: m.growth != null ? Number(m.growth) : null,
        status: (m.status === "persisted" ? "persisted" : "new") as "persisted" | "new",
      }))
    : [];
  return { meta, damages, temporal };
}

export interface UploadResult {
  dataset: InspectionDataset;
  skippedFootprints: boolean;
}

/**
 * Build a viewer dataset from uploaded files:
 * pointcloud.ply (required) + report.json (optional) + damages.ply/.json (optional).
 */
export async function buildUploadDataset(files: {
  cloud: File;
  report?: File | null;
  damageCloud?: File | null;
  damageIndex?: File | null;
}): Promise<UploadResult> {
  const cloud: CloudData = parsePLY(await files.cloud.arrayBuffer());
  let meta: InspectionMeta = {
    inspectionId: files.cloud.name.replace(/\.ply$/i, ""),
    infrastructureId: "UPLOADED",
    infrastructureType: "structure",
    inspectionDate: new Date().toISOString().slice(0, 10),
    inspector: "",
    numInputImages: 0,
    numUsableImages: 0,
    coverage: 0,
    pointCount: cloud.count,
  };
  let damages: DamageRecord[] = [];
  let temporal: TemporalEntry[] = [];
  if (files.report) {
    const parsed = adaptReport(JSON.parse(await files.report.text()));
    meta = { ...parsed.meta, pointCount: cloud.count };
    damages = parsed.damages;
    temporal = parsed.temporal;
  }
  let footprints: Footprint[] = [];
  let skippedFootprints = false;
  if (files.damageCloud && files.damageIndex) {
    try {
      const dmg = parsePLY(await files.damageCloud.arrayBuffer(), 60000);
      const idx = JSON.parse(await files.damageIndex.text()) as Array<{ idx: number; id: string; type: string }>;
      if (dmg.pointIndex) {
        const byIdx = new Map<number, number[]>();
        for (let i = 0; i < dmg.count; i++) {
          const k = dmg.pointIndex[i];
          if (!k) continue;
          let arr = byIdx.get(k);
          if (!arr) byIdx.set(k, (arr = []));
          arr.push(i);
        }
        footprints = idx
          .filter((e) => byIdx.has(e.idx))
          .map((e) => {
            const members = byIdx.get(e.idx)!;
            const pos = new Float32Array(members.length * 3);
            members.forEach((src, j) => {
              pos[j * 3] = dmg.positions[src * 3];
              pos[j * 3 + 1] = dmg.positions[src * 3 + 1];
              pos[j * 3 + 2] = dmg.positions[src * 3 + 2];
            });
            const t = (["crack", "spalling", "corrosion", "surface_damage"] as const).includes(e.type as (typeof VALID)[number])
              ? (e.type as (typeof VALID)[number])
              : "surface_damage";
            return { damageId: e.id, type: t, positions: pos };
          });
      } else {
        skippedFootprints = true;
      }
    } catch {
      skippedFootprints = true;
    }
  } else if (files.damageCloud || files.damageIndex) {
    skippedFootprints = true;
  }
  return {
    dataset: {
      key: `upload-${Date.now()}`,
      meta,
      damages,
      cloud,
      footprints,
      cameras: [],
      temporal,
      source: "upload",
    },
    skippedFootprints,
  };
}
