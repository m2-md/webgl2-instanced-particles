// batched-writer.ts — the packing from #7, now carrying color
export const FLOATS_PER_BATCHED_VERTEX = 7; // x, y, u, v, r, g, b
export const VERTICES_PER_QUAD = 4;
export const FLOATS_PER_BATCHED_SPRITE =
  FLOATS_PER_BATCHED_VERTEX * VERTICES_PER_QUAD; // 28

// Uint16 index limit: 65,536 / 4 vertices = 16,384 sprites
export const MAX_BATCH_SPRITES = 16384;

export function writeBatchedSprite(
  out: Float32Array,
  index: number,
  x: number,
  y: number,
  size: number,
  r: number,
  g: number,
  b: number,
): void {
  const o = index * FLOATS_PER_BATCHED_SPRITE;
  const x1 = x + size;
  const y1 = y + size;

  // top-left
  out[o + 0] = x;
  out[o + 1] = y;
  out[o + 2] = 0;
  out[o + 3] = 0;
  out[o + 4] = r;
  out[o + 5] = g;
  out[o + 6] = b;

  // bottom-left
  out[o + 7] = x;
  out[o + 8] = y1;
  out[o + 9] = 0;
  out[o + 10] = 1;
  out[o + 11] = r;
  out[o + 12] = g;
  out[o + 13] = b;

  // top-right
  out[o + 14] = x1;
  out[o + 15] = y;
  out[o + 16] = 1;
  out[o + 17] = 0;
  out[o + 18] = r;
  out[o + 19] = g;
  out[o + 20] = b;

  // bottom-right
  out[o + 21] = x1;
  out[o + 22] = y1;
  out[o + 23] = 1;
  out[o + 24] = 1;
  out[o + 25] = r;
  out[o + 26] = g;
  out[o + 27] = b;
}

// Two triangles per sprite: (0,1,2) and (2,1,3). The indices never change,
// they are uploaded once at setup with STATIC_DRAW.
export function makeQuadIndices(spriteCount: number): Uint16Array {
  const indices = new Uint16Array(spriteCount * 6);
  for (let i = 0; i < spriteCount; i++) {
    const v = i * VERTICES_PER_QUAD;
    const o = i * 6;
    indices[o + 0] = v + 0;
    indices[o + 1] = v + 1;
    indices[o + 2] = v + 2;
    indices[o + 3] = v + 2;
    indices[o + 4] = v + 1;
    indices[o + 5] = v + 3;
  }
  return indices;
}
