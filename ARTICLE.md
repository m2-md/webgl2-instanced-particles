# Mührü Bir Kez Oy, Elli Bin Kez Bas: WebGL2'de Instanced Rendering

*Batching aynı kare şeklini her sprite için yeniden tarif ediyordu. Instancing kareyi GPU'ya bir kez verip her parçacık için sadece "nerede, ne kadar büyük, ne renk" diyor. Aynı sahne, kare başına dörtte birin altında veri. Gerçek TypeScript + WebGL2, `vertexAttribDivisor`'ın çalışma mantığı ve iki yolun aynı canvas üzerinde dürüst ölçümü.*

*Tahmini okuma süresi: 16 dakika*

---

Geçen sefer elli bin sprite'ı dört draw call'a indirmiştik. Konteyner mantığı çalıştı: bütün köşeleri tek bir `Float32Array`'e doldurup GPU'ya toptan yolladık, naif yoldaki elli bin çağrı dörde düştü.

Sonra o dört çağrının içine baktım.

Kare başına GPU'ya kopyalanan veriyi hesaplayınca ortaya çıkan sayı beni rahatsız etti. Elli bin sprite için üç megabaytın üzerinde. Saniyede altmış kare çarpınca, sırf konum ve renk bilgisi için ikinci başına yüz seksen megabayt. Oysa o verinin büyük kısmı aynı şeyin tekrarıydı: her sprite'ın dört köşesi, her köşede yeniden yazılan aynı renk, yeniden hesaplanan aynı kare şekli.

Bir mühür düşünün. Kauçuktan oyulmuş, üzerinde bir daire var. Kâğıda basmak için mührü her seferinde yeniden oymuyorsunuz; bir kez oyuyor, sonra "şuraya bas, bu mürekkeple bas" diyorsunuz. Batching'in yaptığı şey ise tam tersi: her basış için mührün deseninin dört köşesini baştan tarif etmek. Desen hiç değişmediği halde.

Instancing (örnekleme), o mührü GPU'ya bir kez teslim etme tekniğidir.

Bu yazı bir serinin ortasında duruyor. Naif yolda her sprite kendi çağrısını istiyor, batching'de bütün köşeler tek buffer'a paketleniyordu. Bugünkü basamak geometriyi GPU'da bırakıp yalnızca örnek farklarını yukarı yolluyor. Serinin son durağı olan [compute shader](https://medium.com/) yazısında ise veri aşağı hiç inmiyor, GPU kendi kendini güncelliyordu. Buradaysa veri hâlâ CPU'da güncelleniyor, sadece yukarı çok daha az akıyor.

Yol haritası şu: önce batching'in kare başına ne kadar tekrar yazdığını hesaplayacağız. Sonra `vertexAttribDivisor` ile bir attribute'u köşeye değil örneğe bağlamayı, örnek kaydını paketlemeyi, `drawArraysInstanced` ile hepsini tek çağrıda çizmeyi göreceğiz. Sonunda aynı sahneyi iki yolla da çizen bir demo kurup baytları sayacağız.

Önceki iki yazının bilgisini varsayıyorum: WebGL2 context'i, `compileShader` / `createProgram` yardımcıları, clip-space dönüşümü ve `bufferSubData` ile dinamik buffer güncelleme. Onları tekrar anlatmayacağım, doğrudan üstüne kuracağım.

### Batching'in Bıraktığı Yerden

Batching yolunun bir sprite için GPU'ya ne yazdığına yakından bakalım.

Sahnemiz artık atlas'tan kesilmiş sprite'lar değil, düz renkli parçacıklar. Her parçacığın bir konumu, bir boyutu ve bir rengi var. Batching bunu köşelere dağıtmak zorunda, çünkü vertex shader'ın gördüğü tek şey köşelerdir. Köşe başına konum (2 float), birim kare içindeki yeri (2 float) ve renk (3 float): yedi float. Dört köşe ile yirmi sekiz float.

```ts
// batched-writer.ts — #7'deki paketlemenin renk taşıyan hali
export const FLOATS_PER_BATCHED_VERTEX = 7; // x, y, u, v, r, g, b
export const VERTICES_PER_QUAD = 4;
export const FLOATS_PER_BATCHED_SPRITE =
  FLOATS_PER_BATCHED_VERTEX * VERTICES_PER_QUAD; // 28

// Uint16 indeks sınırı: 65.536 / 4 köşe = 16.384 sprite
export const MAX_BATCH_SPRITES = 16384;

export function writeBatchedSprite(
  out: Float32Array,
  index: number,
  x: number,
  y: number,
  size: number,
  r: number,
  g: number,
  b: number,
): void {
  const o = index * FLOATS_PER_BATCHED_SPRITE;
  const x1 = x + size;
  const y1 = y + size;

  // sol üst
  out[o + 0] = x;
  out[o + 1] = y;
  out[o + 2] = 0;
  out[o + 3] = 0;
  out[o + 4] = r;
  out[o + 5] = g;
  out[o + 6] = b;

  // sol alt
  out[o + 7] = x;
  out[o + 8] = y1;
  out[o + 9] = 0;
  out[o + 10] = 1;
  out[o + 11] = r;
  out[o + 12] = g;
  out[o + 13] = b;

  // sağ üst
  out[o + 14] = x1;
  out[o + 15] = y;
  out[o + 16] = 1;
  out[o + 17] = 0;
  out[o + 18] = r;
  out[o + 19] = g;
  out[o + 20] = b;

  // sağ alt
  out[o + 21] = x1;
  out[o + 22] = y1;
  out[o + 23] = 1;
  out[o + 24] = 1;
  out[o + 25] = r;
  out[o + 26] = g;
  out[o + 27] = b;
}
// (kısaltıldı: gerçek dosyada bir de `makeQuadIndices(spriteCount)` var —
//  sprite başına iki üçgen indeksi, kurulumda bir kez STATIC_DRAW ile yüklenir.)
```

