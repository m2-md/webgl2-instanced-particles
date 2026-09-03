// test/particles.test.ts
import { describe, it, expect } from "vitest";
import { makeParticles, updateParticles, makeRng } from "../src/particles";

describe("particle simulation", () => {
  it("produces the same scene from the same seed", () => {
    const a = makeParticles(200, 800, 600, 42);
    const b = makeParticles(200, 800, 600, 42);
    expect(a).toEqual(b);

    const c = makeParticles(200, 800, 600, 43);
    expect(c[0]).not.toEqual(a[0]);
  });

  it("starts with every particle inside the scene", () => {
    const ps = makeParticles(1000, 800, 600);
    for (const p of ps) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.size).toBeLessThanOrEqual(800);
      expect(p.y + p.size).toBeLessThanOrEqual(600);
    }
  });

  it("bounces a particle off the edge without letting it escape", () => {
    const ps = makeParticles(1, 800, 600, 7);
    ps[0].x = 795;
    ps[0].y = 300;
    ps[0].vx = 500;
    ps[0].vy = 0;
    ps[0].size = 10;

    updateParticles(ps, 0.1, 800, 600);

    expect(ps[0].x + ps[0].size).toBeLessThanOrEqual(800);
    expect(ps[0].vx).toBeLessThan(0); // direction flipped
  });

  it("generates values in the 0..1 range from a mulberry32 seed", () => {
    const rng = makeRng(1337);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
