import { useState } from "react";
import { useStore } from "../store";

export default function UploadPanel() {
  const { uploadDataset, uploading, uploadNotice } = useStore();
  const [cloud, setCloud] = useState<File | null>(null);
  const [report, setReport] = useState<File | null>(null);
  const [damageCloud, setDamageCloud] = useState<File | null>(null);
  const [damageIndex, setDamageIndex] = useState<File | null>(null);

  const row = (label: string, req: boolean, file: File | null, set: (f: File | null) => void, accept: string) => (
    <label className="block">
      <span className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {label} {req && <span className="text-cad-accent">required</span>}
      </span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => set(e.target.files?.[0] ?? null)}
        className="w-full border border-dashed border-cad-border bg-cad-bg px-2 py-1.5 font-mono text-[11px] text-zinc-400 file:mr-2 file:border-0 file:bg-cad-panel2 file:px-2 file:py-1 file:text-zinc-300 hover:border-zinc-600"
      />
      {file && <span className="mt-0.5 block truncate font-mono text-[10px] text-emerald-500">{file.name}</span>}
    </label>
  );

  return (
    <div className="space-y-2.5">
      {row("point cloud (.ply)", true, cloud, setCloud, ".ply")}
      {row("report (.json)", false, report, setReport, ".json")}
      {row("damage cloud (.ply)", false, damageCloud, setDamageCloud, ".ply")}
      {row("damage index (.json)", false, damageIndex, setDamageIndex, ".json")}
      <button
        disabled={!cloud || uploading}
        onClick={() => cloud && uploadDataset({ cloud, report, damageCloud, damageIndex })}
        className="w-full bg-cad-accent py-1.5 font-mono text-[11px] font-bold tracking-wider text-black disabled:cursor-not-allowed disabled:opacity-30"
      >
        {uploading ? "PARSING…" : "LOAD DATASET"}
      </button>
      {uploadNotice && <p className="font-mono text-[10px] leading-relaxed text-zinc-400">{uploadNotice}</p>}
      <p className="font-mono text-[10px] leading-relaxed text-zinc-600">
        Accepts pipeline outputs: *_pointcloud.ply, *_report.json, *_damages.ply + *_damage_index.json. Clouds are subsampled for the browser.
      </p>
    </div>
  );
}