Bu fonksiyona uzun uzun bakın, çünkü yazının bütün derdi burada duruyor.

`r`, `g`, `b` dört kere yazılıyor. Aynı üç sayı, dört köşenin her birinde. Birim kare koordinatları (`0,0` / `0,1` / `1,0` / `1,1`) her sprite için yeniden yazılıyor, oysa dünyadaki bütün sprite'larda aynılar. Konum bile tek bir noktadan türetilebilir: `x` ile `size` verilse `x1` zaten hesaplanabilir.

Yirmi sekiz floattan gerçekten farklı olan kaç tanesi var? Altı: `x`, `y`, `size`, `r`, `g`, `b`.

Gerisi tekrar. Kare başına, sprite başına, altmış kere saniyede tekrar.

Elli bin parçacıkta bu 50.000 × 28 × 4 = 5,6 megabayt eder. Her karede, PCIe hattı üzerinden yukarı. Saniyede 336 megabayt, sadece hareket etmeyi bilen daireler için.

### Instancing Fikri: Şablon Bir Kez, Fark Bin Kez

Instancing tek bir soruyla başlıyor: bu verinin hangi kısmı sahnedeki bütün nesneler için ortak?

Cevap geometri. Bütün parçacıklar aynı birim karenin ölçeklenmiş ve kaydırılmış halleri. O halde birim kareyi GPU'ya bir kez yükleyelim, orada dursun, bir daha dokunmayalım.

```ts
// instance-buffer.ts
// Şablon: birim kare. Köşe koordinatı hem konum çarpanı hem
// de parçacık içi konum (0..1) olarak kullanılır.
// TRIANGLE_STRIP sırası: sol üst, sol alt, sağ üst, sağ alt.
export const QUAD_VERTICES = new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]);
```

Sekiz float. Uygulamanın ömrü boyunca toplam sekiz float, kare başına değil.

Geriye kalan tek soru şu: her parçacığın bu şablondan nasıl farklılaştığı. Konum, boyut, renk. Altı float.

```ts
// instance-buffer.ts (devam)
export const FLOATS_PER_INSTANCE = 6; // x, y, size, r, g, b
export const BYTES_PER_FLOAT = Float32Array.BYTES_PER_ELEMENT; // 4
export const BYTES_PER_INSTANCE = FLOATS_PER_INSTANCE * BYTES_PER_FLOAT; // 24
```

Mühür benzetmesinde şablon kauçuk kalıp, örnek kaydı da her basış için verdiğimiz tarif. Kalıbı bir kez oyuyoruz. Tarif yirmi dört bayt.

Peki GPU bu ikisini nasıl birleştirecek? Şablonda dört köşe var, örnek buffer'ında elli bin kayıt. Vertex shader çalışırken hangi köşeyi hangi kayıtla eşleştireceğini nereden bilecek?

İşte tam burada tek bir WebGL2 çağrısı devreye giriyor.

### vertexAttribDivisor: Attribute'u Köşeye Değil Örneğe Bağlamak

Normalde GPU bir attribute'u okurken şöyle davranır: her köşe için bir adım ilerle. Sıfırıncı köşe buffer'ın sıfırıncı kaydını okur, birinci köşe birinciyi, ikinci köşe ikinciyi. Attribute pointer'ın stride'ı (adım genişliği) ne kadarsa, okuma kafası her köşede o kadar kayar.

`vertexAttribDivisor(location, divisor)` bu davranışı değiştirir. Anlamı çok basit:

> Bu attribute'un okuma kafası, her `divisor` **örnekte** bir kez ilerlesin; köşeler arasında hiç kımıldamasın.

`divisor = 0` varsayılan davranıştır: köşe başına ilerle. `divisor = 1` ise örnek başına ilerle demektir. `divisor = 2` yazarsanız iki örnekte bir ilerler, ki bu da bazı senaryolarda işe yarar (çiftler halinde ortak veri paylaşan nesneler) ama pratikte neredeyse hep 1 kullanırsınız.

Bunu somutlaştıralım. Elli bin parçacık, dört köşe. Vertex shader toplam 200.000 kez çalışır. Bu 200.000 çalıştırmada:

- `a_corner` attribute'u (divisor 0) buffer'ın 0, 1, 2, 3 kayıtlarını sırayla okur ve her örnekte baştan başlar.
- `a_offset` attribute'u (divisor 1) bir örneğin dört köşesi boyunca **aynı** kaydı okur, örnek değişince bir sonrakine geçer.

Şablon dönüp duruyor, tarif ilerliyor. Mühür aynı mühür, basılan yer değişiyor.

Kurulumda şuna benziyor:

