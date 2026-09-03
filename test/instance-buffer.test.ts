// test/instance-buffer.test.ts
import { describe, it, expect } from "vitest";
import {
  InstanceBuffer,
  FLOATS_PER_INSTANCE,
  BYTES_PER_INSTANCE,
  QUAD_VERTICES,
} from "../src/instance-buffer";

describe("InstanceBuffer packing", () => {
  it("writes exactly 6 floats per record at the right offset", () => {
    const buf = new InstanceBuffer(4);
    buf.push(10, 20, 8, 1, 0.5, 0.25);
    buf.push(100, 200, 16, 0, 1, 0);

    expect(Array.from(buf.data.subarray(0, 6))).toEqual([
      10, 20, 8, 1, 0.5, 0.25,
    ]);
    // The second record starts exactly 6 floats later
    expect(Array.from(buf.data.subarray(6, 12))).toEqual([
      100, 200, 16, 0, 1, 0,
    ]);
  });

  it("keeps the record count and the byte size consistent", () => {
    const buf = new InstanceBuffer(1000);
    for (let i = 0; i < 250; i++) buf.push(i, i, 1, 0, 0, 0);

    expect(buf.length).toBe(250);
    expect(buf.usedFloats).toBe(250 * FLOATS_PER_INSTANCE);
    expect(buf.usedBytes).toBe(250 * BYTES_PER_INSTANCE);
    expect(BYTES_PER_INSTANCE).toBe(24);
  });

  it("returns false from push once capacity is full, leaving data intact", () => {
    const buf = new InstanceBuffer(2);
    expect(buf.push(1, 1, 1, 0, 0, 0)).toBe(true);
    expect(buf.push(2, 2, 2, 0, 0, 0)).toBe(true);
    expect(buf.push(3, 3, 3, 0, 0, 0)).toBe(false);

    expect(buf.length).toBe(2);
    expect(buf.data[0]).toBe(1);
    expect(buf.data[6]).toBe(2);
  });

  it("resets the counter without reallocating the array", () => {
    const buf = new InstanceBuffer(8);
    const ref = buf.data;
    buf.push(5, 5, 5, 0, 0, 0);
    buf.reset();

    expect(buf.length).toBe(0);
    expect(buf.usedBytes).toBe(0);
    expect(buf.data).toBe(ref); // same ArrayBuffer, no allocation
  });

  it("requires the capacity to be a positive integer", () => {
    expect(() => new InstanceBuffer(0)).toThrow(RangeError);
    expect(() => new InstanceBuffer(1.5)).toThrow(RangeError);
  });

  it("has a template of 4 corners, 8 floats, and a unit quad", () => {
    expect(QUAD_VERTICES.length).toBe(8);
    expect(Array.from(QUAD_VERTICES)).toEqual([0, 0, 0, 1, 1, 0, 1, 1]);
  });
});
