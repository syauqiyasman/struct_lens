import { useState } from "react";
import { useStore } from "../store";
import NewInspectionModal from "../components/NewInspectionModal";
import UploadDatasetModal from "../components/UploadDatasetModal";

export default function InspectionsPage() {
  const { inspections, active, selectInspection } = useStore();
  const [showNew, setShowNew] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  return (
    <div className="cad-scroll h-full overflow-y-auto p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-wide">PROJECT BROWSER</h1>
          <p className="font-mono text-[11px] text-zinc-500">{inspections.length} inspections · click OPEN to load into viewer</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNew(true)} className="bg-cad-accent px-3 py-1.5 font-mono text-[11px] font-bold text-black">
            + NEW INSPECTION
          </button>
          <button onClick={() => setShowUpload(true)} className="border border-cad-border px-3 py-1.5 font-mono text-[11px] hover:border-zinc-500">
            LOAD .PLY / .JSON
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {inspections.map((d) => {
          const dist = (["crack", "spalling", "corrosion", "surface_damage"] as const).map(
            (t) => ({ t, n: d.damages.filter((x) => x.type === t).length }),
          );
          const isActive = d.key === active.key;
          return (
            <div key={d.key} className={`border bg-cad-panel ${isActive ? "border-cad-accent" : "border-cad-border"}`}>
              <div className="flex items-center gap-2 border-b border-cad-border px-3 py-2">
                <span className="font-mono text-[13px] font-bold">{d.meta.infrastructureId}</span>
                <span className="font-mono text-[11px] uppercase text-zinc-500">{d.meta.infrastructureType}</span>
                <span className="ml-auto font-mono text-[10px] text-zinc-500">{d.meta.inspector || "—"}</span>
              </div>
              <div className="grid grid-cols-4 gap-px bg-cad-border font-mono">
                <Cell label="INSPECTION" value={d.meta.inspectionId} />
                <Cell label="DATE" value={d.meta.inspectionDate || "—"} />
                <Cell label="IMAGES" value={`${d.meta.numUsableImages}/${d.meta.numInputImages}`} />
                <Cell label="COVERAGE" value={`${d.meta.coverage}%`} />
                <Cell label="POINTS" value={d.meta.pointCount ? d.meta.pointCount.toLocaleString() : d.cloud.count.toLocaleString()} />
                <Cell label="DAMAGES" value={String(d.damages.length)} />
                <Cell label="PERSISTED" value={String(d.temporal.filter((t) => t.status === "persisted").length)} />
                <Cell label="NEW" value={String(d.temporal.filter((t) => t.status === "new").length)} />
              </div>
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex h-2 flex-1 overflow-hidden bg-cad-bg">
                  {dist.map(({ t, n }) => (
                    <div key={t} style={{ width: `${d.damages.length ? (n / d.damages.length) * 100 : 0}%`, background: bar(t) }} title={`${t}: ${n}`} />
                  ))}
                </div>
                <button
                  onClick={() => selectInspection(d.key)}
                  className="bg-cad-accent px-4 py-1.5 font-mono text-[11px] font-bold tracking-wider text-black"
                >
                  OPEN {isActive ? "✓" : "→"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <NewInspectionModal open={showNew} onClose={() => setShowNew(false)} />
      <UploadDatasetModal open={showUpload} onClose={() => setShowUpload(false)} />
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cad-panel px-2.5 py-1.5">
      <div className="text-[9px] tracking-wider text-zinc-600">{label}</div>
      <div className="truncate text-[12px] text-zinc-100">{value}</div>
    </div>
  );
}

function bar(t: string): string {
  return { crack: "#ff2d2d", spalling: "#ff8c1a", corrosion: "#8a2be2", surface_damage: "#1e90ff" }[t] ?? "#666";
}
