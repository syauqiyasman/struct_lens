import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
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

function CloudPoints({ cloud, planes, onPick, pickable }: { cloud: CloudData; planes: THREE.Plane[]; onPick: (p: THREE.Vector3) => void; pickable: boolean }) {
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
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 40);
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
      <pointsMaterial size={0.06} vertexColors sizeAttenuation clippingPlanes={planes} />
    </points>
  );
}

function FootprintPoints({ fp, planes }: { fp: Footprint; planes: THREE.Plane[] }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(fp.positions, 3));
    return g;
  }, [fp]);
  return (
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial size={0.09} color={TYPE_COLORS[fp.type]} sizeAttenuation transparent opacity={0.95} clippingPlanes={planes} />
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
  const { camera } = useThree();
  const dist = camera.position.distanceTo(new THREE.Vector3(d.location.x, d.location.y, d.location.z));
  const s = Math.max(0.12, dist * 0.012) * (selected ? 1.6 : 1);
  return (
    <group position={[d.location.x, d.location.y, d.location.z]}>
      <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[s, 12, 12]} />
        <meshBasicMaterial color={TYPE_COLORS[d.type]} depthTest={false} transparent opacity={dimmed ? 0.25 : 0.95} clippingPlanes={planes} />
      </mesh>
      {selected && (
        <>
          <mesh>
            <sphereGeometry args={[s * 1.7, 12, 12]} />
            <meshBasicMaterial color="#ffffff" wireframe depthTest={false} transparent opacity={0.6} />
          </mesh>
          <Html distanceFactor={12} position={[0, s * 2.4, 0]} center style={{ pointerEvents: "none" }}>
            <div className="border border-cad-border bg-black/85 px-2 py-1 font-mono text-[11px] text-white">
              {d.id} · {d.type} · {(d.confidence * 100).toFixed(0)}%
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

function CameraGlyph({ position }: { position: number[] }) {
  return (
    <mesh position={position as [number, number, number]}>
      <octahedronGeometry args={[0.22]} />
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
}: {
  active: boolean;
  planes: THREE.Plane[];
  pts: THREE.Vector3[];
  setPts: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>;
  onMeasured: (d: number | null) => void;
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
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshBasicMaterial color="#e8b33c" depthTest={false} />
        </mesh>
      ))}
      {lineGeom && (
        <lineSegments geometry={lineGeom} frustumCulled={false}>
          <lineBasicMaterial color="#e8b33c" clippingPlanes={planes} />
        </lineSegments>
      )}
      {pts.length === 2 && dist != null && (
        <Html position={pts[0].clone().add(pts[1]).multiplyScalar(0.5)} center distanceFactor={14} style={{ pointerEvents: "none" }}>
          <div className="border border-cad-accent bg-black/85 px-2 py-0.5 font-mono text-[11px] text-cad-accent">
            {dist.toFixed(2)} m
          </div>
        </Html>
      )}
    </group>
  );
}

function ViewportRig({ cloud }: { cloud: CloudData }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const gl = useThree((s) => s.gl);
  const raycaster = useThree((s) => s.raycaster);
  useEffect(() => {
    viewportApi.camera = camera;
    viewportApi.controls = controls;
    viewportApi.gl = gl;
    raycaster.params.Points.threshold = 0.12;
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
  }, [camera, controls, gl, raycaster, cloud]);
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
}

export default function Viewer3D({ cloud, damages, footprints, cameras, selectedId, onSelect, layers, onHover, onMeasure }: Props) {
  const footById = useMemo(() => new Map(footprints.map((f) => [f.damageId, f])), [footprints]);
  const planes = useClipPlanes(layers.clip);
  const measuring = layers.measure;
  const [mPts, setMPts] = useState<THREE.Vector3[]>([]);
  const [ray] = useState(() => new THREE.Raycaster());
  const [plane] = useState(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  return (
    <Canvas
      camera={{ position: [20, 11, 20], fov: 50, near: 0.1, far: 600 }}
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
          cellSize={1}
          sectionSize={5}
          cellColor="#1c212c"
          sectionColor="#2c3442"
          fadeDistance={90}
          fadeStrength={2}
        />
      )}
      {layers.showCloud && (
        <CloudPoints
          cloud={cloud}
          planes={planes}
          pickable={measuring}
          onPick={(p) => setMPts((prev) => (prev.length >= 2 ? [p] : [...prev, p]))}
        />
      )}
      {layers.showFootprints &&
        damages.map((d) => {
          const fp = footById.get(d.id);
          return fp ? <FootprintPoints key={d.id} fp={fp} planes={planes} /> : null;
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
      {layers.showCameras && cameras.map((c, i) => <CameraGlyph key={i} position={c} />)}
      <MeasureLayer active={measuring} planes={planes} pts={mPts} setPts={setMPts} onMeasured={onMeasure} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxDistance={160} />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport labelColor="white" axisColors={["#e64545", "#4caf50", "#4285f4"]} />
      </GizmoHelper>
      <ViewportRig cloud={cloud} />
    </Canvas>
  );
}