```ts
// instanced-renderer.ts'ten çıkarılmış özet — tam kurulum aşağıda
// Şablon buffer'ı: köşe başına ilerlesin (varsayılan, ama açıkça yazmak iyidir)
gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(aCorner, 0);

// Örnek buffer'ı: örnek başına ilerlesin
gl.vertexAttribPointer(aOffset, 2, gl.FLOAT, false, BYTES_PER_INSTANCE, 0);
gl.vertexAttribDivisor(aOffset, 1);
```

Şimdi size bu yazının en pahalı yarım saatini anlatayım.

İlk denememde `a_color` için `vertexAttribDivisor` çağırmayı unuttum. Konum ve boyut doğru, renk unutulmuş. Ekranda elli bin parçacık yerine dört tane gördüm. Dört.

Sebep gayet mantıklı: renk attribute'u divisor 0'da kaldığı için köşe başına ilerlemeye devam etti ve her örnekte örnek buffer'ının ilk dört kaydını okudu. Renk kaydı 24 bayt stride ile okunduğu için bu, ilk dört parçacığın verisine denk geliyordu. Elli bin parçacık üst üste, dört ayrı yerde çizildi. Ekran neredeyse boş, sayaç 50.000 diyor.

Ders şu: divisor **her** örnek attribute'u için ayrı ayrı ayarlanır. Toplu bir "bu buffer örnek buffer'ıdır" anahtarı yoktur. Attribute başına, tek tek.

Güzel haber, divisor ayarı VAO'nun (vertex array object) durumuna dahildir. Bir kez kurup VAO'yu bağladığınızda geri gelir; her karede tekrar çağırmanız gerekmez.

Bir de attribute slotu muhasebesi var. WebGL2 en az 16 attribute slotu garanti eder ve bir `mat4` tek başına dört slot yer. Örnek başına tam bir dönüşüm matrisi göndermeyi planlıyorsanız bütçeyi önceden hesaplayın; bizim altı floatlık kaydımız üç slot (vec2 + float + vec3) kullanıyor, artı şablon için bir tane. Rahatız.

### Instancing Shader'ı: Köşe Çarpı Boyut, Artı Konum

Vertex shader'ın işi tek satıra iniyor: şablon köşesini örnek boyutuyla çarp, örnek konumuna ekle.

Bu shader `src/shaders.ts` içinde `INSTANCED_VERTEX_SHADER` template literal'i olarak duruyor; aşağıdaki satır sonu yorumları okuma kolaylığı için eklendi, gerçek string'de yoklar.

```glsl
#version 300 es
in vec2 a_corner;           // birim kare köşesi (0..1) — divisor 0
in vec2 a_offset;           // örnek konumu, piksel — divisor 1
in float a_size;            // örnek boyutu, piksel — divisor 1
in vec3 a_color;            // örnek rengi — divisor 1
uniform vec2 u_resolution;
out vec2 v_corner;
out vec3 v_color;

void main() {
  vec2 pixel = a_offset + a_corner * a_size;
  vec2 clip = (pixel / u_resolution) * 2.0 - 1.0;
  v_corner = a_corner;
  v_color = a_color;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
```

`a_corner * a_size` çarpımı, batching'de CPU'da yaptığımız `x1 = x + size` hesabının GPU'ya taşınmış hali. Dört köşeyi CPU'da üretip yollamıyoruz; tek bir konum ve tek bir boyut yolluyoruz, dört köşeyi GPU türetiyor.

Fragment shader'ı iki yol da paylaşıyor. Doku yok, daireyi prosedürel çiziyoruz: köşe koordinatının merkeze uzaklığı yarıçapı aşarsa piksel atılıyor.

```glsl
#version 300 es
precision mediump float;
in vec2 v_corner;
in vec3 v_color;
out vec4 outColor;

void main() {
  float dist = length(v_corner - 0.5);
  if (dist > 0.5) discard;                       // karenin köşelerini kes
  float alpha = smoothstep(0.5, 0.35, dist);     // kenarı yumuşat
  outColor = vec4(v_color, alpha);
}
```

TypeScript tarafında üçü de template literal. `#version 300 es` satırının backtick'ten hemen sonra gelmesi zorunluluğu hâlâ geçerli; bu tuzağa iki yazıdır düşmüyorum ama sadece hatırladığım için düşmüyorum.

