import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GizmoHelper, GizmoViewport, Grid, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CloudData, DamageRecord, Footprint } from "../types";
import { TYPE_COLORS } from "../types";
import { viewportApi } from "../lib/viewportApi";
import type { ClipState } from "../store";

function useClipPlanes(clip: ClipState): THREE.Plane[] {
  return useMemo(() => {
    if (!clip.enabled) return [];
    const n =
      clip.axis === "x" ? new THREE.Vector3(-1, 0, 0) : clip.axis === "y" ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, -1);
    return [new THREE.Plane(n, clip.value)];
  }, [clip.enabled, clip.axis, clip.value]);
}

function CloudPoints({ cloud, planes, onPick, pickable, size }: { cloud: CloudData; planes: THREE.Plane[]; onPick: (p: THREE.Vector3) => void; pickable: boolean; size: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(cloud.positions, 3));
    const col = new Float32Array(cloud.count * 3);
    for (let i = 0; i < cloud.count; i++) {
      col[i * 3] = cloud.colors[i * 3] / 255;
      col[i * 3 + 1] = cloud.colors[i * 3 + 1] / 255;
      col[i * 3 + 2] = cloud.colors[i * 3 + 2] / 255;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }, [cloud]);
  return (
    <points
      geometry={geom}
      frustumCulled={false}
      onClick={(e) => {
        if (!pickable) return;
        e.stopPropagation();
        onPick(e.point.clone());
      }}
    >
      <pointsMaterial size={size} vertexColors sizeAttenuation clippingPlanes={planes} />
    </points>
  );
}

function FootprintPoints({ fp, planes, size }: { fp: Footprint; planes: THREE.Plane[]; size: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(fp.positions, 3));
    return g;
  }, [fp]);
  return (
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial size={size} color={TYPE_COLORS[fp.type]} sizeAttenuation transparent opacity={0.95} clippingPlanes={planes} />
    </points>
  );
}

