import type { CloudData } from "../types";

const TYPE_SIZE: Record<string, number> = {
  char: 1, uchar: 1, int8: 1, uint8: 1,
  short: 2, ushort: 2, int16: 2, uint16: 2,
  int: 4, uint: 4, int32: 4, uint32: 4,
  float: 4, float32: 4,
  double: 8, float64: 8,
};

interface Prop {
  name: string;
  size: number;
  isFloat: boolean;
}

export interface ParsedCloud extends CloudData {
  /** per-point group id when the PLY carries damage_idx/label (else undefined) */
  pointIndex?: Uint16Array;
}

function getValue(view: DataView, off: number, type: string): number {
  switch (type) {
    case "char":
    case "int8":
      return view.getInt8(off);
    case "uchar":
    case "uint8":
      return view.getUint8(off);
    case "short":
    case "int16":
      return view.getInt16(off, true);
    case "ushort":
    case "uint16":
      return view.getUint16(off, true);
    case "int":
    case "int32":
      return view.getInt32(off, true);
    case "uint":
    case "uint32":
      return view.getUint32(off, true);
    case "float":
    case "float32":
      return view.getFloat32(off, true);
    case "double":
    case "float64":
      return view.getFloat64(off, true);
    default:
      return 0;
  }
}

/**
 * Minimal PLY reader (ascii + binary_little_endian) for colored point clouds
 * with x,y,z + red,green,blue (+ ignores extra props like damage_idx).
 * Subsamples to maxPoints for browser performance.
 */
export function parsePLY(buffer: ArrayBuffer, maxPoints = 250000): ParsedCloud {
  const bytes = new Uint8Array(buffer);
  const dec = new TextDecoder();
  // header is ascii — find end_header
  let headerEnd = -1;
  const scan = Math.min(bytes.length, 1 << 20);
  for (let i = 0; i < scan - 11; i++) {
    if (
      bytes[i] === 101 && // e
      dec.decode(bytes.subarray(i, i + 11)) === "end_header\n"
    ) {
      headerEnd = i + 11;
      break;
    }
  }
  if (headerEnd < 0) throw new Error("Invalid PLY: end_header not found");
  const header = dec.decode(bytes.subarray(0, headerEnd));
  const lines = header.split("\n");
  const format = lines.find((l) => l.startsWith("format")) ?? "";
  const binary = format.includes("binary_little_endian");
  const countLine = lines.find((l) => l.startsWith("element vertex")) ?? "";
  const vertexCount = parseInt(countLine.split(/\s+/)[2] ?? "0", 10);
  if (!vertexCount) throw new Error("Invalid PLY: vertex count is 0");

  const props: Prop[] = [];
  for (const l of lines) {
    const m = l.match(/^property\s+(\S+)\s+(\S+)/);
    if (!m || m[1] === "list") continue;
    const size = TYPE_SIZE[m[1]] ?? 0;
    if (!size) continue;
    props.push({ name: m[2].toLowerCase(), size, isFloat: ["float", "float32", "double", "float64"].includes(m[1]) });
  }
  const stride = props.reduce((a, p) => a + p.size, 0);
  const ix = props.findIndex((p) => p.name === "x");
  const iy = props.findIndex((p) => p.name === "y");
  const iz = props.findIndex((p) => p.name === "z");
  const ir = props.findIndex((p) => ["red", "r"].includes(p.name));
  const ig = props.findIndex((p) => ["green", "g"].includes(p.name));
  const ib = props.findIndex((p) => ["blue", "b"].includes(p.name));
  if (ix < 0 || iy < 0 || iz < 0) throw new Error("Invalid PLY: x/y/z missing");

  const offOf = (k: number) => props.slice(0, k).reduce((a, p) => a + p.size, 0);
  const ox = offOf(ix);
  const oy = offOf(iy);
  const oz = offOf(iz);
  const orr = ir >= 0 ? offOf(ir) : -1;
  const og = ig >= 0 ? offOf(ig) : -1;
  const ob = ib >= 0 ? offOf(ib) : -1;
  const iIdx = props.findIndex((p) => ["damage_idx", "damage_id", "label"].includes(p.name));
  const oIdx = iIdx >= 0 ? offOf(iIdx) : -1;
  const ptype = (k: number) => props[k] ? linesPropType(lines, props[k].name) : "float";

  const step = Math.max(1, Math.floor(vertexCount / maxPoints));
  const outCount = Math.ceil(vertexCount / step);
  const positions = new Float32Array(outCount * 3);
  const colors = new Float32Array(outCount * 3);
  const index = oIdx >= 0 ? new Uint16Array(outCount) : undefined;
  const view = new DataView(buffer);
  let w = 0;

  if (binary) {
    for (let i = 0; i < vertexCount; i += step) {
      const base = headerEnd + i * stride;
      positions[w * 3] = getValue(view, base + ox, ptype(ix));
      positions[w * 3 + 1] = getValue(view, base + oy, ptype(iy));
      positions[w * 3 + 2] = getValue(view, base + oz, ptype(iz));
      let r = 180;
      let g = 180;
      let b = 180;
      if (orr >= 0 && og >= 0 && ob >= 0) {
        r = getValue(view, base + orr, ptype(ir));
        g = getValue(view, base + og, ptype(ig));
        b = getValue(view, base + ob, ptype(ib));
        if (r <= 1.01 && g <= 1.01 && b <= 1.01 && (props[ir]?.isFloat || props[ig]?.isFloat)) {
          r *= 255;
          g *= 255;
          b *= 255;
        }
      }
      colors[w * 3] = r;
      colors[w * 3 + 1] = g;
      colors[w * 3 + 2] = b;
      if (index && oIdx >= 0) index[w] = getValue(view, base + oIdx, ptype(iIdx));
      w++;
    }
  } else {
    const text = dec.decode(bytes.subarray(headerEnd));
    const rows = text.split("\n");
    let wAscii = 0;
    for (let i = 0; i < vertexCount && i < rows.length; i += step) {
      const vals = rows[i].trim().split(/\s+/).map(Number);
      if (vals.length < props.length) continue;
      // ascii order follows props order
      const at = (k: number) => vals[propsOrderIndex(props, k)];
      positions[wAscii * 3] = at(ix);
      positions[wAscii * 3 + 1] = at(iy);
      positions[wAscii * 3 + 2] = at(iz);
      colors[wAscii * 3] = ir >= 0 ? at(ir) : 180;
      colors[wAscii * 3 + 1] = ig >= 0 ? at(ig) : 180;
      colors[wAscii * 3 + 2] = ib >= 0 ? at(ib) : 180;
      if (index && iIdx >= 0) index[wAscii] = at(iIdx);
      wAscii++;
    }
    w = wAscii;
  }
  return {
    positions: positions.slice(0, w * 3),
    colors: colors.slice(0, w * 3),
    count: w,
    pointIndex: index?.slice(0, w),
  };
}

function propsOrderIndex(_props: Prop[], k: number): number {
  return k;
}

function linesPropType(lines: string[], name: string): string {
  for (const l of lines) {
    const m = l.match(/^property\s+(\S+)\s+(\S+)/);
    if (m && m[2].toLowerCase() === name) return m[1];
  }
  return "float";
}