```ts
// shaders.ts — DİKKAT: `#version 300 es` ilk satır olmak zorunda
export const INSTANCED_VERTEX_SHADER = `#version 300 es
in vec2 a_corner;
in vec2 a_offset;
in float a_size;
in vec3 a_color;
uniform vec2 u_resolution;
out vec2 v_corner;
out vec3 v_color;

void main() {
  vec2 pixel = a_offset + a_corner * a_size;
  vec2 clip = (pixel / u_resolution) * 2.0 - 1.0;
  v_corner = a_corner;
  v_color = a_color;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

export const BATCHED_VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
in vec3 a_color;
uniform vec2 u_resolution;
out vec2 v_corner;
out vec3 v_color;

void main() {
  vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
  v_corner = a_uv;
  v_color = a_color;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

export const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec2 v_corner;
in vec3 v_color;
out vec4 outColor;

void main() {
  float dist = length(v_corner - 0.5);
  if (dist > 0.5) discard;
  float alpha = smoothstep(0.5, 0.35, dist);
  outColor = vec4(v_color, alpha);
}
`;
```

İki vertex shader, tek fragment shader. Karşılaştırmanın adil olması için pikselleri boyayan kodun birebir aynı olması şart; sadece köşelerin nereden geldiği değişiyor.

### Örnek Buffer'ını Paketlemek

Örnek kayıtlarını tutan yapı, batching'deki `SpriteBatch`'in çok daha sade bir akrabası. Kapasitesi kadar yer ayrılmış tek bir `Float32Array`, bir sayaç, bir de yazma fonksiyonu. WebGL'i hiç tanımıyor, bu yüzden headless test edilebiliyor.

```ts
// instance-buffer.ts (devam)
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
```

Batching'deki `flush()` mekanizmasının burada olmadığına dikkat edin. Orada kapasiteyi `Uint16Array` indeks sınırı belirliyordu ve elli bin sprite mecburen dörde bölünüyordu. Instancing'de indeks buffer'ı yok; `drawArraysInstanced`'ın örnek sayısı 32 bitlik bir tam sayı. İki yüz bin parçacık tek çağrı.

(WebGL2'de `UNSIGNED_INT` indeksler de kullanılabilir, dolayısıyla batching yolunu da 16.384 sınırından kurtarabilirsiniz. Karşılaştırmayı geçen yazının koduyla birebir tutmak için Uint16'da bıraktım. Sınırı kaldırsanız bile sprite başına 28 float yazma maliyeti değişmiyor.)

Kaydın düzeni (layout) attribute pointer'larla birebir uyumlu olmak zorunda. Stride 24 bayt, offsetler 0 / 8 / 12. Bu üç sayı ile shader'daki `in` sırası birbirini tutmuyorsa ekranda sessiz bir saçmalık görürsünüz: hata mesajı yok, sadece yanlış renkte, yanlış yerde parçacıklar. Testlerin bir bölümü tam olarak bu muhasebeyi çiviliyor.

### drawArraysInstanced ile Tek Çağrı

Renderer'ı kuralım. İki buffer var: biri hiç değişmeyen şablon, diğeri her kare üzerine yazılan örnek verisi.

```ts
// instanced-renderer.ts
import { createProgram } from "./gl";
import { INSTANCED_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER } from "./shaders";
import {
  QUAD_VERTICES,
  FLOATS_PER_INSTANCE,
  BYTES_PER_INSTANCE,
  BYTES_PER_FLOAT,
} from "./instance-buffer";

export interface InstancedRenderer {
  setResolution(width: number, height: number): void;
  /** Dönüş: bu karede GPU'ya yüklenen bayt sayısı. */
  draw(instances: Float32Array, count: number): number;
  dispose(): void;
}

export function createInstancedRenderer(
  gl: WebGL2RenderingContext,
  capacity: number,
): InstancedRenderer {
  const program = createProgram(
    gl,
    INSTANCED_VERTEX_SHADER,
    PARTICLE_FRAGMENT_SHADER,
  );

  const aCorner = gl.getAttribLocation(program, "a_corner");
  const aOffset = gl.getAttribLocation(program, "a_offset");
  const aSize = gl.getAttribLocation(program, "a_size");
  const aColor = gl.getAttribLocation(program, "a_color");
  const uResolution = gl.getUniformLocation(program, "u_resolution");

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // 1) Şablon buffer'ı: bir kez yüklenir, bir daha dokunulmaz.
  const quadVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aCorner);
  gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aCorner, 0); // köşe başına ilerle

  // 2) Örnek buffer'ı: kapasite kadar boş yer, her kare üzerine yazılır.
  const instanceVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceVbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    capacity * BYTES_PER_INSTANCE,
    gl.DYNAMIC_DRAW,
  );

  // Üç attribute da AYNI buffer'dan, aynı 24 baytlık stride ile okur.
  gl.enableVertexAttribArray(aOffset);
  gl.vertexAttribPointer(aOffset, 2, gl.FLOAT, false, BYTES_PER_INSTANCE, 0);
  gl.vertexAttribDivisor(aOffset, 1);

  gl.enableVertexAttribArray(aSize);
  gl.vertexAttribPointer(
    aSize,
    1,
    gl.FLOAT,
    false,
    BYTES_PER_INSTANCE,
    2 * BYTES_PER_FLOAT,
  );
  gl.vertexAttribDivisor(aSize, 1);

  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(
    aColor,
    3,
    gl.FLOAT,
    false,
    BYTES_PER_INSTANCE,
    3 * BYTES_PER_FLOAT,
  );
  gl.vertexAttribDivisor(aColor, 1);

  gl.bindVertexArray(null);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  return {
    setResolution(width: number, height: number): void {
      gl.useProgram(program);
      gl.uniform2f(uResolution, width, height);
    },

    draw(instances: Float32Array, count: number): number {
      if (count === 0) return 0;

      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceVbo);

      // Sadece dolu kısım: yeniden ayırma yok, üzerine yazma var.
      const floats = count * FLOATS_PER_INSTANCE;
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances, 0, floats);

      // 4 köşelik şablon, count kere basılıyor.
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);

      return floats * BYTES_PER_FLOAT;
    },

    dispose(): void {
      gl.deleteBuffer(quadVbo);
      gl.deleteBuffer(instanceVbo);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
```

Son satırdaki çağrıya bakın: `drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)`.

Dört köşe. `count` kere. İki yüz bin parçacıkta bile bu satır bir kere çalışıyor.

`TRIANGLE_STRIP` seçimi de bilinçli. Dört köşeyi indeks buffer'ı olmadan iki üçgene bağlamanın en ucuz yolu bu; strip sırası sol üst, sol alt, sağ üst, sağ alt olduğunda GPU (0,1,2) ve (1,2,3) üçgenlerini kuruyor ve tam bir kare çıkıyor. İndeks buffer'ına ihtiyaç yok, `drawElementsInstanced`'a da. Daha karmaşık şablon geometrilerinde (bir ağaç modeli, bir asker mesh'i) indeksli hale geçersiniz; API'nin geri kalanı aynı kalır.

### Her Karede Yalnızca Örnek Verisini Yüklemek

Kare döngüsü artık şu kadar:

```ts
// render-path.ts — instanced yolun render() gövdesi
buffer.reset();
for (const p of particles) {
  buffer.push(p.x, p.y, p.size, p.r, p.g, p.b);
}
const bytes = renderer.draw(buffer.data, buffer.length);
```

`quadVbo`'ya bu döngüde hiç dokunulmuyor. Kurulumda bir kez `bufferData` ile yüklendi, orada duruyor. Her karede yukarı çıkan tek şey `instanceVbo`'nun dolu kısmı.

Ölçek farkını sayılarla koyalım:

| Ne | Ne zaman yüklenir | Boyut |
|---|---|---|
| Şablon (4 köşe) | Kurulumda, bir kez | 32 bayt |
| Örnek verisi, 50.000 parçacık | Her kare | 1,2 MB |
| Batching, 50.000 sprite | Her kare | 5,6 MB |

Oran tam olarak 28/6, yani 4,67. Dörtte birin biraz altı.

Bu oran sadece PCIe trafiğini değil, CPU'nun yazma işini de aynı katsayıyla düşürüyor. Batching'de elli bin sprite için 1,4 milyon float yazıyorduk; instancing'de 300 bin. `Float32Array`'e yazmak ucuz bir iş ama bedava değil, ve bu döngü kare bütçesinin içinde duruyor.

Sıfır-ayırma disiplini de yerinde: `reset()` sadece sayacı sıfırlıyor, `push()` içinde tek bir `new` yok. Havuz yazısındaki kural burada da geçerli, çünkü kare döngüsünde ayırma yapan her satır GC'ye randevu veriyor.

Karşılaştırma yolunu da kuralım. Batching renderer'ı (`batched-renderer.ts`, depoda tam hali var) geçen yazının kodunun renk taşıyan hali: VBO + indeks buffer'ı, divisor yok, `drawElements`. Parça parça çiziyor, çünkü kapasitesi 16.384 sprite:

```ts
// render-path.ts — iki yolu tek arayüzün arkasına koyar
import { createInstancedRenderer } from "./instanced-renderer";
import { createBatchedRenderer } from "./batched-renderer";
import { InstanceBuffer } from "./instance-buffer";
import {
  writeBatchedSprite,
  FLOATS_PER_BATCHED_SPRITE,
  MAX_BATCH_SPRITES,
} from "./batched-writer";
import type { Particle } from "./particles";

