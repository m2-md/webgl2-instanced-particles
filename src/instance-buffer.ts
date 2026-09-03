// instance-buffer.ts
// Template: the unit quad. The corner coordinate is used both as a position
// multiplier and as the in-particle coordinate (0..1).
// TRIANGLE_STRIP order: top-left, bottom-left, top-right, bottom-right.
export const QUAD_VERTICES = new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]);

export const FLOATS_PER_INSTANCE = 6; // x, y, size, r, g, b
export const BYTES_PER_FLOAT = Float32Array.BYTES_PER_ELEMENT; // 4
export const BYTES_PER_INSTANCE = FLOATS_PER_INSTANCE * BYTES_PER_FLOAT; // 24

export class InstanceBuffer {
  readonly capacity: number;
  readonly data: Float32Array;
  private count = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError("capacity must be a positive integer");
    }
    this.capacity = capacity;
    // One-time allocation: no further allocation inside the frame loop
    this.data = new Float32Array(capacity * FLOATS_PER_INSTANCE);
  }

  get length(): number {
    return this.count;
  }

  get usedFloats(): number {
    return this.count * FLOATS_PER_INSTANCE;
  }

  get usedBytes(): number {
    return this.count * BYTES_PER_INSTANCE;
  }

  reset(): void {
    this.count = 0;
  }

  // Returns false when capacity is full; there is no flush like in batching,
  // because a single draw call already holds as many instances as we have.
  push(
    x: number,
    y: number,
    size: number,
    r: number,
    g: number,
    b: number,
  ): boolean {
    if (this.count >= this.capacity) return false;

    const o = this.count * FLOATS_PER_INSTANCE;
    const d = this.data;
    d[o + 0] = x;
    d[o + 1] = y;
    d[o + 2] = size;
    d[o + 3] = r;
    d[o + 4] = g;
    d[o + 5] = b;

    this.count++;
    return true;
  }
}
