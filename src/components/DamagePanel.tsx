import type { DamageRecord, DamageType, ReviewStatus, TemporalEntry } from "../types";
import { TYPE_COLORS } from "../types";
import { useStore } from "../store";

const TYPES: DamageType[] = ["crack", "spalling", "corrosion", "surface_damage"];

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  rejected: "REJECTED",
};

const REVIEW_ACTIVE: Record<ReviewStatus, string> = {
  pending: "border-amber-700 bg-amber-950/30 text-amber-400",
  confirmed: "border-emerald-700 bg-emerald-950/30 text-emerald-400",
  rejected: "border-red-800 bg-red-950/30 text-red-400",
};

export default function DamagePanel({ d, temporal, scale = 1, calibrated = false }: { d: DamageRecord | null; temporal: TemporalEntry[]; scale?: number; calibrated?: boolean }) {
  const { reviewOf, setReview } = useStore();
  if (!d) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="font-mono text-[11px] tracking-widest text-zinc-600">NO SELECTION</div>
        <p className="text-[12px] text-zinc-500">Click a marker in the viewport to inspect a damage record.</p>
      </div>
    );
  }
  const hist = temporal.find((t) => t.currId === d.id);
  const review = reviewOf(d.id);
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
      <Prop label="EST. LENGTH" value={calibrated ? `${(d.length * scale).toFixed(3)} m` : `${d.length.toFixed(2)} u (rel.)`} />
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
                <div className="text-zinc-400">PREV {hist.prevId} · {hist.lenPrev != null ? `${(hist.lenPrev * scale).toFixed(calibrated ? 3 : 2)} ${calibrated ? "m" : "u"}` : "—"}</div>
                <div className="text-zinc-400">CURR {hist.currId} · {(hist.lenCurr * scale).toFixed(calibrated ? 3 : 2)} {calibrated ? "m" : "u"}</div>
                <div className={hist.growth != null && hist.growth > 0 ? "text-red-400" : "text-emerald-400"}>
                  Δ {hist.growth != null && hist.growth > 0 ? "+" : ""}{hist.growth != null ? (hist.growth * scale).toFixed(calibrated ? 3 : 2) : "—"} {calibrated ? "m" : "u"} — {hist.status.toUpperCase()}
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
      <div className="border-b border-cad-border px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Review status</span>
          <span className={`border px-1.5 py-0.5 font-mono text-[10px] ${REVIEW_ACTIVE[review]}`}>{REVIEW_LABELS[review]}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {(["pending", "confirmed", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setReview(d.id, s)}
              className={`border py-1 font-mono text-[10px] tracking-wider transition-colors ${review === s ? REVIEW_ACTIVE[s] : "border-cad-border text-zinc-500 hover:border-zinc-500"}`}
            >
              {REVIEW_LABELS[s]}
            </button>
          ))}
        </div>
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