export type RenderMode = "instanced" | "batched";

export interface RenderStats {
  drawCalls: number;
  bytesUploaded: number;
}

export interface ParticleRenderPath {
  readonly mode: RenderMode;
  resize(width: number, height: number): void;
  render(particles: Particle[]): RenderStats;
  dispose(): void;
}

export function createRenderPath(
  gl: WebGL2RenderingContext,
  mode: RenderMode,
  capacity: number,
): ParticleRenderPath {
  if (mode === "instanced") {
    const renderer = createInstancedRenderer(gl, capacity);
    const buffer = new InstanceBuffer(capacity);

    return {
      mode,
      resize: (w, h) => renderer.setResolution(w, h),
      render(particles) {
        buffer.reset();
        for (const p of particles) {
          buffer.push(p.x, p.y, p.size, p.r, p.g, p.b);
        }
        const bytes = renderer.draw(buffer.data, buffer.length);
        return { drawCalls: buffer.length > 0 ? 1 : 0, bytesUploaded: bytes };
      },
      dispose: () => renderer.dispose(),
    };
  }

  const chunk = Math.min(capacity, MAX_BATCH_SPRITES);
  const renderer = createBatchedRenderer(gl, chunk);
  const vertices = new Float32Array(chunk * FLOATS_PER_BATCHED_SPRITE);

  return {
    mode,
    resize: (w, h) => renderer.setResolution(w, h),
    render(particles) {
      let drawCalls = 0;
      let bytesUploaded = 0;
      let n = 0;

      for (const p of particles) {
        writeBatchedSprite(vertices, n, p.x, p.y, p.size, p.r, p.g, p.b);
        n++;
        if (n === chunk) {
          bytesUploaded += renderer.drawChunk(vertices, n);
          drawCalls++;
          n = 0;
        }
      }
      if (n > 0) {
        bytesUploaded += renderer.drawChunk(vertices, n);
        drawCalls++;
      }
      return { drawCalls, bytesUploaded };
    },
    dispose: () => renderer.dispose(),
  };
}
```

Geçen yazıda iki render yolunu karşılaştırmak için iki ayrı `<canvas>` kullanmak zorunda kalmıştık, çünkü bir canvas'tan hem `2d` hem `webgl2` context'i alınamıyor. Bu sefer o dert yok: iki yol da WebGL2. Aynı context, aynı canvas, sadece farklı program ve farklı VAO. Anahtarı çevirdiğinizde ekranda tek bir titreme bile olmuyor.

Parçacıklar tarafında sahne deterministik, geçen yazıdaki tohumlu üreteçle kuruluyor:

```ts
// particles.ts
export function makeRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

const PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [0.486, 0.227, 0.929],
  [0.133, 0.773, 0.965],
  [0.957, 0.447, 0.714],
  [0.98, 0.8, 0.082],
  [0.204, 0.827, 0.6],
  [0.973, 0.443, 0.443],
];

export function makeParticles(
  n: number,
  width: number,
  height: number,
  seed = 1337,
): Particle[] {
  const rng = makeRng(seed);
  const particles: Particle[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const size = 4 + rng() * 10;
    const [r, g, b] = PALETTE[Math.floor(rng() * PALETTE.length)];
    particles[i] = {
      x: rng() * (width - size),
      y: rng() * (height - size),
      vx: (rng() - 0.5) * 180, // piksel/saniye
      vy: (rng() - 0.5) * 180,
      size,
      r,
      g,
      b,
    };
  }
  return particles;
}

export function updateParticles(
  particles: Particle[],
  dt: number,
  width: number,
  height: number,
): void {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.x < 0) {
      p.x = 0;
      p.vx = -p.vx;
    }
    if (p.y < 0) {
      p.y = 0;
      p.vy = -p.vy;
    }
    if (p.x + p.size > width) {
      p.x = width - p.size;
      p.vx = -p.vx;
    }
    if (p.y + p.size > height) {
      p.y = height - p.size;
      p.vy = -p.vy;
    }
  }
}
```

Bu döngü hâlâ CPU'da dönüyor ve iki render yolu için de aynı. Ölçtüğümüz şey çizim, simülasyon değil.

### Batching vs Instancing: Dürüst Ölçüm

Demoda üç parçacık sayısı, bir de yol anahtarı var. HUD'da FPS, kare süresi, draw call ve kare başına yüklenen bayt yazıyor.

Kare süresi ve FPS sütununu buraya tablo olarak yazmıyorum. O iki sayı GPU'ya, sürücüye, tarayıcıya ve canvas boyutuna göre değişiyor; sizin makinenizde okuyacağınız değerle benimki arasında iki kat fark olabilir. `npm run dev` ile demoyu açın, anahtarı çevirin, kendi sayınızı okuyun. Buraya yazacağım sayılar ancak sizi yanıltır.

Yazılabilir olan sütunlar bunlar, çünkü makineye değil aritmetiğe bağlılar:

| Parçacık | Yol | Draw call | Kare başına yüklenen |
|---|---|---|---|
| 10.000 | batching | 1 | 1,12 MB |
| 10.000 | instancing | 1 | 240 KB |
| 50.000 | batching | 4 | 5,60 MB |
| 50.000 | instancing | 1 | 1,20 MB |
| 200.000 | batching | 13 | 22,4 MB |
| 200.000 | instancing | 1 | 4,80 MB |

Bu sütunları GPU olmadan da doğrulayabiliriz:

```ts
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
```

`npm run bench` bu muhasebeyi Node'da basıyor, üstüne bir de paketleme hızını ölçüyor:

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

Bu çıktıdaki en öğretici satır sonuncusu. İki yüz bin parçacıkta batching saniyede 1,3 gigabayt veri yolluyor, instancing 275 megabayt. İkisi de aynı sahneyi çiziyor, aynı pikselleri boyuyor.

Paketleme satırındaki oranın 4,67 değil 1,70 çıkması ise beklediğimden düşük ve tam olarak bu yüzden bırakıyorum. Yazılan float sayısı 4,67 kat, süre oranı 1,7. Aradaki farkın sebebi iki yolun sabit maliyetlerinin aynı olması: parçacık nesnesinden altı property okumak, döngüyü döndürmek, `push` çağrısının kapasite kontrolü. Instancing bu sabit maliyetin üstüne 6 float yazıyor, batching 28 float; float yazma kısmı ise `Float32Array` üzerinde çok ucuz. Yani CPU tarafındaki asıl iş float yazmak değil, veriyi toplamak. Mikro-benchmark'lar bu tür sürprizlerle dolu; sayıyı 4,67'ye yaklaştırmak için döngüyü kurcalamadım, olduğu gibi verdim.

Instancing'in asıl kazancı bu satırda değil zaten. Bir alttaki tabloda: kare başına 21,4 MB yerine 4,6 MB.

Şimdi dürüstlük bölümü, çünkü instancing her durumda kazanmaz.

Az sayıda örnekle instancing batching'den yavaş olabilir. Instanced draw call'un sürücü tarafında kendine ait bir kurulum maliyeti var ve elli örnek için o maliyet, elli sprite'ı düz bir buffer'a yazmaktan pahalıya gelebilir. Kırk parçacıklı bir efekt için instancing'e geçmek ölçülebilir bir kazanç getirmez.

İkinci nokta: buradaki kazancın bir kısmı veri hacminden değil, GPU'nun aynı şablonu tekrar tekrar okumasının cache dostu olmasından geliyor. Bunu tek başına ayırıp ölçmedim; ayırmak için GPU zamanlama sorgusu gerekiyor ve o başka bir yazının konusu.

Üçüncüsü ve en önemlisi: bu yol hâlâ CPU'ya bağlı. İki yüz bin parçacığın konumunu her karede JavaScript güncelliyor ve kare bütçesinin azımsanmayacak bir kısmı `updateParticles` ile örnek buffer'ını doldurma döngüsünde geçiyor — bench'teki 20,7 ns/parçacık, iki yüz bin parçacıkta tek başına 4 ms demek, üstüne bir de simülasyon var. Instancing yüklenen veriyi dörtte bire indirdi, hesabı değil. O basamağı geçmek için verinin GPU'da kalması gerekiyor, ki compute shader yazısında tam olarak onu yapmıştık. Bu yazı ikisinin arasındaki köprü.

Bir de saydamlık uyarısı: parçacıklar alpha blending (saydamlık harmanlama) ile çiziliyor ve instancing çizim sırasını buffer sırasıyla belirliyor. Derinlik testi kullanan saydam nesnelerde sıralamayı korumak isterseniz, örnek buffer'ını her karede sıralamak zorunda kalabilirsiniz. Parçacık sistemlerinde bu genelde sorun olmaz, çünkü sıra kimsenin dikkatini çekmez. Nesneler birbirinin arkasında duran gerçek geometrilerse olur.

### Test Edilebileni Test Etmek

Headless vitest ortamında WebGL yok. `drawArraysInstanced`'ı test edemezsiniz.

Ama beni uykusuz bırakan hatalar zaten orada değil. Offset aritmetiğinde, stride hesabında, kapasite muhasebesinde. Bunları test etmek için kodu WebGL'den ayırdık, şimdi faturayı tahsil ediyoruz.

Önce örnek kaydının paketlenmesi:

```ts
// test/instance-buffer.test.ts
import { describe, it, expect } from "vitest";
import {
  InstanceBuffer,
  FLOATS_PER_INSTANCE,
  BYTES_PER_INSTANCE,
  QUAD_VERTICES,
} from "../src/instance-buffer";

