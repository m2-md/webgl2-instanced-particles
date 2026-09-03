// test/upload-cost.test.ts
import { describe, it, expect } from "vitest";
import {
  instancedUploadBytes,
  batchedUploadBytes,
  uploadRatio,
  instancedDrawCalls,
  batchedDrawCalls,
} from "../src/upload-cost";

describe("upload cost accounting", () => {
  it("computes the bytes for 50,000 particles", () => {
    expect(instancedUploadBytes(50_000)).toBe(1_200_000); // 24 bytes/record
    expect(batchedUploadBytes(50_000)).toBe(5_600_000); // 112 bytes/sprite
  });

  it("keeps the ratio at 28/6 regardless of particle count", () => {
    for (const n of [1, 100, 10_000, 200_000]) {
      expect(uploadRatio(n)).toBeCloseTo(28 / 6, 10);
    }
    expect(uploadRatio(0)).toBe(1); // on an empty scene the ratio is not undefined, it is 1
  });

  it("uses one draw call for instancing and splits batching by capacity", () => {
    expect(instancedDrawCalls(200_000)).toBe(1);
    expect(batchedDrawCalls(0)).toBe(0);
    expect(batchedDrawCalls(16_384)).toBe(1);
    expect(batchedDrawCalls(16_385)).toBe(2);
    expect(batchedDrawCalls(50_000)).toBe(4); // same as the measurement in #7
    expect(batchedDrawCalls(200_000)).toBe(13);
  });
});
