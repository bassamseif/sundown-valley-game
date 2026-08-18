import * as THREE from "three";

// Renders a single grapheme onto a small offscreen canvas using a
// system font, entirely locally — no network fetch. drei's <Text>
// helper would otherwise pull its default typeface from a CDN, the
// same failure mode as the HDR skybox fetch that once hung the scene.
// Always uppercase and set on a light disc — small against a crystal
// facet, low contrast, and easy to lose at this age.
const cache = new Map<string, THREE.CanvasTexture>();

export function glyphTexture(grapheme: string): THREE.CanvasTexture {
  const letter = grapheme.toUpperCase();
  const cached = cache.get(letter);
  if (cached) return cached;

  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = "#fff3e0";
  ctx.fill();

  ctx.fillStyle = "#1a1f2e";
  ctx.font = `800 ${size * 0.62}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, size / 2, size / 2 + size * 0.03);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(letter, texture);
  return texture;
}
