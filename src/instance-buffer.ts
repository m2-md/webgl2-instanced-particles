// instance-buffer.ts
// Şablon: birim kare. Köşe koordinatı hem konum çarpanı hem
// de parçacık içi konum (0..1) olarak kullanılır.
// TRIANGLE_STRIP sırası: sol üst, sol alt, sağ üst, sağ alt.
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
      throw new RangeError("capacity pozitif bir tam sayı olmalı");
    }
    this.capacity = capacity;
    // Tek seferlik ayırma: kare döngüsünde bir daha allocation yok
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

  // Kapasite dolmuşsa false döner; batching'deki gibi flush yok,
  // çünkü tek draw call'ın kapasitesi zaten örnek sayısı kadar.
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