describe("InstanceBuffer paketleme", () => {
  it("her kayıt tam 6 float, doğru offsette yazılır", () => {
    const buf = new InstanceBuffer(4);
    buf.push(10, 20, 8, 1, 0.5, 0.25);
    buf.push(100, 200, 16, 0, 1, 0);

    expect(Array.from(buf.data.subarray(0, 6))).toEqual([
      10, 20, 8, 1, 0.5, 0.25,
    ]);
    // İkinci kayıt tam 6 float sonra başlar
    expect(Array.from(buf.data.subarray(6, 12))).toEqual([
      100, 200, 16, 0, 1, 0,
    ]);
  });

  it("kayıt sayısı ile bayt boyutu tutarlıdır", () => {
    const buf = new InstanceBuffer(1000);
    for (let i = 0; i < 250; i++) buf.push(i, i, 1, 0, 0, 0);

    expect(buf.length).toBe(250);
    expect(buf.usedFloats).toBe(250 * FLOATS_PER_INSTANCE);
    expect(buf.usedBytes).toBe(250 * BYTES_PER_INSTANCE);
    expect(BYTES_PER_INSTANCE).toBe(24);
  });

  it("kapasite dolunca push false döner ve veri bozulmaz", () => {
    const buf = new InstanceBuffer(2);
    expect(buf.push(1, 1, 1, 0, 0, 0)).toBe(true);
    expect(buf.push(2, 2, 2, 0, 0, 0)).toBe(true);
    expect(buf.push(3, 3, 3, 0, 0, 0)).toBe(false);

    expect(buf.length).toBe(2);
    expect(buf.data[0]).toBe(1);
    expect(buf.data[6]).toBe(2);
  });

  it("reset sayacı sıfırlar, diziyi yeniden ayırmaz", () => {
    const buf = new InstanceBuffer(8);
    const ref = buf.data;
    buf.push(5, 5, 5, 0, 0, 0);
    buf.reset();

    expect(buf.length).toBe(0);
    expect(buf.usedBytes).toBe(0);
    expect(buf.data).toBe(ref); // aynı ArrayBuffer, allocation yok
  });

  it("kapasite tam sayı ve pozitif olmalı", () => {
    expect(() => new InstanceBuffer(0)).toThrow(RangeError);
    expect(() => new InstanceBuffer(1.5)).toThrow(RangeError);
  });

  it("şablon 4 köşe, 8 float ve birim kare", () => {
    expect(QUAD_VERTICES.length).toBe(8);
    expect(Array.from(QUAD_VERTICES)).toEqual([0, 0, 0, 1, 1, 0, 1, 1]);
  });
});
```

Son test ilk bakışta gereksiz görünüyor olabilir. Bende bir kere şablonu `[-1, -1, ...]` diye merkezlenmiş yazmıştım ve vertex shader'daki `a_offset + a_corner * a_size` formülüyle uyuşmadığı için her parçacık sol üstüne kaymış çizildi. Şablonun köşe sırası ile shader'ın formülü arasındaki sözleşme, hiçbir tip sisteminin yakalayamayacağı bir sözleşme. O yüzden testte duruyor.

Sonra batching'in aynı sahne için ne yazdığı. Buradaki iddia yazının tezi:

```ts
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
```

"Aynı renk dört kere tekrar yazılır" testi bir doğrulama değil, bir belge. Kodun israfını kod olarak sabitliyor; biri o dört tekrarı kaldırmaya kalkarsa test kırılır ve kaldıranı doğru soruya götürür.

Şimdi iki yolun oranı:

```ts
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
```

`batchedDrawCalls(50_000)` satırının 4 vermesi hoşuma gitti. Geçen yazıda tarayıcıda ölçtüğüm sayının aynısı, bu sefer saf aritmetikten çıkıyor.

Son olarak simülasyonun determinizmi. Aynı tohum, aynı sahne; iki render yolunu karşılaştırırken bu şart:

```ts
// test/particles.test.ts
import { describe, it, expect } from "vitest";
import { makeParticles, updateParticles, makeRng } from "../src/particles";

