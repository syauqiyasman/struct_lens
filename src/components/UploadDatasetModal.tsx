import { useState } from "react";
import { useStore } from "../store";

const EXPECTED = [
  { file: "*_pointcloud.ply", req: true, desc: "Colored VGGT point cloud (XYZ + RGB). Required — this is the 3D scene." },
  { file: "*_report.json", req: false, desc: "Inspection report. Provides damage markers, types, confidence, history." },
  { file: "*_damages.ply", req: false, desc: "Colored 3D damage footprints. Needs the index file below to be usable." },
  { file: "*_damage_index.json", req: false, desc: "Maps footprint colors to damage IDs. Required together with damages.ply." },
];

export default function UploadDatasetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { uploadDataset, uploading, uploadNotice, setPage } = useStore();
  const [cloud, setCloud] = useState<File | null>(null);
  const [report, setReport] = useState<File | null>(null);
  const [damageCloud, setDamageCloud] = useState<File | null>(null);
  const [damageIndex, setDamageIndex] = useState<File | null>(null);
  const [done, setDone] = useState<"idle" | "ok" | "err">("idle");

  if (!open) return null;

  const load = async () => {
    if (!cloud) return;
    setDone("idle");
    const err = await uploadDataset({ cloud, report, damageCloud, damageIndex });
    setDone(err ? "err" : "ok");
  };

  const row = (label: string, req: boolean, file: File | null, set: (f: File | null) => void, accept: string) => (
    <label className="block">
      <span className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {label} {req ? <span className="text-cad-accent">required</span> : <span className="text-zinc-600">optional</span>}
      </span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => { set(e.target.files?.[0] ?? null); setDone("idle"); }}
        className="w-full border border-dashed border-cad-border bg-cad-bg px-2 py-2 font-mono text-[11px] text-zinc-400 file:mr-2 file:border-0 file:bg-cad-panel2 file:px-2 file:py-1 file:text-zinc-300 hover:border-zinc-600"
      />
      {file && <span className="mt-0.5 block truncate font-mono text-[10px] text-emerald-500">{file.name} · {(file.size / 1048576).toFixed(1)} MB</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => !uploading && onClose()}>
      <div className="flex max-h-[92vh] w-[720px] max-w-full flex-col border border-cad-border bg-cad-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-cad-border px-4 py-2.5">
          <span className="font-mono text-[13px] font-bold tracking-wider">LOAD PIPELINE OUTPUT</span>
          <button onClick={() => !uploading && onClose()} className="ml-auto font-mono text-zinc-500 hover:text-white">✕</button>
        </div>

        <div className="cad-scroll flex-1 overflow-y-auto p-4">
          <div className="mb-3 border border-cad-border bg-cad-bg p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">What to upload — export bundle from a pipeline run (*_infravision_bundle.zip)</div>
            <div className="space-y-1.5">
              {EXPECTED.map((e) => (
                <div key={e.file} className="flex gap-2 font-mono text-[11px]">
                  <span className={`shrink-0 border px-1.5 py-0.5 ${e.req ? "border-cad-accent/60 text-cad-accent" : "border-cad-border text-zinc-500"}`}>{e.req ? "REQ" : "OPT"}</span>
                  <span className="shrink-0 text-zinc-200">{e.file}</span>
                  <span className="text-zinc-500">— {e.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {row("point cloud (.ply)", true, cloud, setCloud, ".ply")}
            {row("report (.json)", false, report, setReport, ".json")}
            {row("damage cloud (.ply)", false, damageCloud, setDamageCloud, ".ply")}
            {row("damage index (.json)", false, damageIndex, setDamageIndex, ".json")}
          </div>

          {uploading && (
            <div className="mt-3 flex items-center gap-3 border border-cad-border bg-cad-bg p-3">
              <div className="h-5 w-5 animate-spin border-2 border-cad-border border-t-cad-accent" />
              <span className="font-mono text-[11px] tracking-widest text-zinc-300">PARSING POINT CLOUD…</span>
            </div>
          )}

          {done !== "idle" && !uploading && (
            <div className={`mt-3 border p-3 font-mono text-[11px] leading-relaxed ${done === "ok" ? "border-emerald-900 bg-emerald-950/30 text-emerald-300" : "border-red-900 bg-red-950/30 text-red-300"}`}>
              {done === "ok" ? "✓ DATASET LOADED" : "✕ LOAD FAILED"}
              {uploadNotice && <div className="mt-1 text-zinc-400">{uploadNotice}</div>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-cad-border px-4 py-2.5">
          <span className="font-mono text-[10px] text-zinc-600">Large clouds are subsampled for the browser.</span>
          {done === "ok" ? (
            <button onClick={() => { onClose(); setPage("viewer"); }} className="ml-auto bg-cad-accent px-5 py-1.5 font-mono text-[11px] font-bold text-black">
              OPEN IN VIEWER →
            </button>
          ) : (
            <button disabled={!cloud || uploading} onClick={load} className="ml-auto bg-cad-accent px-5 py-1.5 font-mono text-[11px] font-bold text-black disabled:opacity-30">
              {uploading ? "LOADING…" : "LOAD DATASET"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
