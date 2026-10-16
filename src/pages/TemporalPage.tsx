import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "../store";
import { TYPE_COLORS } from "../types";

export default function TemporalPage() {
  const { active } = useStore();
  const rows = active.temporal.map((t) => ({
    id: t.currId,
    type: t.type,
    prev: t.lenPrev ?? 0,
    curr: t.lenCurr,
    growth: t.growth ?? 0,
    status: t.status,
  }));
  const persisted = rows.filter((r) => r.status === "persisted");

  return (
    <div className="cad-scroll h-full overflow-y-auto p-5">
      <h1 className="text-lg font-semibold tracking-wide">TEMPORAL COMPARISON</h1>
      <p className="mb-4 font-mono text-[11px] text-zinc-500">
        {active.meta.inspectionId} vs previous inspection · same spatial reference · {persisted.length} persisted / {rows.filter((r) => r.status === "new").length} new
      </p>
      {rows.length === 0 ? (
        <div className="border border-cad-border bg-cad-panel p-6 font-mono text-[12px] text-zinc-500">
          No temporal data — load a dataset whose report contains a previous inspection.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          <div className="border border-cad-border bg-cad-panel p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Length t-1 → t (m, relative VGGT scale)</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rows} margin={{ top: 5, right: 10, bottom: 0, left: -15 }}>
                <CartesianGrid stroke="#232833" />
                <XAxis dataKey="id" tick={{ fill: "#8a8f9a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8a8f9a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#171a20", border: "1px solid #2a2f3a", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="prev" name="previous" fill="#4b5263" />
                <Bar dataKey="curr" name="current">
                  {rows.map((r, i) => (
                    <Cell key={i} fill={TYPE_COLORS[r.type]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="border border-cad-border bg-cad-panel p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Growth Δ per damage (m)</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={persisted} margin={{ top: 5, right: 10, bottom: 0, left: -15 }}>
                <CartesianGrid stroke="#232833" />
                <XAxis dataKey="id" tick={{ fill: "#8a8f9a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8a8f9a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#171a20", border: "1px solid #2a2f3a", fontSize: 12 }} />
                <Line type="monotone" dataKey="growth" name="growth" stroke="#e8b33c" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="border border-cad-border bg-cad-panel 2xl:col-span-2">
            <div className="border-b border-cad-border px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Tracking table</div>
            <table className="w-full font-mono text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-600">
                  {["Current", "Previous", "Type", "Prev len", "Curr len", "Growth", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-cad-border text-zinc-300">
                    <td className="px-3 py-1.5 text-white">{r.id}</td>
                    <td className="px-3 py-1.5">{active.temporal.find((t) => t.currId === r.id)?.prevId ?? "—"}</td>
                    <td className="px-3 py-1.5" style={{ color: TYPE_COLORS[r.type] }}>{r.type}</td>
                    <td className="px-3 py-1.5">{r.prev.toFixed(2)}</td>
                    <td className="px-3 py-1.5">{r.curr.toFixed(2)}</td>
                    <td className={`px-3 py-1.5 ${r.growth > 0 ? "text-red-400" : "text-zinc-400"}`}>{r.growth > 0 ? `+${r.growth.toFixed(2)}` : r.growth.toFixed(2)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`border px-1.5 py-0.5 text-[10px] ${r.status === "persisted" ? "border-zinc-600 text-zinc-300" : "border-amber-700 text-amber-400"}`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
