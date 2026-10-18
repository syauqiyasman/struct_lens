import { useEffect, useState } from "react";
import { useStore } from "../store";

export default function CalibrationPanel({ measuredVggt }: { measuredVggt: number | null }) {
  const { calibration, calibrated, scale, setCalibration, filters, setFilters, notify } = useStore();
  const [realRef, setRealRef] = useState("");
  const [manual, setManual] = useState(calibrated ? String(scale) : "");
  const [realVal, setRealVal] = useState("");
  const measuring = filters.measure;

  useEffect(() => {
    setManual(calibrated ? String(scale) : "");
  }, [calibrated, scale]);

  const applyRef = () => {
    const d = measuredVggt;
    const D = Number(realRef);
    if (!d || d <= 0 || !(D > 0)) {
      notify("Pick 2 cloud points and enter a real length");
      return;
    }
    const s = D / d;
    setCalibration({ method: "reference", scale: s, refVggt: d, refReal: D, updatedAt: Date.now(), validation: calibration?.validation ?? null });
    setFilters({ measure: false });
    setRealRef("");
    notify(`Calibrated — ${s.toFixed(4)} m/unit`);
  };

  const applyManual = () => {
    const s = Number(manual);
    if (!(s > 0)) {
      notify("Scale must be > 0");
      return;
    }
    setCalibration({ method: "manual", scale: s, updatedAt: Date.now(), validation: null });
    notify(`Scale set — ${s.toFixed(4)} m/unit`);
  };

  const applyValidation = () => {
    const d = measuredVggt;
    const D = Number(realVal);
    if (!calibration || !d || d <= 0 || !(D > 0)) {
      notify("Measure 2 points, then enter the true length");
      return;
    }
    const measured = d * scale;
    const errorPct = (Math.abs(measured - D) / D) * 100;
    setCalibration({ ...calibration, validation: { real: D, measuredVggt: d, errorPct } });
    setFilters({ measure: false });
    setRealVal("");
    notify(`Validation error ${errorPct.toFixed(2)}%`);
  };

  const pick = (on: boolean) => {
    setFilters({ measure: on });
  };

  return (
    <div className="space-y-2 px-3 pb-2">
      <div className="flex items-center gap-2 border border-cad-border bg-cad-bg px-2 py-1.5">
        <span className={`h-2 w-2 rounded-full ${calibrated ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span className="font-mono text-[10px] tracking-wider text-zinc-300">{calibrated ? "CALIBRATED" : "UNCALIBRATED"}</span>
        <span className="ml-auto font-mono text-[10px] text-cad-accent">{calibrated ? `${scale.toFixed(4)} m/unit` : "scale = 1.0 (relative)"}</span>
      </div>

      {calibrated && calibration && (
        <div className="border border-cad-border bg-cad-bg px-2 py-1.5 font-mono text-[10px] text-zinc-400">
          <div>method: {calibration.method}{calibration.method === "reference" ? ` (${calibration.refReal?.toFixed(3)} m / ${calibration.refVggt?.toFixed(3)} u)` : ""}</div>
          <div>updated: {new Date(calibration.updatedAt).toLocaleTimeString()}</div>
          {calibration.validation && (
            <div className={calibration.validation.errorPct <= 5 ? "text-emerald-400" : "text-red-400"}>
              validation: {calibration.validation.errorPct.toFixed(2)}% error
            </div>
          )}
        </div>
      )}

      <div className="border border-dashed border-cad-border p-2">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Reference length (2 points)</div>
        <button
          onClick={() => pick(!measuring)}
          className={`w-full border py-1 font-mono text-[10px] ${measuring ? "border-cad-accent text-cad-accent" : "border-cad-border text-zinc-300 hover:border-zinc-500"}`}
        >
          {measuring ? "■ PICKING (click 2 cloud points)" : "PICK 2 POINTS"}
        </button>
        <div className="mt-1 font-mono text-[10px] text-zinc-400">
          measured: {measuredVggt != null && measuredVggt > 0 ? `${measuredVggt.toFixed(4)} unit` : "—"}
        </div>
        <div className="mt-1 flex gap-1">
          <input value={realRef} onChange={(e) => setRealRef(e.target.value)} inputMode="decimal" placeholder="true length (m)"
            className="w-full border border-cad-border bg-cad-bg px-2 py-1 font-mono text-[11px] text-zinc-100 focus:border-zinc-500 focus:outline-none" />
          <button onClick={applyRef} className="shrink-0 bg-cad-accent px-2 py-1 font-mono text-[10px] font-bold text-black">APPLY</button>
        </div>
      </div>

      <div className="border border-dashed border-cad-border p-2">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Manual scale (m/unit)</div>
        <div className="flex gap-1">
          <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="decimal" placeholder="e.g. 0.0125"
            className="w-full border border-cad-border bg-cad-bg px-2 py-1 font-mono text-[11px] text-zinc-100 focus:border-zinc-500 focus:outline-none" />
          <button onClick={applyManual} className="shrink-0 border border-cad-border px-2 py-1 font-mono text-[10px] text-zinc-300 hover:border-zinc-500">SET</button>
        </div>
      </div>

      {calibrated && (
        <div className="border border-dashed border-cad-border p-2">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Validate (independent check)</div>
          <button
            onClick={() => pick(!measuring)}
            className={`w-full border py-1 font-mono text-[10px] ${measuring ? "border-cad-accent text-cad-accent" : "border-cad-border text-zinc-300 hover:border-zinc-500"}`}
          >
            {measuring ? "■ PICKING (click 2 cloud points)" : "PICK 2 POINTS"}
          </button>
          <div className="mt-1 flex gap-1">
            <input value={realVal} onChange={(e) => setRealVal(e.target.value)} inputMode="decimal" placeholder="true length (m)"
              className="w-full border border-cad-border bg-cad-bg px-2 py-1 font-mono text-[11px] text-zinc-100 focus:border-zinc-500 focus:outline-none" />
            <button onClick={applyValidation} className="shrink-0 border border-cad-border px-2 py-1 font-mono text-[10px] text-zinc-300 hover:border-zinc-500">CHECK</button>
          </div>
        </div>
      )}

      {calibrated && (
        <button onClick={() => { setCalibration(null); setFilters({ measure: false }); notify("Calibration cleared"); }}
          className="w-full border border-red-900 py-1 font-mono text-[10px] text-red-400 hover:bg-red-950/30">
          CLEAR CALIBRATION
        </button>
      )}

      <p className="font-mono text-[9px] leading-relaxed text-zinc-600">
        VGGT reconstruction is up to scale. Two-point reference resolves metres-per-unit; all measured lengths, damage sizes and the association radius become metric.
      </p>
    </div>
  );
}
