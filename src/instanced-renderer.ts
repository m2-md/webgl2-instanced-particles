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
  /** Returns: the number of bytes uploaded to the GPU this frame. */
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

  // 1) Template buffer: uploaded once, never touched again.
  const quadVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aCorner);
  gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aCorner, 0); // advance per vertex

  // 2) Instance buffer: empty room for the full capacity, rewritten each frame.
  const instanceVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceVbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    capacity * BYTES_PER_INSTANCE,
    gl.DYNAMIC_DRAW,
  );

  // All three attributes read the SAME buffer with the same 24-byte stride.
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

      // Only the filled part: no reallocation, we overwrite in place.
      const floats = count * FLOATS_PER_INSTANCE;
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances, 0, floats);

      // The 4-corner template, stamped count times.
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
