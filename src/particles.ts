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
      vx: (rng() - 0.5) * 180, // pixels/second
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
