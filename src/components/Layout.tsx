import { useStore } from "../store";
import type { Page } from "../store";
import CommandBar from "./CommandBar";

const TABS: { id: Page; label: string; hint: string }[] = [
  { id: "inspections", label: "INSPECTIONS", hint: "project browser" },
  { id: "viewer", label: "3D VIEWER", hint: "spatial damage map" },
  { id: "temporal", label: "TEMPORAL", hint: "t1 vs t2" },
  { id: "report", label: "REPORT", hint: "records + export" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { page, setPage, active, toast, calibrated, scale } = useStore();
  return (
    <div className="flex h-full flex-col bg-cad-bg text-[13px]">
      {/* top command bar */}
      <header className="flex h-11 shrink-0 items-center gap-4 border-b border-cad-border bg-cad-panel px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center bg-cad-accent font-mono text-[13px] font-bold text-black">SL</div>
          <span className="font-semibold tracking-wide">STRUCT LENS</span>
          <span className="ml-1 border border-cad-border px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">v1.0</span>
        </div>
        <nav className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setPage(t.id)}
              title={t.hint}
              className={`border-b-2 px-3 py-2.5 font-mono text-[11px] tracking-wider transition-colors ${
                page === t.id
                  ? "border-cad-accent text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-zinc-500">
          <span className="hidden md:inline">{active.meta.infrastructureId}</span>
          <span className="hidden md:inline">{active.meta.inspectionId}</span>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {children}
        {toast && (
          <div key={toast.id} className="absolute bottom-4 right-4 z-50 border border-cad-accent/60 bg-black/90 px-3 py-2 font-mono text-[11px] text-zinc-100 shadow-xl">
            {toast.msg}
          </div>
        )}
      </div>

      <CommandBar />

      {/* status bar */}
      <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-cad-border bg-cad-panel px-4 font-mono text-[11px] text-zinc-500">
        <span className="text-emerald-500">● READY</span>
        <span>PTS {active.cloud.count.toLocaleString()}</span>
        <span>DMG {active.damages.length}</span>
        <span className={calibrated ? "text-emerald-500" : "text-zinc-600"}>{calibrated ? `CAL ${scale.toFixed(4)} m/u` : "CAL —"}</span>
        <span className="hidden sm:inline">MODEL VGGT-1B · G-DINO · SAM2.1</span>
        <span className="ml-auto hidden md:inline">LOCAL PROJECT STORE · AUTOSAVE ON</span>
      </footer>
    </div>
  );
}
