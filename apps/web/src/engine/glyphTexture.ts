import * as THREE from "three";

// Renders a single grapheme onto a small offscreen canvas using a
// system font, entirely locally — no network fetch. drei's <Text>
// helper would otherwise pull its default typeface from a CDN, the
// same failure mode as the HDR skybox fetch that once hung the scene.
const cache = new Map<string, THREE.CanvasTexture>();

export function glyphTexture(grapheme: string): THREE.CanvasTexture {
  const cached = cache.get(grapheme);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#1a1f2e";
  ctx.font = `700 ${size * 0.62}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(grapheme, size / 2, size / 2 + size * 0.04);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(grapheme, texture);
  return texture;
}
