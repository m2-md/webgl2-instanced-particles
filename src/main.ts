import { makeParticles, updateParticles, type Particle } from "./particles";
import {
  createRenderPath,
  type ParticleRenderPath,
  type RenderMode,
} from "./render-path";
import { createSampler } from "./sampler";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const gl = canvas.getContext("webgl2", { antialias: false });

const el = {
  mode: document.querySelector<HTMLElement>("#v-mode")!,
  count: document.querySelector<HTMLElement>("#v-count")!,
  fps: document.querySelector<HTMLElement>("#v-fps")!,
  ms: document.querySelector<HTMLElement>("#v-ms")!,
  calls: document.querySelector<HTMLElement>("#v-calls")!,
  bytes: document.querySelector<HTMLElement>("#v-bytes")!,
};

if (!gl) {
  el.mode.textContent = "no WebGL2";
  throw new Error("Could not get a WebGL2 context in this browser");
}

let mode: RenderMode = "instanced";
let count = 50_000;
let particles: Particle[] = [];
let path: ParticleRenderPath;

const sample = createSampler(500);

// Size the canvas to the screen (devicePixelRatio, capped at 2x)
function resizeCanvas(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr) || 800;
  const h = Math.floor(canvas.clientHeight * dpr) || 600;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

// One canvas, one WebGL2 context: switching paths only swaps the program and VAO.
function setupPath(): void {
  path?.dispose();
  resizeCanvas();
  path = createRenderPath(gl!, mode, count);
  path.resize(canvas.width, canvas.height);
  el.mode.textContent = mode === "instanced" ? "instancing" : "batching";
  syncButtons();
}

function rebuildParticles(): void {
  // The scene is deterministic: same seed, same particle list
  particles = makeParticles(count, canvas.width, canvas.height);
  el.count.textContent = count.toLocaleString("en-US");
}

function syncButtons(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>(
    "#counts button",
  )) {
    b.classList.toggle("active", Number(b.dataset.count) === count);
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>(
    "#modes button",
  )) {
    b.classList.toggle("active", b.dataset.mode === mode);
  }
}

document.querySelector("#counts")!.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn) return;
  count = Number(btn.dataset.count);
  setupPath();
  rebuildParticles();
});

document.querySelector("#modes")!.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn) return;
  const wanted = btn.dataset.mode as RenderMode;
  if (wanted === mode) return;
  mode = wanted;
  const keep = particles; // the scene is kept, only the path changes
  setupPath();
  particles = keep;
});

window.addEventListener("resize", () => {
  resizeCanvas();
  path.resize(canvas.width, canvas.height);
});

setupPath();
rebuildParticles();

let last = 0;
let hudAt = 0;

function frame(now: number): void {
  const dt = last === 0 ? 0 : Math.min(now - last, 50) / 1000;
  last = now;

  updateParticles(particles, dt, canvas.width, canvas.height);

  gl!.viewport(0, 0, canvas.width, canvas.height);
  gl!.clearColor(0.06, 0.06, 0.13, 1);
  gl!.clear(gl!.COLOR_BUFFER_BIT);

  const stats = path.render(particles);

  const { fps, frameMs } = sample(now);
  if (now - hudAt > 200) {
    // Keep HUD writes out of the measurement: once every 200 ms
    hudAt = now;
    el.fps.textContent = fps.toFixed(0);
    el.ms.textContent = `${frameMs.toFixed(2)} ms`;
    el.calls.textContent = stats.drawCalls.toLocaleString("en-US");
    el.bytes.textContent = `${(stats.bytesUploaded / 1048576).toFixed(2)} MB`;
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
