import { useState } from "react";
import { useStore } from "../store";
import type { DamageType } from "../types";
import { NAMED_VIEWS, viewportApi } from "../lib/viewportApi";

const TYPES: DamageType[] = ["crack", "spalling", "corrosion", "surface_damage"];

export default function CommandBar() {
  const { setPage, inspections, selectInspection, setSelectedId, filters, setFilters, notify, visibleDamages } = useStore();
  const [value, setValue] = useState("");
  const [last, setLast] = useState("_Type a command (HELP for list)");

  const say = (msg: string) => {
    setLast(msg);
    notify(msg);
  };

  const run = (raw: string) => {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return;
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");
    switch (cmd) {
      case "help":
        setLast("OPEN <id> · SELECT <D-xxx|none> · ISOLATE <type|all> · LAYER <name> <on|off> · MEASURE <on|off> · CLIP <x|y|z value|off> · VIEW <iso|top|front|right|left> · ZOOM EXTENTS · SNAPSHOT · GOTO <page>");
        break;
      case "goto":
        if (["inspections", "viewer", "temporal", "report"].includes(arg)) {
          setPage(arg as "viewer");
          setLast(`_Switched to ${arg}`);
        } else setLast(`_Unknown page "${arg}"`);
        break;
      case "open": {
        const hit = inspections.find(
          (d) => d.key.toLowerCase() === arg.toLowerCase() || d.meta.inspectionId.toLowerCase() === arg.toLowerCase() || d.meta.infrastructureId.toLowerCase() === arg.toLowerCase(),
        );
        if (hit) {
          selectInspection(hit.key);
          say(`Opened ${hit.meta.inspectionId}`);
        } else setLast(`_Inspection "${arg}" not found`);
        break;
      }
      case "select": {
        if (arg.toLowerCase() === "none") {
          setSelectedId(null);
          setLast("_Selection cleared");
        } else {
          const hit = visibleDamages.find((d) => d.id.toLowerCase() === arg.toLowerCase());
          if (hit) {
            setSelectedId(hit.id);
            say(`Selected ${hit.id} (${hit.type})`);
          } else setLast(`_Damage "${arg}" not found`);
        }
        break;
      }
      case "isolate": {
        if (arg.toLowerCase() === "all") {
          setFilters({ types: { crack: true, spalling: true, corrosion: true, surface_damage: true } });
          setLast("_All types visible");
        } else if ((TYPES as string[]).includes(arg.toLowerCase())) {
          const t = arg.toLowerCase() as DamageType;
          setFilters({ types: { crack: false, spalling: false, corrosion: false, surface_damage: false, [t]: true } });
          say(`Isolated ${t}`);
        } else setLast(`_Unknown type "${arg}"`);
        break;
      }
      case "layer": {
        const [name, state] = arg.toLowerCase().split(/\s+/);
        const on = state !== "off";
        const map: Record<string, "showCloud" | "showFootprints" | "showMarkers" | "showCameras" | "showGrid"> = {
          cloud: "showCloud", footprints: "showFootprints", markers: "showMarkers", cameras: "showCameras", grid: "showGrid",
        };
        if (map[name]) {
          setFilters({ [map[name]]: on } as Partial<typeof filters>);
          say(`Layer ${name} ${on ? "on" : "off"}`);
        } else setLast(`_Unknown layer "${name}" (cloud|footprints|markers|cameras|grid)`);
        break;
      }
      case "measure":
        setFilters({ measure: arg.toLowerCase() !== "off" });
        say(arg.toLowerCase() === "off" ? "Measure off" : "Measure on — click two cloud points");
        break;
      case "clip": {
        const [axis, val] = arg.toLowerCase().split(/\s+/);
        if (axis === "off" || !axis) {
          setFilters({ clip: { ...filters.clip, enabled: false } });
          say("Clip off");
        } else if (["x", "y", "z"].includes(axis) && val != null && !Number.isNaN(Number(val))) {
          setFilters({ clip: { enabled: true, axis: axis as "x" | "y" | "z", value: Number(val) } });
          say(`Clip ${axis} ≤ ${val}`);
        } else setLast('_Usage: CLIP <x|y|z value|off>, e.g. "clip x 5"');
        break;
      }
      case "view": {
        const v = NAMED_VIEWS[arg.toUpperCase()];
        if (v) {
          viewportApi.setView(v);
          say(`View ${arg.toUpperCase()}`);
        } else setLast("_Unknown view (iso|top|front|right|left)");
        break;
      }
      case "zoom":
        viewportApi.zoomExtents();
        say("Zoom extents");
        break;
      case "snapshot": {
        const url = viewportApi.snapshot();
        if (url) {
          const a = document.createElement("a");
          a.href = url;
          a.download = "infravision_viewport.png";
          a.click();
          say("Viewport snapshot saved");
        } else setLast("_Snapshot unavailable (open 3D viewer first)");
        break;
      }
      default:
        setLast(`_Unknown command "${cmd}" — type HELP`);
    }
  };

  return (
    <div className="border-t border-cad-border bg-cad-panel">
      <div className="truncate px-4 pt-1 font-mono text-[10px] text-zinc-600">{last}</div>
      <form
        className="flex items-center gap-2 px-4 pb-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          run(value);
          setValue("");
        }}
      >
        <span className="font-mono text-[12px] text-cad-accent">&gt;_</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="command…"
          spellCheck={false}
          autoComplete="off"
          className="w-full bg-transparent font-mono text-[12px] uppercase text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
        />
      </form>
    </div>
  );
}
