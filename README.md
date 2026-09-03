# webgl2-instanced-particles

İki yüz bin parçacığı **tek** `drawArraysInstanced` çağrısına indiren WebGL2 instancing
örneği. Birim kare şablonu GPU'ya kurulumda bir kez yüklenir (`STATIC_DRAW`), her karede
yukarı çıkan tek şey parçacık başına 24 baytlık örnek kaydıdır (`x, y, size, r, g, b`).
Aynı sahne, aynı canvas ve aynı WebGL2 context'i üzerinde batching yoluyla da çizilebilir:
anahtarı çevirince draw call ve kare başına yüklenen bayt HUD'da anında değişir.

Teknik kalp: `gl.vertexAttribDivisor(loc, 1)` örnek attribute'larında, `0` şablon
attribute'unda.

Makale: `articles/webgl2-instanced-particles/article.md`
Önceki adım: `projects/webgl2-sprite-batching-atlas/` (sprite batching + atlas).

## Ne var burada

| Dosya                          | İçerik                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/instance-buffer.ts`       | `QUAD_VERTICES` (8 floatlık şablon), `FLOATS_PER_INSTANCE`, `BYTES_PER_INSTANCE`, `InstanceBuffer` (push/reset/usedBytes) — **saf**, WebGL tanımaz |
| `src/batched-writer.ts`        | `writeBatchedSprite` (28 float/sprite), `MAX_BATCH_SPRITES`, `makeQuadIndices` — karşılaştırmanın kontrol grubu                                    |
| `src/upload-cost.ts`           | `instancedUploadBytes` / `batchedUploadBytes` / `uploadRatio` / draw call muhasebesi — saf aritmetik                                               |
| `src/shaders.ts`               | `INSTANCED_VERTEX_SHADER`, `BATCHED_VERTEX_SHADER`, `PARTICLE_FRAGMENT_SHADER` (`#version 300 es` ilk satır; daire prosedürel, doku yok)           |
| `src/gl.ts`                    | `compileShader` / `createProgram` — `first-webgl2-sprite` projesinden aynen                                                                        |
| `src/instanced-renderer.ts`    | VAO + statik quad VBO + dinamik instance VBO, dört attribute, divisor kurulumu, `bufferSubData`, `drawArraysInstanced`                             |
| `src/batched-renderer.ts`      | VBO + IBO + `drawElements`, divisor yok — #7 yolunun renk taşıyan hali                                                                             |
| `src/render-path.ts`           | `createRenderPath` — instancing / batching tek arayüz arkasında, `RenderStats` (draw call + bayt)                                                  |
| `src/particles.ts`             | `makeRng` (mulberry32), `makeParticles`, `updateParticles` — deterministik sahne                                                                   |
| `src/sampler.ts`               | 500 ms pencereli FPS / kare süresi                                                                                                                 |
| `src/main.ts`                  | Demo: tek canvas, 10k/50k/200k düğmeleri, yol anahtarı, HUD                                                                                        |
| `src/bench-cli.ts`             | Node bench: paketleme throughput + kare başına bayt + 60 FPS trafiği                                                                               |
| `test/instance-buffer.test.ts` | 6 test: offset/stride, kapasite, reset, `RangeError`, şablon sözleşmesi                                                                            |
| `test/batched-writer.test.ts`  | 3 test: 28 float düzeni, dört kere tekrar eden renk, üzerine yazmama                                                                               |
| `test/upload-cost.test.ts`     | 3 test: 24 vs 112 bayt, 28/6 oranı, draw call bölünmesi                                                                                            |
| `test/particles.test.ts`       | 4 test: determinizm, sınırlar, sekme, RNG aralığı                                                                                                  |

## Kurulum

```bash
npm install
```

## Çalıştırma

```bash
npm run dev      # Vite dev server — demo (parçacık sayısı + instancing/batching anahtarı)
npm run build    # tsc --noEmit + vite build (dist/)
npm test         # vitest — 16 saf mantık testi (WebGL çağrısı YOK)
npm run bench    # Node bench: paketleme hızı + bayt muhasebesi
```

> `npm run dev` şart: demo Vite modül sunucusuyla açılır. `index.html`'i `file://` ile
> açarsanız modüller yüklenmez, ekran boş kalır.

## Beklenen çıktı

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

Bayt sütunları aritmetik olduğu için her makinede aynı; süre satırları makineye bağlı.
Aşağıdaki çıktı Apple M2 Pro / Node 22 üzerinde alındı:

```
== paketleme throughput (WebGL yok) ==
  instancing : 2.000.000 kayıt  41.4 ms   48.3 M/s   (20.7 ns/parçacık)
  batching   : 2.000.000 sprite 70.4 ms   28.4 M/s   (35.2 ns/sprite)
  oran       : 1.70x

== kare başına yüklenen veri ==
  parçacık   batching     instancing   oran    batch draw call
    10.000      1.07 MB      0.23 MB   4.67x           1
    50.000      5.34 MB      1.14 MB   4.67x           4
   200.000     21.36 MB      4.58 MB   4.67x          13

== 60 FPS'te saniyelik trafik (200.000 parçacık) ==
  batching   : 1281.7 MB/s
  instancing :  274.7 MB/s
```

**GPU kare süresi bu bench'te ölçülmez** — Node'da WebGL yok. FPS ve kare süresi yalnızca
tarayıcı demosunda anlamlıdır; `npm run dev` ile açıp HUD'dan okuyun.

### `npm run dev`

Ekranın sol üstünde parçacık sayısı düğmeleri (10.000 / 50.000 / 200.000) ve yol anahtarı
(instancing / batching). HUD: yol, parçacık, FPS, kare süresi, draw call, kare başına
yüklenen bayt. Instancing'de draw call her zaman **1**; batching'de 200.000 parçacıkta
**13** (16.384'lük Uint16 indeks sınırı). Kare başına yüklenen bayt sütununda oran sabit:
batching instancing'in 4,67 katı.

## Lisans

MIT
