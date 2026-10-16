import { useMemo, useState } from "react";
import Viewer3D from "../components/Viewer3D";
import DamagePanel from "../components/DamagePanel";
import UploadPanel from "../components/UploadPanel";
import { useStore } from "../store";
import { TYPE_COLORS } from "../types";
import type { DamageType } from "../types";
import { NAMED_VIEWS, viewportApi } from "../lib/viewportApi";

const TYPES = Object.keys(TYPE_COLORS) as DamageType[];

export default function ViewerPage() {
  const { active, selectedId, setSelectedId, filters, setFilters, visibleDamages, uploading, notify } = useStore();
  const selected = active.damages.find((d) => d.id === selectedId) ?? null;
  const [hover, setHover] = useState<{ x: number; y: number; z: number } | null>(null);
  const [measureDist, setMeasureDist] = useState<number | null>(null);

  const extents = useMemo(() => {
    const p = active.cloud.positions;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < active.cloud.count; i += 7) {
      for (let a = 0; a < 3; a++) {
        const v = p[i * 3 + a];
        if (v < min[a]) min[a] = v;
        if (v > max[a]) max[a] = v;
      }
    }
    return { min, max };
  }, [active.cloud]);

  const clipAxisIdx = filters.clip.axis === "x" ? 0 : filters.clip.axis === "y" ? 1 : 2;

  const snapshot = () => {
    const url = viewportApi.snapshot();
    if (!url) {
      notify("Snapshot unavailable");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.meta.inspectionId}_viewport.png`;
    a.click();
    notify("Viewport snapshot saved");
  };

  return (
    <div className="flex h-full min-h-0">
      {/* left tool palette */}
      <aside className="cad-scroll w-60 shrink-0 overflow-y-auto border-r border-cad-border bg-cad-panel">
        <Section title="Views">
          <div className="grid grid-cols-3 gap-1 px-3 pb-1">
            {Object.keys(NAMED_VIEWS).map((v) => (
              <button key={v} onClick={() => viewportApi.setView(NAMED_VIEWS[v])} className="border border-cad-border py-1 font-mono text-[10px] text-zinc-300 hover:border-zinc-500 hover:text-white">
                {v}
              </button>
            ))}
          </div>
          <div className="px-3 pb-1">
            <button onClick={() => viewportApi.zoomExtents()} className="w-full border border-cad-border py-1 font-mono text-[10px] text-zinc-300 hover:border-zinc-500 hover:text-white">
              ZOOM EXTENTS
            </button>
          </div>
        </Section>
        <Section title="Tools">
          <div className="space-y-1 px-3 pb-1">
            <button
              onClick={() => {
                setFilters({ measure: !filters.measure });
                setMeasureDist(null);
              }}
              className={`w-full border py-1 font-mono text-[10px] ${filters.measure ? "border-cad-accent text-cad-accent" : "border-cad-border text-zinc-300 hover:border-zinc-500"}`}
            >
              {filters.measure ? "■ MEASURE (ESC to exit)" : "MEASURE DISTANCE"}
            </button>
            <button onClick={snapshot} className="w-full border border-cad-border py-1 font-mono text-[10px] text-zinc-300 hover:border-zinc-500">
              SNAPSHOT PNG
            </button>
          </div>
        </Section>
        <Section title="Section clip">
          <div className="space-y-1.5 px-3 pb-1">
            <Check label="Enable clip" value={filters.clip.enabled} onChange={(v) => setFilters({ clip: { ...filters.clip, enabled: v } })} />
            <div className="flex gap-1">
              {(["x", "y", "z"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setFilters({ clip: { ...filters.clip, axis: a, value: (extents.min[clipAxisIdx] + extents.max[clipAxisIdx]) / 2 } })}
                  className={`flex-1 border py-0.5 font-mono text-[10px] uppercase ${filters.clip.axis === a ? "border-cad-accent text-cad-accent" : "border-cad-border text-zinc-400"}`}
                >
                  {a}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={extents.min[clipAxisIdx].toFixed(1)}
              max={extents.max[clipAxisIdx].toFixed(1)}
              step={0.2}
              value={Math.min(Math.max(filters.clip.value, extents.min[clipAxisIdx]), extents.max[clipAxisIdx])}
              disabled={!filters.clip.enabled}
              onChange={(e) => setFilters({ clip: { ...filters.clip, value: Number(e.target.value) } })}
              className="w-full accent-amber-500 disabled:opacity-30"
            />
            <div className="font-mono text-[10px] text-zinc-500">
              {filters.clip.axis.toUpperCase()} ≤ {filters.clip.value.toFixed(1)}
            </div>
          </div>
        </Section>
        <Section title="Layers">
          <Check label={`Point cloud (${active.cloud.count.toLocaleString()})`} value={filters.showCloud} onChange={(v) => setFilters({ showCloud: v })} />
          <Check label="Damage footprints" value={filters.showFootprints} onChange={(v) => setFilters({ showFootprints: v })} />
          <Check label="Damage markers" value={filters.showMarkers} onChange={(v) => setFilters({ showMarkers: v })} />
          <Check label="Cameras" value={filters.showCameras} onChange={(v) => setFilters({ showCameras: v })} />
          <Check label="Grid" value={filters.showGrid} onChange={(v) => setFilters({ showGrid: v })} />
        </Section>
        <Section title="Damage type">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilters({ types: { ...filters.types, [t]: !filters.types[t] } })}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-cad-panel2"
            >
              <span className={`flex h-3.5 w-3.5 items-center justify-center border text-[10px] ${filters.types[t] ? "border-zinc-500 text-emerald-400" : "border-cad-border text-transparent"}`}>✓</span>
              <span className="h-2 w-2" style={{ background: TYPE_COLORS[t] }} />
              <span className="font-mono text-[11px]">{t}</span>
              <span className="ml-auto font-mono text-[11px] text-zinc-500">{active.damages.filter((d) => d.type === t).length}</span>
            </button>
          ))}
        </Section>
        <Section title="Min confidence">
          <div className="px-3 pb-1">
            <input
              type="range" min={0} max={0.95} step={0.05}
              value={filters.minConfidence}
              onChange={(e) => setFilters({ minConfidence: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
            <div className="font-mono text-[11px] text-zinc-400">{(filters.minConfidence * 100).toFixed(0)}% → {visibleDamages.length} visible</div>
          </div>
        </Section>
        <Section title="Load data">
          <div className="px-3 pb-3"><UploadPanel /></div>
        </Section>
      </aside>

      {/* viewport */}
      <div className="relative min-w-0 flex-1 bg-[#0b0d11]">
        <Viewer3D
          cloud={active.cloud}
          damages={visibleDamages}
          footprints={active.footprints}
          cameras={active.cameras}
          selectedId={selectedId}
          onSelect={setSelectedId}
          layers={filters}
          onHover={setHover}
          onMeasure={setMeasureDist}
        />
        <div className="pointer-events-none absolute left-3 top-3 border border-cad-border bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
          {active.meta.infrastructureId} · {active.meta.inspectionId}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 font-mono text-[10px] text-zinc-500">
          <span>LMB orbit</span><span>RMB pan</span><span>Wheel zoom</span><span>Click marker = select</span>
          {filters.measure && <span className="text-cad-accent">MEASURE: click 2 cloud points</span>}
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 border border-cad-border bg-black/70 px-2 py-1 font-mono text-[10px] text-zinc-300">
          {hover ? `X ${hover.x.toFixed(2)}  Y ${hover.y.toFixed(2)}  Z ${hover.z.toFixed(2)}` : "X —  Y —  Z —"}
          {measureDist != null && <span className="ml-3 text-cad-accent">DIST {measureDist.toFixed(2)} m</span>}
        </div>
        {uploading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70">
            <div className="h-8 w-8 animate-spin border-2 border-cad-border border-t-cad-accent" />
            <div className="font-mono text-[11px] tracking-widest text-zinc-300">PARSING POINT CLOUD…</div>
          </div>
        )}
      </div>

      {/* right properties */}
      <aside className="flex w-72 shrink-0 flex-col border-l border-cad-border bg-cad-panel">
        <div className="border-b border-cad-border px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Properties</div>
        <div className="min-h-0 flex-1"><DamagePanel d={selected} temporal={active.temporal} /></div>
        <div className="border-t border-cad-border">
          <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Damage list ({visibleDamages.length})</div>
          <div className="cad-scroll max-h-44 overflow-y-auto pb-2">
            {visibleDamages.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`flex w-full items-center gap-2 px-3 py-1 font-mono text-[11px] hover:bg-cad-panel2 ${selectedId === d.id ? "bg-cad-panel2 text-white" : "text-zinc-400"}`}
              >
                <span className="h-2 w-2 shrink-0" style={{ background: TYPE_COLORS[d.type] }} />
                {d.id}
                <span className="ml-auto text-zinc-600">{(d.confidence * 100).toFixed(0)}%</span>
              </button>
            ))}
            {visibleDamages.length === 0 && <div className="px-3 py-2 font-mono text-[11px] text-zinc-600">No damages match filters.</div>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-cad-border py-2">
      <div className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{title}</div>
      {children}
    </div>
  );
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-cad-panel2">
      <span className={`flex h-3.5 w-3.5 items-center justify-center border text-[10px] ${value ? "border-zinc-500 text-emerald-400" : "border-cad-border text-transparent"}`}>✓</span>
      <span className="text-[12px] text-zinc-300">{label}</span>
    </button>
  );
}
