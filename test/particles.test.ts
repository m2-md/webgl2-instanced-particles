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
