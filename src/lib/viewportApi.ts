import * as THREE from "three";

interface ControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

/**
 * Bridge between UI chrome (command line, view presets, snapshot)
 * and the react-three-fiber viewport. Registered by Viewer3D.
 */
export const viewportApi: {
  camera: THREE.Camera | null;
  controls: ControlsLike | null;
  gl: THREE.WebGLRenderer | null;
  bounds: THREE.Box3 | null;
  clearMeasure: (() => void) | null;
  setView: (pos: [number, number, number], target?: [number, number, number]) => void;
  zoomExtents: () => void;
  snapshot: () => string | null;
} = {
  camera: null,
  controls: null,
  gl: null,
  bounds: null,
  clearMeasure: null,

  setView(pos, target = [0, 2, 0]) {
    if (!viewportApi.camera) return;
    viewportApi.camera.position.set(...pos);
    if (viewportApi.controls) {
      viewportApi.controls.target.set(...target);
      viewportApi.controls.update();
    }
  },

  zoomExtents() {
    if (!viewportApi.camera || !viewportApi.bounds) return;
    const box = viewportApi.bounds;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dir = new THREE.Vector3(1, 0.55, 1).normalize();
    viewportApi.camera.position.copy(center).addScaledVector(dir, size * 1.1);
    if (viewportApi.controls) {
      viewportApi.controls.target.copy(center);
      viewportApi.controls.update();
    }
  },

  snapshot() {
    if (!viewportApi.gl) return null;
    try {
      return viewportApi.gl.domElement.toDataURL("image/png");
    } catch {
      return null;
    }
  },
};

export const NAMED_VIEWS: Record<string, [number, number, number]> = {
  ISO: [20, 11, 20],
  TOP: [0, 42, 0.01],
  FRONT: [0, 3, 34],
  RIGHT: [34, 3, 0],
  LEFT: [-34, 3, 0],
};
