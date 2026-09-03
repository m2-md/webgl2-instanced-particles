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