describe("parçacık simülasyonu", () => {
  it("aynı tohum aynı sahneyi üretir", () => {
    const a = makeParticles(200, 800, 600, 42);
    const b = makeParticles(200, 800, 600, 42);
    expect(a).toEqual(b);

    const c = makeParticles(200, 800, 600, 43);
    expect(c[0]).not.toEqual(a[0]);
  });

  it("başlangıçta bütün parçacıklar sahnenin içinde", () => {
    const ps = makeParticles(1000, 800, 600);
    for (const p of ps) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.size).toBeLessThanOrEqual(800);
      expect(p.y + p.size).toBeLessThanOrEqual(600);
    }
  });

  it("kenara çarpan parçacık geri seker ve dışarı taşmaz", () => {
    const ps = makeParticles(1, 800, 600, 7);
    ps[0].x = 795;
    ps[0].y = 300;
    ps[0].vx = 500;
    ps[0].vy = 0;
    ps[0].size = 10;

    updateParticles(ps, 0.1, 800, 600);

    expect(ps[0].x + ps[0].size).toBeLessThanOrEqual(800);
    expect(ps[0].vx).toBeLessThan(0); // yön döndü
  });

  it("mulberry32 tohumu 0..1 aralığında üretir", () => {
    const rng = makeRng(1337);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

Bu testlerin hiçbiri GPU'nun doğru pikselleri çizdiğini kanıtlamıyor. Onun için tarayıcıya bakmak gerek, hem de her seferinde. Ama divisor'ı unuttuğumda ekranda gördüğüm dört parçacık dışındaki bütün hatalarım bu dosyaların menzilindeydi.

### Özetle:

1. Batching sprite başına dört köşe yazar; renk ve birim kare koordinatları her köşede tekrar eder. Yirmi sekiz floatın yalnızca altısı gerçekten farklıdır.
2. Instancing geometriyi (şablonu) GPU'ya bir kez `STATIC_DRAW` ile yükler ve bir daha dokunmaz. Her karede yukarı çıkan tek şey örnek kayıtlarıdır.
3. `gl.vertexAttribDivisor(loc, 1)` bir attribute'u köşeye değil örneğe bağlar. Şablon attribute'larında divisor 0 kalır; bu ayar attribute başına yapılır, toplu anahtarı yoktur.
4. Divisor'ı unutulan bir attribute hata vermez. Ekranda sadece örnek sayısı kadar değil, köşe sayısı kadar nesne görürsünüz; sessiz ve kafa karıştırıcı bir hata.
5. Divisor ayarı VAO durumuna dahildir. Bir kez kurun, `bindVertexArray` ile geri gelsin.
6. Örnek kaydını sıkı paketleyin: `[x, y, size, r, g, b]` ile stride 24 bayt, offsetler 0 / 8 / 12. Bu üç sayı shader'daki `in` bildirimleriyle birebir uyuşmalı.
7. Örnek buffer'ı `DYNAMIC_DRAW` ile kapasite kadar bir kez ayrılır, her karede `bufferSubData` ile yalnızca dolu kısmı yazılır. Yeniden ayırma yok.
8. `gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)` dört köşelik şablonu `count` kere basar. İndeks buffer'ı gerekmez, örnek sayısı 32 bit olduğu için Uint16 sınırı da yoktur.
9. Vertex shader'da `a_offset + a_corner * a_size` formülü, batching'de CPU'da yaptığımız köşe üretimini GPU'ya taşır. Şablonun köşe sırası ile bu formül bir sözleşmedir; teste yazın.
10. Kazanç sabittir ve ölçülebilir: 112 bayt yerine 24 bayt, sprite başına 4,67 kat az veri. İki yüz bin parçacıkta saniyede 1,3 GB yerine 275 MB.
11. Instancing az sayıda nesnede kazanmaz. Kurulum maliyeti kırk parçacıklık bir efekt için amortize olmaz.
12. Headless testte GPU yoktur ama paketleme offsetleri, stride muhasebesi, kapasite sınırı ve tohumlu simülasyon saf mantıktır. Hataların çoğu da tam olarak orada yaşar.

Bu yolun ulaştığı sınır net: veriyi dörtte bire indirdik ama hâlâ her karede gönderiyoruz. Parçacık sayısını yeterince büyütünce darboğaz yükleme değil, o iki yüz bin kaydı JavaScript'te dolduran döngü oluyor. Oradan sonrası compute shader'ın işi.

Bu tekniği bir performans hilesi diye öğrenmiştim. Divisor'ı unuttuğum o yarım saatten sonra başka türlü bakıyorum: `vertexAttribDivisor(loc, 1)` yazarken GPU'ya bir optimizasyon değil, bir cümle söylüyorsunuz. "Bu bilgi köşeye değil, nesneye ait." Sahnede neyin ortak neyin farklı olduğunu ayırmak, hız ayarından çok bir veri modeli kararı.

Mühür değişmiyor. Değişen tek şey, her basışta ona ne kadar şey anlatmak zorunda kaldığımız. 🖨️
