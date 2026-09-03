# webgl2-instanced-particles

A WebGL2 instancing example that collapses two hundred thousand particles into a
**single** `drawArraysInstanced` call. The unit-quad template is uploaded to the GPU
once at setup (`STATIC_DRAW`); the only thing that goes up every frame is a 24-byte
instance record per particle (`x, y, size, r, g, b`). The same scene can also be drawn
through the batching path, on the same canvas and the same WebGL2 context: flip the
switch and the draw call count and the bytes uploaded per frame change instantly in the HUD.

The technical heart: `gl.vertexAttribDivisor(loc, 1)` on the instance attributes, `0` on
the template attribute.

Article: `articles/webgl2-instanced-particles/article.md`
Previous step: `projects/webgl2-sprite-batching-atlas/` (sprite batching + atlas).

## What's here

| File                           | Contents                                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/instance-buffer.ts`       | `QUAD_VERTICES` (an 8-float template), `FLOATS_PER_INSTANCE`, `BYTES_PER_INSTANCE`, `InstanceBuffer` (push/reset/usedBytes) — **pure**, knows no WebGL |
| `src/batched-writer.ts`        | `writeBatchedSprite` (28 floats/sprite), `MAX_BATCH_SPRITES`, `makeQuadIndices` — the control group of the comparison                               |
| `src/upload-cost.ts`           | `instancedUploadBytes` / `batchedUploadBytes` / `uploadRatio` / draw call accounting — pure arithmetic                                              |
| `src/shaders.ts`               | `INSTANCED_VERTEX_SHADER`, `BATCHED_VERTEX_SHADER`, `PARTICLE_FRAGMENT_SHADER` (`#version 300 es` on the first line; the disc is procedural, no texture) |
| `src/gl.ts`                    | `compileShader` / `createProgram` — verbatim from the `first-webgl2-sprite` project                                                                 |
| `src/instanced-renderer.ts`    | VAO + static quad VBO + dynamic instance VBO, four attributes, divisor setup, `bufferSubData`, `drawArraysInstanced`                                |
| `src/batched-renderer.ts`      | VBO + IBO + `drawElements`, no divisor — the #7 path with color added                                                                               |
| `src/render-path.ts`           | `createRenderPath` — instancing / batching behind a single interface, `RenderStats` (draw calls + bytes)                                            |
| `src/particles.ts`             | `makeRng` (mulberry32), `makeParticles`, `updateParticles` — deterministic scene                                                                    |
| `src/sampler.ts`               | FPS / frame time over a 500 ms window                                                                                                               |
| `src/main.ts`                  | Demo: one canvas, 10k/50k/200k buttons, the path switch, the HUD                                                                                     |
| `src/bench-cli.ts`             | Node bench: packing throughput + bytes per frame + traffic at 60 FPS                                                                                 |
| `test/instance-buffer.test.ts` | 6 tests: offset/stride, capacity, reset, `RangeError`, the template contract                                                                         |
| `test/batched-writer.test.ts`  | 3 tests: the 28-float layout, the color repeated four times, no overwriting                                                                          |
| `test/upload-cost.test.ts`     | 3 tests: 24 vs 112 bytes, the 28/6 ratio, draw call splitting                                                                                        |
| `test/particles.test.ts`       | 4 tests: determinism, bounds, bouncing, RNG range                                                                                                    |

## Setup

```bash
npm install
```

## Running

```bash
npm run dev      # Vite dev server — demo (particle count + instancing/batching switch)
npm run build    # tsc --noEmit + vite build (dist/)
npm test         # vitest — 16 pure logic tests (NO WebGL calls)
npm run bench    # Node bench: packing speed + byte accounting
```

> `npm run dev` is required: the demo is served by the Vite module server. If you open
> `index.html` over `file://` the modules won't load and the screen stays blank.

## Expected output

### `npm test`

```
 ✓ test/instance-buffer.test.ts (6 tests) 3ms
 ✓ test/batched-writer.test.ts (3 tests) 3ms
 ✓ test/upload-cost.test.ts (3 tests) 2ms
 ✓ test/particles.test.ts (4 tests) 44ms

 Test Files  4 passed (4)
      Tests  16 passed (16)
```

### `npm run bench`

The byte columns are arithmetic, so they are identical on every machine; the timing
lines depend on the machine. The output below was taken on an Apple M2 Pro / Node 22:

```
== packing throughput (no WebGL) ==
  instancing : 2,000,000 records 41.4 ms   48.3 M/s   (20.7 ns/particle)
  batching   : 2,000,000 sprites 70.4 ms   28.4 M/s   (35.2 ns/sprite)
  ratio      : 1.70x

== data uploaded per frame ==
  particles  batched      instanced    ratio   batch draw calls
    10,000      1.07 MB      0.23 MB   4.67x           1
    50,000      5.34 MB      1.14 MB   4.67x           4
   200,000     21.36 MB      4.58 MB   4.67x          13

== per-second traffic at 60 FPS (200,000 particles) ==
  batching   : 1281.7 MB/s
  instancing :  274.7 MB/s
```

**GPU frame time is not measured in this bench** — there is no WebGL in Node. FPS and
frame time only mean something in the browser demo; open it with `npm run dev` and read
them off the HUD.

### `npm run dev`

Top left of the screen: the particle count buttons (10,000 / 50,000 / 200,000) and the
path switch (instancing / batching). HUD: path, particles, FPS, frame time, draw call,
bytes uploaded per frame. With instancing the draw call count is always **1**; with
batching it is **13** at 200,000 particles (the 16,384 Uint16 index limit). In the
bytes-per-frame column the ratio is constant: batching uploads 4.67x what instancing does.

## License

MIT
