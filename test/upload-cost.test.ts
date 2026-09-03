// test/upload-cost.test.ts
import { describe, it, expect } from "vitest";
import {
  instancedUploadBytes,
  batchedUploadBytes,
  uploadRatio,
  instancedDrawCalls,
  batchedDrawCalls,
} from "../src/upload-cost";

describe("yükleme maliyeti muhasebesi", () => {
  it("50.000 parçacık için baytlar", () => {
    expect(instancedUploadBytes(50_000)).toBe(1_200_000); // 24 bayt/kayıt
    expect(batchedUploadBytes(50_000)).toBe(5_600_000); // 112 bayt/sprite
  });

  it("oran parçacık sayısından bağımsız olarak 28/6", () => {
    for (const n of [1, 100, 10_000, 200_000]) {
      expect(uploadRatio(n)).toBeCloseTo(28 / 6, 10);
    }
    expect(uploadRatio(0)).toBe(1); // boş sahnede oran tanımsız değil, 1
  });

  it("instancing tek draw call, batching kapasiteye bölünür", () => {
    expect(instancedDrawCalls(200_000)).toBe(1);
    expect(batchedDrawCalls(0)).toBe(0);
    expect(batchedDrawCalls(16_384)).toBe(1);
    expect(batchedDrawCalls(16_385)).toBe(2);
    expect(batchedDrawCalls(50_000)).toBe(4); // #7'deki ölçümle aynı
    expect(batchedDrawCalls(200_000)).toBe(13);
  });
});
