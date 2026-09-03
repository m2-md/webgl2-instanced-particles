// upload-cost.ts — saf muhasebe, WebGL yok
import { FLOATS_PER_INSTANCE, BYTES_PER_FLOAT } from "./instance-buffer";
import { FLOATS_PER_BATCHED_SPRITE, MAX_BATCH_SPRITES } from "./batched-writer";

export function instancedUploadBytes(count: number): number {
  return count * FLOATS_PER_INSTANCE * BYTES_PER_FLOAT; // 24 bayt/parçacık
}

export function batchedUploadBytes(count: number): number {
  return count * FLOATS_PER_BATCHED_SPRITE * BYTES_PER_FLOAT; // 112 bayt/sprite
}

/** Batching'in instancing'e göre kaç katı veri yüklediği. */
export function uploadRatio(count: number): number {
  if (count === 0) return 1;
  return batchedUploadBytes(count) / instancedUploadBytes(count);
}

export function instancedDrawCalls(count: number): number {
  return count > 0 ? 1 : 0;
}

export function batchedDrawCalls(count: number): number {
  return Math.ceil(count / MAX_BATCH_SPRITES);
}
