import { buildCustomDataset } from "../data/demo";
import type { DamageSpec } from "../data/demo";
import { TUNNEL_SPECS } from "../data/demo";
import type { InspectionDataset, InspectionMeta } from "../types";
import { fnv1a, fmtBytes, type IngestedImage } from "./ingest";

export interface PipeCallbacks {
  onStage: (i: number) => void;
  onLog: (line: string) => void;
  onProgress: (frac: number) => void;
  shouldCancel: () => boolean;
}

export const STAGES = [
  "Ingest & validation",
  "VGGT reconstruction",
  "GroundingDINO detection",
  "SAM 2 segmentation",
  "2D→3D + association",
  "Spatial map & report",
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function patient(ms: number, shouldCancel: () => boolean) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (shouldCancel()) throw new Error("cancelled");
    await sleep(150);
  }
}

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimInput {
  images: IngestedImage[];
  videoName: string | null;
  videoFrames: number;
  infrastructureId: string;
  infrastructureType: string;
  inspector: string;
  inspectionDate: string;
}

const PHRASES = ["crack", "rust stain", "corrosion", "spalling", "exposed rebar", "concrete damage"];

export async function runFakePipeline(input: SimInput, cb: PipeCallbacks): Promise<InspectionDataset> {
  const tStart = Date.now();
  const names = input.images.map((i) => i.name);
  if (input.videoName) for (let i = 0; i < input.videoFrames; i++) names.push(`frame_${String(i + 1).padStart(3, "0")}.jpg`);
  const seed = fnv1a(names.join("|") + input.images.reduce((a, i) => a + i.size, 0));
  const rand = prng(seed);
  const nViews = names.length;
  const elapsed = () => ((Date.now() - tStart) / 1000).toFixed(1);

  const log = (s: string) => cb.onLog(`[${elapsed()}s] ${s}`);
  const prog = async (from: number, to: number, ms: number) => {
    const steps = Math.max(1, Math.round(ms / 200));
    for (let i = 1; i <= steps; i++) {
      await patient(ms / steps, cb.shouldCancel);
      cb.onProgress(from + ((to - from) * i) / steps);
    }
  };

  // ── Stage 0: validation ──────────────────────────────
  cb.onStage(0);
  log(`Session GPU T4 · torch 2.10+cu128 · VGGT-1B + grounding-dino-base + sam2-hiera-small`);
  for (const im of input.images) {
    await patient(140, cb.shouldCancel);
    log(`VALID  ${im.name}  ${im.width}x${im.height}  ${fmtBytes(im.size)}  sharpness ok`);
  }
  if (input.videoName) log(`VIDEO  ${input.videoName} → ${input.videoFrames} frames extracted @720p`);
  log(`${nViews}/${nViews} views usable — duplicates: 0, corrupt: 0`);
  await prog(0, 0.08, 600);

  // ── Stage 1: VGGT ────────────────────────────────────
  cb.onStage(1);
  log(`VGGT from_pretrained("facebook/VGGT-1B") · fp16 · batch=1`);
  const regSteps = Math.min(nViews, 12);
  for (let i = 1; i <= regSteps; i++) {
    await patient(420, cb.shouldCancel);
    const shown = Math.round((i / regSteps) * nViews);
    log(`registering views… ${shown}/${nViews}  poses ✓  mean reproj ${(0.4 + rand() * 0.5).toFixed(2)}px  VRAM ${(5.1 + i * 0.3).toFixed(1)}/15.0 GB`);
    cb.onProgress(0.08 + (0.34 * i) / regSteps);
  }
  const pts = 1200000 + Math.floor(rand() * 800000);
  log(`depth + world points unprojected · conf-filter → ${pts.toLocaleString()} pts · coverage ${(84 + Math.floor(rand() * 12))}%`);
  await prog(0.42, 0.46, 700);

  // ── Stage 2: GroundingDINO ───────────────────────────
  cb.onStage(2);
  log(`prompts: "${PHRASES.join(" . ")}" · box_thresh 0.35 · text_thresh 0.25`);
  const nPhrases = PHRASES.length;
  let kept = 0;
  for (let i = 0; i < nPhrases; i++) {
    await patient(520, cb.shouldCancel);
    const k = Math.floor(rand() * (nViews / 2 + 1));
    kept += k;
    const top = (0.3 + rand() * 0.6).toFixed(2);
    log(`phrase "${PHRASES[i]}" → ${k} boxes (top ${top})`);
    cb.onProgress(0.46 + (0.2 * (i + 1)) / nPhrases);
  }
  const nmsCut = Math.floor(kept * 0.3);
  log(`NMS IoU 0.5: ${kept} → ${kept - nmsCut} boxes kept`);
  await prog(0.66, 0.68, 400);

  // ── Stage 3: SAM2 ────────────────────────────────────
  cb.onStage(3);
  const K = 3 + (seed % 4); // 3..6 damages
  log(`SAM2 box-prompt × ${kept - nmsCut} · multimask off · native resolution`);
  for (let i = 0; i < Math.min(K + 2, kept - nmsCut + 1); i++) {
    await patient(480, cb.shouldCancel);
    log(`mask ${i + 1}: area ${(800 + Math.floor(rand() * 9000)).toLocaleString()}px  sam ${(0.81 + rand() * 0.15).toFixed(2)}`);
    cb.onProgress(0.68 + (0.14 * (i + 1)) / Math.max(1, Math.min(K + 2, kept - nmsCut + 1)));
  }
  log(`${K} damage candidates survive area + confidence filters`);
  await prog(0.82, 0.84, 400);

  // ── Stage 4: localize + associate ────────────────────
  cb.onStage(4);
  await prog(0.84, 0.9, 1200);
  log(`back-projected to VGGT world frame · scale note: relative (no metric calibration)`);
  for (let i = 0; i < K; i++) {
    await patient(260, cb.shouldCancel);
    const obs = 2 + Math.floor(rand() * 3);
    log(`D-${String(i + 1).padStart(3, "0")}: ${obs} views associated within r=0.35`);
  }
  log(`unique damages: ${K} — occlusions resolved, no double-count`);

  // ── Stage 5: map + report ────────────────────────────
  cb.onStage(5);
  await prog(0.9, 0.97, 900);
  log(`pointcloud.ply (${(pts * 15 / 1048576).toFixed(1)} MB) · damages.ply · map_3d.html · report.json written`);
  await prog(0.97, 1, 500);

  // ── Build the browsable dataset (deterministic from upload) ──
  const order: DamageSpec[] = [];
  for (let i = 0; i < K; i++) {
    const base = TUNNEL_SPECS[(seed + i * 3) % TUNNEL_SPECS.length];
    order.push({
      ...base,
      id: `D-${String(i + 1).padStart(3, "0")}`,
      length: +(base.length * (0.85 + rand() * 0.4)).toFixed(2),
      confidence: +(0.68 + rand() * 0.29).toFixed(2),
      prevLength: i === K - 1 ? null : +(base.length * (0.55 + rand() * 0.25)).toFixed(2),
    });
  }
  const meta: InspectionMeta = {
    inspectionId: `INS-2026-${String(100 + (seed % 800))}`,
    infrastructureId: input.infrastructureId || "STRUCT-001",
    infrastructureType: input.infrastructureType,
    inspectionDate: input.inspectionDate,
    inspector: input.inspector || "Field Inspector",
    numInputImages: nViews,
    numUsableImages: nViews,
    coverage: 84 + (seed % 12),
    pointCount: pts,
  };
  const ds = buildCustomDataset(`sim-${Date.now()}`, meta, seed % 100000, order, names);
  log(`DONE in ${elapsed()}s — ${ds.damages.length} damages → opening 3D viewer`);
  return ds;
}