function DamageMarker({
  d,
  selected,
  dimmed,
  planes,
  onSelect,
}: {
  d: DamageRecord;
  selected: boolean;
  dimmed: boolean;
  planes: THREE.Plane[];
  onSelect: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);
  const pos = useMemo(() => new THREE.Vector3(d.location.x, d.location.y, d.location.z), [d.location]);
  useFrame(() => {
    const dist = camera.position.distanceTo(pos);
    const s = Math.max(0.0035, dist * 0.006) * (selected ? 1.5 : 1);
    ref.current?.scale.setScalar(s);
    halo.current?.scale.setScalar(s * 1.7);
  });
  return (
    <group position={pos.toArray() as [number, number, number]}>
      <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshBasicMaterial color={TYPE_COLORS[d.type]} depthTest={false} transparent opacity={dimmed ? 0.25 : 0.95} clippingPlanes={planes} />
      </mesh>
      {selected && (
        <>
          <mesh ref={halo}>
            <sphereGeometry args={[1, 14, 14]} />
            <meshBasicMaterial color="#ffffff" wireframe depthTest={false} transparent opacity={0.6} />
          </mesh>
          <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
            <div style={{ transform: "translateY(-18px)" }} className="whitespace-nowrap border border-cad-border bg-black/85 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white">
              {d.id} · {d.type} · {(d.confidence * 100).toFixed(0)}%
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

function CameraGlyph({ position, k }: { position: number[]; k: number }) {
  return (
    <mesh position={position as [number, number, number]}>
      <octahedronGeometry args={[0.22 * k]} />
      <meshBasicMaterial color="#f5d020" wireframe />
    </mesh>
  );
}

function MeasureLayer({
  active,
  planes,
  pts,
  setPts,
  onMeasured,
  unitScale = 1,
  unitLabel = "u",
}: {
  active: boolean;
  planes: THREE.Plane[];
  pts: THREE.Vector3[];
  setPts: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>;
  onMeasured: (d: number | null) => void;
  unitScale?: number;
  unitLabel?: string;
}) {
  useEffect(() => {
    viewportApi.clearMeasure = () => {
      setPts([]);
      onMeasured(null);
    };
    return () => {
      if (viewportApi.clearMeasure) viewportApi.clearMeasure = null;
    };
  }, [setPts, onMeasured]);
  useEffect(() => {
    if (!active) {
      setPts([]);
      onMeasured(null);
    }
  }, [active, setPts, onMeasured]);
  const camera = useThree((s) => s.camera);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    refs.current.forEach((m) => {
      if (!m) return;
      const d = camera.position.distanceTo(m.position);
      m.scale.setScalar(Math.max(d * 0.006, 1e-4));
    });
  });
  const lineGeom = useMemo(() => {
    if (pts.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [pts]);
  const dist = pts.length === 2 ? pts[0].distanceTo(pts[1]) : null;
  useEffect(() => {
    onMeasured(dist);
  }, [dist, onMeasured]);
  if (!active) return null;
  return (
    <group>
      {pts.map((p, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} position={p}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial color="#e8b33c" depthTest={false} />
        </mesh>
      ))}
      {lineGeom && (
        <lineSegments geometry={lineGeom} frustumCulled={false}>
          <lineBasicMaterial color="#e8b33c" clippingPlanes={planes} />
        </lineSegments>
      )}
      {pts.length === 2 && dist != null && (
        <Html position={pts[0].clone().add(pts[1]).multiplyScalar(0.5)} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap border border-cad-accent bg-black/85 px-1.5 py-0.5 font-mono text-[11px] leading-none text-cad-accent">
            {(dist * unitScale).toFixed(unitLabel === "m" ? 3 : 2)} {unitLabel}
          </div>
        </Html>
      )}
    </group>
  );
}

function ViewportRig({ cloud, k }: { cloud: CloudData; k: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const gl = useThree((s) => s.gl);
  const raycaster = useThree((s) => s.raycaster);
  useEffect(() => {
    viewportApi.camera = camera;
    viewportApi.controls = controls;
    viewportApi.gl = gl;
    raycaster.params.Points.threshold = 0.12 * k;
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < cloud.count; i += 10) {
      v.set(cloud.positions[i * 3], cloud.positions[i * 3 + 1], cloud.positions[i * 3 + 2]);
      box.expandByPoint(v);
    }
    viewportApi.bounds = box;
    return () => {
      viewportApi.camera = null;
      viewportApi.controls = null;
      viewportApi.gl = null;
      viewportApi.bounds = null;
    };
  }, [camera, controls, gl, raycaster, cloud, k]);
  return null;
}

interface Props {
  cloud: CloudData;
  damages: DamageRecord[];
  footprints: Footprint[];
  cameras: number[][];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  layers: { showCloud: boolean; showFootprints: boolean; showMarkers: boolean; showCameras: boolean; showGrid: boolean; measure: boolean; clip: ClipState };
  onHover: (p: { x: number; y: number; z: number } | null) => void;
  onMeasure: (d: number | null) => void;
  unitScale?: number;
  unitLabel?: string;
}

export default function Viewer3D({ cloud, damages, footprints, cameras, selectedId, onSelect, layers, onHover, onMeasure, unitScale = 1, unitLabel = "u" }: Props) {
  const footById = useMemo(() => new Map(footprints.map((f) => [f.damageId, f])), [footprints]);
  const planes = useClipPlanes(layers.clip);
  const measuring = layers.measure;
  const [mPts, setMPts] = useState<THREE.Vector3[]>([]);
  const [ray] = useState(() => new THREE.Raycaster());
  const [plane] = useState(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  const { k, pointSize } = useMemo(() => {
    const n = cloud.count;
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i += 25) {
      v.set(cloud.positions[i * 3], cloud.positions[i * 3 + 1], cloud.positions[i * 3 + 2]);
      box.expandByPoint(v);
    }
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const k = maxDim / 40;

    const target = 1200;
    const stride = Math.max(1, Math.floor(n / target));
    const sx: number[][] = [];
    for (let i = 0; i < n; i += stride) sx.push([cloud.positions[i * 3], cloud.positions[i * 3 + 1], cloud.positions[i * 3 + 2]]);
    let spacing = maxDim / Math.max(1, Math.cbrt(n));
    if (sx.length >= 2) {
      const nn: number[] = [];
      for (let a = 0; a < sx.length; a++) {
        const pa = sx[a];
        let best = Infinity;
        for (let b = 0; b < sx.length; b++) {
          if (a === b) continue;
          const pb = sx[b];
          const dx = pa[0] - pb[0], dy = pa[1] - pb[1], dz = pa[2] - pb[2];
          const d = dx * dx + dy * dy + dz * dz;
          if (d < best) best = d;
        }
        nn.push(Math.sqrt(best));
      }
      nn.sort((x, y) => x - y);
      spacing = nn[Math.floor(nn.length / 2)] || spacing;
    }
    const pointSize = Math.min(maxDim * 0.03, Math.max(maxDim * 0.0003, spacing));
    return { k, pointSize };
  }, [cloud]);

  return (
    <Canvas
      camera={{ position: [20 * k, 11 * k, 20 * k], fov: 50, near: 0.1 * k, far: 600 * k }}
      gl={{ antialias: true, localClippingEnabled: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => {
        if (!measuring) onSelect(null);
      }}
      onPointerMove={(e) => {
        const cam = viewportApi.camera;
        if (!cam) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        ray.setFromCamera(ndc, cam);
        const hit = new THREE.Vector3();
        if (ray.ray.intersectPlane(plane, hit)) onHover({ x: hit.x, y: hit.y, z: hit.z });
      }}
      onPointerLeave={() => onHover(null)}
      className="cad-viewport"
    >
      <color attach="background" args={["#0b0d11"]} />
      <ambientLight intensity={0.9} />
      {layers.showGrid && (
        <Grid
          infiniteGrid
          cellSize={1 * k}
          sectionSize={5 * k}
          cellColor="#1c212c"
          sectionColor="#2c3442"
          fadeDistance={90 * k}
          fadeStrength={2}
        />
      )}
      {layers.showCloud && (
        <CloudPoints
          cloud={cloud}
          planes={planes}
          pickable={measuring}
          size={pointSize}
          onPick={(p) => setMPts((prev) => (prev.length >= 2 ? [p] : [...prev, p]))}
        />
      )}
      {layers.showFootprints &&
        damages.map((d) => {
          const fp = footById.get(d.id);
          return fp ? <FootprintPoints key={d.id} fp={fp} planes={planes} size={pointSize} /> : null;
        })}
      {layers.showMarkers &&
        damages.map((d) => (
          <DamageMarker
            key={d.id}
            d={d}
            selected={selectedId === d.id}
            dimmed={measuring}
            planes={planes}
            onSelect={() => {
              if (!measuring) onSelect(d.id);
            }}
          />
        ))}
      {layers.showCameras && cameras.map((c, i) => <CameraGlyph key={i} position={c} k={k} />)}
      <MeasureLayer active={measuring} planes={planes} pts={mPts} setPts={setMPts} onMeasured={onMeasure} unitScale={unitScale} unitLabel={unitLabel} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxDistance={160 * k} />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport labelColor="white" axisColors={["#e64545", "#4caf50", "#4285f4"]} />
      </GizmoHelper>
      <ViewportRig cloud={cloud} k={k} />
    </Canvas>
  );
}
