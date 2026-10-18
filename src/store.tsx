import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Calibration, DamageType, InspectionDataset, ReviewStatus } from "./types";
import { DEMO_INSPECTIONS } from "./data/demo";
import { buildUploadDataset } from "./lib/reportAdapter";

export type Page = "inspections" | "viewer" | "temporal" | "report";

export interface ClipState {
  enabled: boolean;
  axis: "x" | "y" | "z";
  value: number;
}

interface Filters {
  types: Record<DamageType, boolean>;
  minConfidence: number;
  showCloud: boolean;
  showFootprints: boolean;
  showMarkers: boolean;
  showCameras: boolean;
  showGrid: boolean;
  measure: boolean;
  clip: ClipState;
}

interface Store {
  page: Page;
  setPage: (p: Page) => void;
  inspections: InspectionDataset[];
  active: InspectionDataset;
  selectInspection: (key: string) => void;
  addInspection: (ds: InspectionDataset) => void;
  uploadDataset: (files: { cloud: File; report?: File | null; damageCloud?: File | null; damageIndex?: File | null }) => Promise<string | null>;
  uploading: boolean;
  uploadNotice: string | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  calibrations: Record<string, Calibration>;
  setCalibration: (cal: Calibration | null) => void;
  calibration: Calibration | null;
  calibrated: boolean;
  scale: number;
  reviews: Record<string, Record<string, ReviewStatus>>;
  setReview: (damageId: string, status: ReviewStatus) => void;
  reviewOf: (damageId: string) => ReviewStatus;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  visibleDamages: InspectionDataset["damages"];
  toast: { id: number; msg: string } | null;
  notify: (msg: string) => void;
}

const LS_KEY = "iv3d-v1";

function loadPersisted(): { page: Page; activeKey: string; filters: Filters; calibrations: Record<string, Calibration>; reviews: Record<string, Record<string, ReviewStatus>> } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<{ page: Page; activeKey: string; filters: Filters; calibrations: Record<string, Calibration>; reviews: Record<string, Record<string, ReviewStatus>> }>;
    if (!p || typeof p !== "object") return null;
    return {
      page: ["inspections", "viewer", "temporal", "report"].includes(p.page as string) ? (p.page as Page) : "inspections",
      activeKey: typeof p.activeKey === "string" ? p.activeKey : DEMO_INSPECTIONS[0].key,
      filters: { ...defaultFilters(), ...(p.filters ?? {}), types: { ...defaultFilters().types, ...(p.filters?.types ?? {}) } },
      calibrations: p.calibrations && typeof p.calibrations === "object" ? p.calibrations : {},
      reviews: p.reviews && typeof p.reviews === "object" ? p.reviews : {},
    };
  } catch {
    return null;
  }
}

const defaultFilters = (): Filters => ({
  types: { crack: true, spalling: true, corrosion: true, surface_damage: true },
  minConfidence: 0,
  showCloud: true,
  showFootprints: true,
  showMarkers: true,
  showCameras: true,
  showGrid: true,
  measure: false,
  clip: { enabled: false, axis: "x", value: 0 },
});

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersisted();
  const [page, setPage] = useState<Page>(persisted?.page ?? "inspections");
  const [inspections, setInspections] = useState<InspectionDataset[]>(DEMO_INSPECTIONS);
  const [activeKey, setActiveKey] = useState(persisted?.activeKey ?? DEMO_INSPECTIONS[0].key);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calibrations, setCalibrations] = useState<Record<string, Calibration>>(persisted?.calibrations ?? {});
  const [reviews, setReviews] = useState<Record<string, Record<string, ReviewStatus>>>(persisted?.reviews ?? {});
  const [filters, setFiltersRaw] = useState<Filters>(persisted?.filters ?? defaultFilters());
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const notify = useCallback((msg: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg });
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ page, activeKey, filters, calibrations, reviews }));
    } catch {
      /* private mode — ignore */
    }
  }, [page, activeKey, filters, calibrations, reviews]);

  const active = useMemo(
    () => inspections.find((d) => d.key === activeKey) ?? inspections[0],
    [inspections, activeKey],
  );

  const selectInspection = useCallback(
    (key: string) => {
      setActiveKey(key);
      setSelectedId(null);
      setFiltersRaw(defaultFilters());
      setPage("viewer");
    },
    [],
  );

  const uploadDataset = useCallback(async (files: { cloud: File; report?: File | null; damageCloud?: File | null; damageIndex?: File | null }) => {
    setUploading(true);
    setUploadNotice(null);
    try {
      const { dataset, skippedFootprints } = await buildUploadDataset(files);
      setInspections((prev) => [dataset, ...prev.filter((d) => d.source === "demo" || d.key !== dataset.key)]);
      setActiveKey(dataset.key);
      setSelectedId(null);
      setFiltersRaw(defaultFilters());
      setUploadNotice(
        skippedFootprints
          ? `Loaded ${dataset.cloud.count.toLocaleString()} pts, ${dataset.damages.length} damages. Footprints unavailable — provide damages.ply + damage_index.json together.`
          : `Loaded ${dataset.cloud.count.toLocaleString()} pts, ${dataset.damages.length} damages, ${dataset.footprints.length} footprints.`,
      );
      setPage("viewer");
      notify(`Dataset loaded: ${dataset.cloud.count.toLocaleString()} pts, ${dataset.damages.length} damages`);
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Parse failed";
      setUploadNotice(`Upload failed: ${msg}`);
      notify(`Upload failed: ${msg}`);
      return msg;
    } finally {
      setUploading(false);
    }
  }, []);

  const setFilters = useCallback((f: Partial<Filters>) => setFiltersRaw((p) => ({ ...p, ...f })), []);

  const addInspection = useCallback(
    (ds: InspectionDataset) => {
      setInspections((prev) => [ds, ...prev.filter((d) => d.key !== ds.key)]);
      setActiveKey(ds.key);
      setSelectedId(null);
      setFiltersRaw(defaultFilters());
      setPage("viewer");
    },
    [],
  );

  const visibleDamages = useMemo(
    () =>
      active.damages.filter(
        (d) => filters.types[d.type] && d.confidence >= filters.minConfidence,
      ),
    [active, filters],
  );

  const setCalibration = useCallback(
    (cal: Calibration | null) => {
      setCalibrations((prev) => {
        const next = { ...prev };
        if (cal) next[activeKey] = cal;
        else delete next[activeKey];
        return next;
      });
    },
    [activeKey],
  );

  const calibration = calibrations[activeKey] ?? null;
  const calibrated = !!calibration && calibration.scale > 0;
  const scale = calibrated ? (calibration as Calibration).scale : 1;

  const setReview = useCallback(
    (damageId: string, status: ReviewStatus) => {
      setReviews((prev) => {
        const next = { ...prev, [activeKey]: { ...(prev[activeKey] ?? {}), [damageId]: status } };
        return next;
      });
    },
    [activeKey],
  );

  const reviewOf = useCallback(
    (damageId: string): ReviewStatus => reviews[activeKey]?.[damageId] ?? "pending",
    [reviews, activeKey],
  );

  return (
    <Ctx.Provider
      value={{ page, setPage, inspections, active, selectInspection, addInspection, uploadDataset, uploading, uploadNotice, selectedId, setSelectedId, calibrations, setCalibration, calibration, calibrated, scale, reviews, setReview, reviewOf, filters, setFilters, visibleDamages, toast, notify }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}
