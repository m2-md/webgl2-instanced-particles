// test/batched-writer.test.ts
import { describe, it, expect } from "vitest";
import {
  writeBatchedSprite,
  FLOATS_PER_BATCHED_SPRITE,
  FLOATS_PER_BATCHED_VERTEX,
} from "../src/batched-writer";

describe("writeBatchedSprite", () => {
  it("sprite başına 28 float yazar, dört köşe doğru sırada", () => {
    const out = new Float32Array(FLOATS_PER_BATCHED_SPRITE * 2);
    writeBatchedSprite(out, 0, 10, 20, 30, 1, 0, 0);

    // sol üst / sol alt / sağ üst / sağ alt konumları
    expect([out[0], out[1]]).toEqual([10, 20]);
    expect([out[7], out[8]]).toEqual([10, 50]);
    expect([out[14], out[15]]).toEqual([40, 20]);
    expect([out[21], out[22]]).toEqual([40, 50]);
  });

  it("aynı renk dört kere tekrar yazılır", () => {
    const out = new Float32Array(FLOATS_PER_BATCHED_SPRITE);
    writeBatchedSprite(out, 0, 0, 0, 10, 0.25, 0.5, 0.75);

    for (let v = 0; v < 4; v++) {
      const o = v * FLOATS_PER_BATCHED_VERTEX;
      expect([out[o + 4], out[o + 5], out[o + 6]]).toEqual([0.25, 0.5, 0.75]);
    }
  });

  it("ikinci sprite birincinin üzerine yazmaz", () => {
    const out = new Float32Array(FLOATS_PER_BATCHED_SPRITE * 2);
    writeBatchedSprite(out, 0, 1, 1, 2, 0, 0, 0);
    writeBatchedSprite(out, 1, 100, 200, 2, 0, 0, 0);

    expect(out[0]).toBe(1);
    expect(out[FLOATS_PER_BATCHED_SPRITE + 0]).toBe(100);
    expect(out[FLOATS_PER_BATCHED_SPRITE + 1]).toBe(200);
  });
});
