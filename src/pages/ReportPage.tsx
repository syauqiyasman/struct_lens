import { useStore } from "../store";
import { TYPE_COLORS } from "../types";

export default function ReportPage() {
  const { active, calibration, calibrated, scale } = useStore();
  const m = active.meta;
  const lenUnit = calibrated ? "m" : "u";
  const dist = (Object.keys(TYPE_COLORS) as (keyof typeof TYPE_COLORS)[]).map((t) => ({
    t,
    n: active.damages.filter((d) => d.type === t).length,
  }));

  const exportJSON = () => {
    const payload = {
      inspection_id: m.inspectionId,
      infrastructure_id: m.infrastructureId,
      inspection_date: m.inspectionDate,
      calibration: calibrated && calibration
        ? {
            method: calibration.method,
            scale_m_per_unit: calibration.scale,
            reference: calibration.method === "reference" ? { real_m: calibration.refReal, measured_unit: calibration.refVggt } : null,
            validation_error_pct: calibration.validation?.errorPct ?? null,
          }
        : { method: "uncalibrated", scale_m_per_unit: null },
      total_damage: active.damages.length,
      damage_distribution: Object.fromEntries(dist.map((d) => [d.t, d.n])),
      damages: active.damages.map((d) => ({
        id: d.id,
        type: d.type,
        confidence: d.confidence,
        location: d.location,
        size: { length: Number((d.length * scale).toFixed(4)), unit: lenUnit },
        inspection_date: d.inspectionDate,
        source_images: d.sourceImages,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${m.inspectionId}_report.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="cad-scroll h-full overflow-y-auto p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-wide">INSPECTION REPORT</h1>
          <p className="font-mono text-[11px] text-zinc-500">{m.inspectionId} · {m.infrastructureId} · {m.inspectionDate}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="border border-cad-border px-3 py-1.5 font-mono text-[11px] hover:border-zinc-500">PRINT</button>
          <button onClick={exportJSON} className="bg-cad-accent px-4 py-1.5 font-mono text-[11px] font-bold text-black">EXPORT JSON</button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-px border border-cad-border bg-cad-border font-mono md:grid-cols-4">
        {[
          ["TOTAL DAMAGE", String(active.damages.length)],
          ["AVG CONFIDENCE", active.damages.length ? `${((active.damages.reduce((a, d) => a + d.confidence, 0) / active.damages.length) * 100).toFixed(0)}%` : "—"],
          ["MAX LENGTH", active.damages.length ? `${(Math.max(...active.damages.map((d) => d.length)) * scale).toFixed(2)} ${lenUnit}` : "—"],
          ["COVERAGE", `${m.coverage}%`],
        ].map(([l, v]) => (
          <div key={l} className="bg-cad-panel p-3">
            <div className="text-[10px] tracking-wider text-zinc-600">{l}</div>
            <div className="text-xl text-white">{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-3 border border-cad-border bg-cad-panel px-3 py-2 font-mono text-[11px]">
        <span className={`h-2 w-2 rounded-full ${calibrated ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span className="uppercase tracking-wider text-zinc-400">Scale calibration</span>
        {calibrated && calibration ? (
          <>
            <span className="text-cad-accent">{calibration.scale.toFixed(4)} m/unit</span>
            <span className="text-zinc-500">method {calibration.method}</span>
            {calibration.validation && (
              <span className={calibration.validation.errorPct <= 5 ? "text-emerald-400" : "text-red-400"}>
                validation {calibration.validation.errorPct.toFixed(2)}%
              </span>
            )}
          </>
        ) : (
          <span className="text-amber-400">uncalibrated — lengths in relative units</span>
        )}
      </div>

      <div className="mb-3 border border-cad-border bg-cad-panel">
        <div className="border-b border-cad-border px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Damage distribution</div>
        {dist.map(({ t, n }) => (
          <div key={t} className="flex items-center gap-3 border-t border-cad-border px-3 py-1.5 first:border-t-0">
            <span className="h-2.5 w-2.5" style={{ background: TYPE_COLORS[t] }} />
            <span className="font-mono text-[12px]">{t}</span>
            <div className="h-1.5 flex-1 bg-cad-bg">
              <div className="h-full" style={{ width: `${active.damages.length ? (n / active.damages.length) * 100 : 0}%`, background: TYPE_COLORS[t] }} />
            </div>
            <span className="font-mono text-[12px] text-zinc-300">{n}</span>
          </div>
        ))}
      </div>

      <div className="border border-cad-border bg-cad-panel">
        <div className="border-b border-cad-border px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Damage records</div>
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-600">
              {["ID", "Type", "Conf", "X", "Y", "Z", "Length", "Sources"].map((h) => (
                <th key={h} className="px-3 py-2 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.damages.map((d) => (
              <tr key={d.id} className="border-t border-cad-border text-zinc-300">
                <td className="px-3 py-1.5 text-white">{d.id}</td>
                <td className="px-3 py-1.5" style={{ color: TYPE_COLORS[d.type] }}>{d.type}</td>
                <td className="px-3 py-1.5">{(d.confidence * 100).toFixed(0)}%</td>
                <td className="px-3 py-1.5">{d.location.x.toFixed(2)}</td>
                <td className="px-3 py-1.5">{d.location.y.toFixed(2)}</td>
                <td className="px-3 py-1.5">{d.location.z.toFixed(2)}</td>
                <td className="px-3 py-1.5">{(d.length * scale).toFixed(calibrated ? 3 : 2)} {lenUnit}</td>
                <td className="px-3 py-1.5 text-sky-300">{d.sourceImages.join(", ")}</td>
              </tr>
            ))}
            {active.damages.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-4 text-zinc-600">No damages recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
