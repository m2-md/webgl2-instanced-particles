// Pure packing-math bench (Node, NO WebGL).
// 1) Measures instance/vertex packing throughput.
// 2) Computes the bytes uploaded to the GPU per frame and the draw calls.
// 3) Reports the per-second traffic assuming 60 FPS.
//
// GPU frame time is NOT MEASURED here: there is no WebGL in Node. For FPS and
// frame time open the browser demo with `npm run dev`; the HUD shows both live.

import { InstanceBuffer, FLOATS_PER_INSTANCE } from "./instance-buffer";
import {
  writeBatchedSprite,
  FLOATS_PER_BATCHED_SPRITE,
  MAX_BATCH_SPRITES,
} from "./batched-writer";
import {
  instancedUploadBytes,
  batchedUploadBytes,
  uploadRatio,
  instancedDrawCalls,
  batchedDrawCalls,
} from "./upload-cost";
import { makeParticles } from "./particles";

const MIB = 1024 * 1024;
const tr = (n: number) => n.toLocaleString("en-US");

// ------------------------------------------------------ 1) packing throughput
const N = 2_000_000;
const scene = makeParticles(100_000, 1600, 900);
const instances = new InstanceBuffer(MAX_BATCH_SPRITES);
const vertices = new Float32Array(
  MAX_BATCH_SPRITES * FLOATS_PER_BATCHED_SPRITE,
);

function packInstanced(count: number): number {
  let written = 0;
  for (let i = 0; i < count; i++) {
    if (i % MAX_BATCH_SPRITES === 0) instances.reset();
    const p = scene[i % scene.length];
    instances.push(p.x, p.y, p.size, p.r, p.g, p.b);
    written += FLOATS_PER_INSTANCE;
  }
  return written + instances.data[0]; // optimization barrier
}

function packBatched(count: number): number {
  let written = 0;
  for (let i = 0; i < count; i++) {
    const p = scene[i % scene.length];
    writeBatchedSprite(
      vertices,
      i % MAX_BATCH_SPRITES,
      p.x,
      p.y,
      p.size,
      p.r,
      p.g,
      p.b,
    );
    written += FLOATS_PER_BATCHED_SPRITE;
  }
  return written + vertices[0]; // optimization barrier
}

// Warm-up
let sink = packInstanced(200_000) + packBatched(200_000);

const REP = 5;
let instancedMs = 0;
let batchedMs = 0;
for (let r = 0; r < REP; r++) {
  let t0 = performance.now();
  sink += packInstanced(N);
  instancedMs += performance.now() - t0;

  t0 = performance.now();
  sink += packBatched(N);
  batchedMs += performance.now() - t0;
}
instancedMs /= REP;
batchedMs /= REP;

console.log("== packing throughput (no WebGL) ==");
console.log(
  `  instancing : ${tr(N)} records ${instancedMs.toFixed(1)} ms   ` +
    `${(N / instancedMs / 1000).toFixed(1)} M/s   ` +
    `(${((instancedMs / N) * 1e6).toFixed(1)} ns/particle)`,
);
console.log(
  `  batching   : ${tr(N)} sprites ${batchedMs.toFixed(1)} ms   ` +
    `${(N / batchedMs / 1000).toFixed(1)} M/s   ` +
    `(${((batchedMs / N) * 1e6).toFixed(1)} ns/sprite)`,
);
console.log(`  ratio      : ${(batchedMs / instancedMs).toFixed(2)}x`);

// ------------------------------------------- 2) data uploaded per frame
console.log("\n== data uploaded per frame ==");
console.log("  particles  batched      instanced    ratio   batch draw calls");
let accountingOk = true;
for (const n of [10_000, 50_000, 200_000]) {
  const b = batchedUploadBytes(n);
  const i = instancedUploadBytes(n);
  accountingOk &&= b === n * 112 && i === n * 24 && instancedDrawCalls(n) === 1;
  console.log(
    `  ${tr(n).padStart(8)}  ${(b / MIB).toFixed(2).padStart(8)} MB  ` +
      `${(i / MIB).toFixed(2).padStart(8)} MB   ` +
      `${uploadRatio(n).toFixed(2)}x  ${String(batchedDrawCalls(n)).padStart(10)}`,
  );
}

// -------------------------------------------- 3) per-second traffic at 60 FPS
const BIG = 200_000;
console.log(`\n== per-second traffic at 60 FPS (${tr(BIG)} particles) ==`);
console.log(
  `  batching   : ${((batchedUploadBytes(BIG) * 60) / MIB).toFixed(1).padStart(6)} MB/s`,
);
console.log(
  `  instancing : ${((instancedUploadBytes(BIG) * 60) / MIB).toFixed(1).padStart(6)} MB/s`,
);
console.log(
  "\n  (GPU frame time is measured in the browser: npm run dev → FPS / frame time in the HUD)",
);
console.log(`  checksum: ${sink.toFixed(0)} (optimization barrier)`);

if (!accountingOk) process.exit(1);
