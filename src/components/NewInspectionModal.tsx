import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { extractVideoFrames, fmtBytes, ingestImages, type IngestedImage, type VideoInfo } from "../lib/ingest";
import { runFakePipeline, STAGES } from "../lib/fakePipeline";

export default function NewInspectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addInspection, notify } = useStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [infraId, setInfraId] = useState("TUNNEL-002");
  const [infraType, setInfraType] = useState("tunnel");
  const [inspector, setInspector] = useState("Field Inspector");
  const [date, setDate] = useState("2026-10-16");
  const [images, setImages] = useState<IngestedImage[]>([]);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [stage, setStage] = useState(-1);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setStage(-1);
      setLogs([]);
      setProgress(0);
      setRunning(false);
      cancelRef.current = false;
    }
  }, [open ]);

  if (!open) return null;
  const views = images.length + (video?.thumbs.length ?? 0);

  const pickPhotos = async (files: FileList | null) => {
    if (!files) return;
    const list = await ingestImages([...files].filter((f) => f.type.startsWith("image/")));
    setImages((p) => [...p, ...list]);
  };

  const pickVideo = async (f: File | null) => {
    if (!f) return;
    setVideoBusy(true);
    setVideoErr(null);
    try {
      setVideo(await extractVideoFrames(f, 8));
    } catch (e) {
      setVideoErr(e instanceof Error ? e.message : "Video decode failed");
    } finally {
      setVideoBusy(false);
    }
  };

  const run = async () => {
    setStep(3);
    setRunning(true);
    setLogs([]);
    setStage(-1);
    setProgress(0);
    cancelRef.current = false;
    try {
      const ds = await runFakePipeline(
        {
          images,
          videoName: video?.name ?? null,
          videoFrames: video?.thumbs.length ?? 0,
          infrastructureId: infraId,
          infrastructureType: infraType,
          inspector,
          inspectionDate: date,
        },
        {
          onStage: setStage,
          onLog: (l) => setLogs((p) => [...p.slice(-300), l]),
          onProgress: setProgress,
          shouldCancel: () => cancelRef.current,
        },
      );
      addInspection(ds);
      notify(`Inspection ${ds.meta.inspectionId} ready — ${ds.damages.length} damages`);
      onClose();
    } catch {
      if (!cancelRef.current) notify("Pipeline failed unexpectedly");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => !running && onClose()}>
      <div className="flex max-h-[92vh] w-[880px] max-w-full flex-col border border-cad-border bg-cad-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-cad-border px-4 py-2.5">
          <span className="font-mono text-[13px] font-bold tracking-wider">NEW INSPECTION</span>
          <StepDots step={step} />
          <button onClick={() => !running && onClose()} className="ml-auto font-mono text-zinc-500 hover:text-white">✕</button>
        </div>

        {step === 1 && (
          <div className="cad-scroll grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
            <div className="space-y-3">
              <Field label="Infrastructure ID"><input value={infraId} onChange={(e) => setInfraId(e.target.value)} className={inp} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select value={infraType} onChange={(e) => setInfraType(e.target.value)} className={inp}>
                    {["tunnel", "bridge", "building", "dam", "road"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></Field>
              </div>
              <Field label="Inspector"><input value={inspector} onChange={(e) => setInspector(e.target.value)} className={inp} /></Field>
              <div className="border border-dashed border-cad-border p-3">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Photos (multi-view, ≥2)</div>
                <label className="block cursor-pointer border border-cad-border bg-cad-bg px-3 py-2 text-center font-mono text-[11px] text-zinc-300 hover:border-zinc-500">
                  + ADD PHOTOS
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickPhotos(e.target.files)} />
                </label>
                <div className="mt-2 font-mono text-[10px] text-zinc-500">{images.length} photos selected</div>
              </div>
              <div className="border border-dashed border-cad-border p-3">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Video (optional — frames auto-extracted)</div>
                <label className="block cursor-pointer border border-cad-border bg-cad-bg px-3 py-2 text-center font-mono text-[11px] text-zinc-300 hover:border-zinc-500">
                  + ADD VIDEO
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => pickVideo(e.target.files?.[0] ?? null)} />
                </label>
                {videoBusy && <div className="mt-2 font-mono text-[10px] text-cad-accent">Extracting frames…</div>}
                {videoErr && <div className="mt-2 font-mono text-[10px] text-red-400">{videoErr}</div>}
                {video && <div className="mt-2 font-mono text-[10px] text-emerald-400">{video.name} · {video.duration.toFixed(1)}s · {video.thumbs.length} frames</div>}
              </div>
            </div>
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Thumbnails ({images.length + (video?.thumbs.length ?? 0)})</div>
              <div className="cad-scroll grid max-h-[46vh] grid-cols-4 gap-1.5 overflow-y-auto">
                {images.map((im) => (
                  <div key={im.url} className="border border-cad-border">
                    <img src={im.url} className="aspect-square w-full object-cover" alt={im.name} />
                    <div className="truncate bg-cad-bg px-1 py-0.5 font-mono text-[9px] text-zinc-500">{im.width}×{im.height}</div>
                  </div>
                ))}
                {video?.thumbs.map((t, i) => (
                  <div key={t} className="border border-amber-900">
                    <img src={t} className="aspect-square w-full object-cover" alt={`frame ${i}`} />
                    <div className="bg-cad-bg px-1 py-0.5 font-mono text-[9px] text-amber-500/80">frame_{String(i + 1).padStart(3, "0")}</div>
                  </div>
                ))}
                {views === 0 && <div className="col-span-4 border border-cad-border p-6 text-center font-mono text-[11px] text-zinc-600">No media yet — add photos or a video.</div>}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="cad-scroll flex-1 overflow-y-auto p-4">
            <div className="mb-3 grid grid-cols-2 gap-px border border-cad-border bg-cad-border font-mono md:grid-cols-4">
              <Sum label="VIEWS" value={String(views)} />
              <Sum label="PHOTOS" value={String(images.length)} />
              <Sum label="VIDEO FRAMES" value={String(video?.thumbs.length ?? 0)} />
              <Sum label="SIZE" value={fmtBytes(images.reduce((a, i) => a + i.size, 0) + (video?.size ?? 0))} />
            </div>
            <div className="mb-3 border border-cad-border bg-cad-bg p-3 font-mono text-[11px] text-zinc-400">
              Pipeline: VGGT-1B (fp16) → GroundingDINO <span className="text-zinc-600">crack . rust stain . corrosion . spalling . exposed rebar . concrete damage</span> → SAM2 hiera-small → 2D→3D → association (r=0.35) → map + report. GPU T4 required — available.
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Input files</div>
            <div className="cad-scroll mt-1 max-h-40 overflow-y-auto border border-cad-border">
              {images.map((im) => (
                <div key={im.url} className="flex justify-between border-b border-cad-border px-2 py-1 font-mono text-[11px] text-zinc-400">
                  <span className="truncate">{im.name}</span>
                  <span className="ml-2 shrink-0 text-zinc-600">{im.width}×{im.height} · {fmtBytes(im.size)}</span>
                </div>
              ))}
              {video && <div className="flex justify-between px-2 py-1 font-mono text-[11px] text-zinc-400"><span className="truncate">{video.name}</span><span className="ml-2 shrink-0 text-zinc-600">{video.duration.toFixed(1)}s</span></div>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[220px_1fr]">
            <div className="border-r border-cad-border p-3">
              {STAGES.map((s, i) => (
                <div key={s} className="flex items-center gap-2 py-1.5 font-mono text-[11px]">
                  <span className={`flex h-4 w-4 items-center justify-center border text-[10px] ${i < stage ? "border-emerald-600 text-emerald-400" : i === stage ? "animate-pulse border-cad-accent text-cad-accent" : "border-cad-border text-zinc-700"}`}>
                    {i < stage ? "✓" : i === stage ? "…" : ""}
                  </span>
                  <span className={i === stage ? "text-white" : i < stage ? "text-zinc-400" : "text-zinc-600"}>{s}</span>
                </div>
              ))}
              <div className="mt-3 border border-cad-border bg-cad-bg p-2">
                <div className="mb-1 flex justify-between font-mono text-[10px] text-zinc-500"><span>OVERALL</span><span>{(progress * 100).toFixed(0)}%</span></div>
                <div className="h-1.5 bg-cad-border"><div className="h-full bg-cad-accent transition-all" style={{ width: `${progress * 100}%` }} /></div>
              </div>
            </div>
            <div ref={logRef} className="cad-scroll h-[46vh] overflow-y-auto bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
              {logs.map((l, i) => <div key={i} className="whitespace-pre-wrap">{l}</div>)}
              {running && <div className="animate-pulse text-cad-accent">▊</div>}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-cad-border px-4 py-2.5">
          {step === 3 ? (
            <>
              <span className="font-mono text-[10px] text-zinc-600">Do not close while the pipeline is running.</span>
              <button onClick={() => { cancelRef.current = true; }} disabled={!running} className="ml-auto border border-red-900 px-4 py-1.5 font-mono text-[11px] text-red-400 disabled:opacity-30">ABORT</button>
            </>
          ) : (
            <>
              {step === 2 && <button onClick={() => setStep(1)} className="border border-cad-border px-4 py-1.5 font-mono text-[11px] text-zinc-300">← BACK</button>}
              <span className="font-mono text-[10px] text-zinc-600">{views} views {views < 2 ? "(need ≥2)" : "ready"}</span>
              {step === 1 && <button disabled={views < 2} onClick={() => setStep(2)} className="ml-auto bg-cad-accent px-5 py-1.5 font-mono text-[11px] font-bold text-black disabled:opacity-30">REVIEW →</button>}
              {step === 2 && <button disabled={views < 2} onClick={run} className="ml-auto bg-cad-accent px-5 py-1.5 font-mono text-[11px] font-bold text-black disabled:opacity-30">▶ RUN AI PIPELINE</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inp = "w-full border border-cad-border bg-cad-bg px-2 py-1.5 font-mono text-[12px] text-zinc-100 focus:border-zinc-500 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function Sum({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cad-panel p-2.5">
      <div className="text-[9px] tracking-wider text-zinc-600">{label}</div>
      <div className="text-[15px] text-white">{value}</div>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px]">
      {(["SOURCE", "REVIEW", "PIPELINE"] as const).map((s, i) => (
        <span key={s} className={`border px-1.5 py-0.5 ${step === i + 1 ? "border-cad-accent text-cad-accent" : step > i + 1 ? "border-emerald-800 text-emerald-500" : "border-cad-border text-zinc-600"}`}>{i + 1} {s}</span>
      ))}
    </div>
  );
}
