import * as THREE from "three";

// Bakes a letter as carved relief directly into a gem's own material —
// a color map (crystal hue + a darker shade for the glyph) plus a
// matching bump map so the same single mesh reads as one carved shape
// under real lighting, rather than a flat sticker glued on top.
const colorCache = new Map<string, THREE.CanvasTexture>();
const bumpCache = new Map<string, THREE.CanvasTexture>();

function drawLetter(ctx: CanvasRenderingContext2D, letter: string, size: number) {
  ctx.font = `800 ${size * 0.6}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, size / 2, size / 2 + size * 0.03);
}

export function engravedColorTexture(grapheme: string, hue: number): THREE.CanvasTexture {
  const letter = grapheme.toUpperCase();
  const key = `${letter}-${hue.toFixed(3)}`;
  const cached = colorCache.get(key);
  if (cached) return cached;

  const base = new THREE.Color().setHSL(hue, 0.72, 0.62);

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  // A near-black ink, not a same-hue shade — a subtle tint reads fine
  // up close but washes out at gameplay camera distance under the
  // scene's varied lighting. This stays legible regardless of hue.
  ctx.fillStyle = "#140f24";
  drawLetter(ctx, letter, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  colorCache.set(key, tex);
  return tex;
}

export function engravedBumpTexture(grapheme: string): THREE.CanvasTexture {
  const letter = grapheme.toUpperCase();
  const cached = bumpCache.get(letter);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  drawLetter(ctx, letter, size);

  const tex = new THREE.CanvasTexture(canvas);
  bumpCache.set(letter, tex);
  return tex;
}

// Masks the "tap me" emissive glow to the background only. emissive is
// added on top of the surface regardless of albedo, so without this a
// bright glow washes the dark letter ink out to near-invisible right
// when the hint is most active.
const maskCache = new Map<string, THREE.CanvasTexture>();

export function engravedGlowMask(grapheme: string): THREE.CanvasTexture {
  const letter = grapheme.toUpperCase();
  const cached = maskCache.get(letter);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";
  drawLetter(ctx, letter, size);

  const tex = new THREE.CanvasTexture(canvas);
  maskCache.set(letter, tex);
  return tex;
}
