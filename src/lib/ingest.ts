/** Real client-side file introspection (dims, duration, thumbnails, hash). */

export interface IngestedImage {
  name: string;
  size: number;
  width: number;
  height: number;
  url: string;
  file: File;
}

export async function ingestImages(files: File[]): Promise<IngestedImage[]> {
  const out: IngestedImage[] = [];
  for (const file of files) {
    const url = URL.createObjectURL(file);
    try {
      const bmp = await createImageBitmap(file);
      out.push({ name: file.name, size: file.size, width: bmp.width, height: bmp.height, url, file });
      bmp.close();
    } catch {
      URL.revokeObjectURL(url);
    }
  }
  return out;
}

export interface VideoInfo {
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  thumbs: string[];
}

/** Extract real thumbnails from a video file via seek + canvas capture. */
export function extractVideoFrames(file: File, count = 8): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    const thumbs: string[] = [];
    video.onloadedmetadata = async () => {
      const duration = video.duration || 0;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 360;
      const scale = Math.min(1, 480 / w);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas unavailable"));
        return;
      }
      try {
        for (let i = 0; i < count; i++) {
          const t = duration > 0 ? (duration * (i + 0.5)) / count : 0;
          await new Promise<void>((res, rej) => {
            const to = window.setTimeout(() => rej(new Error("seek timeout")), 8000);
            video.onseeked = () => {
              window.clearTimeout(to);
              res();
            };
            video.currentTime = Math.min(t, Math.max(0, duration - 0.05));
          });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbs.push(canvas.toDataURL("image/jpeg", 0.72));
        }
        URL.revokeObjectURL(url);
        resolve({ name: file.name, size: file.size, duration, width: w, height: h, thumbs });
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Cannot decode video"));
    };
  });
}

/** FNV-1a hash — deterministic seed so the same upload yields the same result. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function fmtBytes(n: number): string {
  if (n > 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}
