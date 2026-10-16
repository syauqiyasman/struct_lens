import type { DamageRecord, DamageType, TemporalEntry } from "../types";
import { TYPE_COLORS } from "../types";

const TYPES: DamageType[] = ["crack", "spalling", "corrosion", "surface_damage"];

export default function DamagePanel({ d, temporal }: { d: DamageRecord | null; temporal: TemporalEntry[] }) {
  if (!d) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="font-mono text-[11px] tracking-widest text-zinc-600">NO SELECTION</div>
        <p className="text-[12px] text-zinc-500">Click a marker in the viewport to inspect a damage record.</p>
      </div>
    );
  }
  const hist = temporal.find((t) => t.currId === d.id);
  return (
    <div className="cad-scroll h-full overflow-y-auto">
      <div className="border-b border-cad-border p-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5" style={{ background: TYPE_COLORS[d.type] }} />
          <span className="font-mono text-[15px] font-bold">{d.id}</span>
          <span className="ml-auto font-mono text-[11px] text-emerald-400">{(d.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-zinc-500">{d.type.replace("_", " ")}</div>
      </div>
      <Prop label="POSITION X" value={d.location.x.toFixed(3)} />
      <Prop label="POSITION Y" value={d.location.y.toFixed(3)} />
      <Prop label="POSITION Z" value={d.location.z.toFixed(3)} />
      <Prop label="EST. LENGTH" value={`${d.length.toFixed(2)} m (rel.)`} />
      <Prop label="OBSERVATIONS" value={String(d.numObservations)} />
      <Prop label="3D POINTS" value={d.num3dPoints != null ? d.num3dPoints.toLocaleString() : "—"} />
      <Prop label="INSPECTION" value={d.inspectionDate} />
      <div className="border-b border-cad-border p-3">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Source images</div>
        <div className="flex flex-wrap gap-1.5">
          {d.sourceImages.map((s) => (
            <span key={s} className="border border-cad-border bg-cad-bg px-1.5 py-0.5 font-mono text-[11px] text-sky-300">{s}</span>
          ))}
        </div>
      </div>
      <div className="p-3">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">History</div>
        {hist ? (
          <div className="border border-cad-border bg-cad-bg p-2 font-mono text-[11px]">
            {hist.status === "persisted" ? (
              <>
                <div className="text-zinc-400">PREV {hist.prevId} · {hist.lenPrev?.toFixed(2)} m</div>
                <div className="text-zinc-400">CURR {hist.currId} · {hist.lenCurr.toFixed(2)} m</div>
                <div className={hist.growth != null && hist.growth > 0 ? "text-red-400" : "text-emerald-400"}>
                  Δ {hist.growth != null && hist.growth > 0 ? "+" : ""}{hist.growth?.toFixed(2)} m — {hist.status.toUpperCase()}
                </div>
              </>
            ) : (
              <div className="text-cad-accent">NEW in this inspection</div>
            )}
          </div>
        ) : (
          <div className="font-mono text-[11px] text-zinc-600">No prior record.</div>
        )}
      </div>
      <div className="flex items-center justify-between border-b border-cad-border px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Review status</span>
        <span className="border border-amber-700 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">PENDING</span>
      </div>
    </div>
  );
}

function Prop({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-cad-border px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="font-mono text-[12px] text-zinc-100">{value}</span>
    </div>
  );
}

export { TYPES };
