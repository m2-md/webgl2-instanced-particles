// Saf paketleme matematiği bench'i (Node, WebGL YOK).
// 1) Örnek/köşe paketleme throughput'unu ölçer.
// 2) Kare başına GPU'ya yüklenen baytları ve draw call'ları hesaplar.
// 3) 60 FPS varsayımıyla saniyelik trafiği raporlar.
//
// GPU kare süresi burada ÖLÇÜLMEZ: Node'da WebGL yok. FPS ve kare süresi için
// `npm run dev` ile tarayıcı demosunu açın; HUD'da ikisi de canlı yazıyor.

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
const tr = (n: number) => n.toLocaleString("tr-TR");

// ------------------------------------------------------ 1) paketleme throughput
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
  return written + instances.data[0]; // optimizasyon engeli
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
  return written + vertices[0]; // optimizasyon engeli
}

// Isınma
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

console.log("== paketleme throughput (WebGL yok) ==");
console.log(
  `  instancing : ${tr(N)} kayıt  ${instancedMs.toFixed(1)} ms   ` +
    `${(N / instancedMs / 1000).toFixed(1)} M/s   ` +
    `(${((instancedMs / N) * 1e6).toFixed(1)} ns/parçacık)`,
);
console.log(
  `  batching   : ${tr(N)} sprite ${batchedMs.toFixed(1)} ms   ` +
    `${(N / batchedMs / 1000).toFixed(1)} M/s   ` +
    `(${((batchedMs / N) * 1e6).toFixed(1)} ns/sprite)`,
);
console.log(`  oran       : ${(batchedMs / instancedMs).toFixed(2)}x`);

// ------------------------------------------- 2) kare başına yüklenen veri
console.log("\n== kare başına yüklenen veri ==");
console.log("  parçacık   batching     instancing   oran    batch draw call");
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

// -------------------------------------------- 3) 60 FPS'te saniyelik trafik
const BIG = 200_000;
console.log(`\n== 60 FPS'te saniyelik trafik (${tr(BIG)} parçacık) ==`);
console.log(
  `  batching   : ${((batchedUploadBytes(BIG) * 60) / MIB).toFixed(1).padStart(6)} MB/s`,
);
console.log(
  `  instancing : ${((instancedUploadBytes(BIG) * 60) / MIB).toFixed(1).padStart(6)} MB/s`,
);
console.log(
  "\n  (GPU kare süresi ölçümü tarayıcıda: npm run dev → HUD'daki FPS / kare süresi)",
);
console.log(`  checksum: ${sink.toFixed(0)} (optimizasyon engeli)`);

if (!accountingOk) process.exit(1);
