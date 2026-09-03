// batched-renderer.ts — #7'deki batching yolunun renk taşıyan hali.
// Sprite başına dört köşe, köşe başına yedi float; indeksli çizim.
import { createProgram } from "./gl";
import { BATCHED_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER } from "./shaders";
import {
  FLOATS_PER_BATCHED_VERTEX,
  FLOATS_PER_BATCHED_SPRITE,
  makeQuadIndices,
} from "./batched-writer";
import { BYTES_PER_FLOAT } from "./instance-buffer";

export interface BatchedRenderer {
  setResolution(width: number, height: number): void;
  /** Dönüş: bu çağrıda GPU'ya yüklenen bayt sayısı. */
  drawChunk(vertices: Float32Array, spriteCount: number): number;
  dispose(): void;
}

export function createBatchedRenderer(
  gl: WebGL2RenderingContext,
  capacity: number,
): BatchedRenderer {
  const program = createProgram(
    gl,
    BATCHED_VERTEX_SHADER,
    PARTICLE_FRAGMENT_SHADER,
  );

  const aPos = gl.getAttribLocation(program, "a_pos");
  const aUv = gl.getAttribLocation(program, "a_uv");
  const aColor = gl.getAttribLocation(program, "a_color");
  const uResolution = gl.getUniformLocation(program, "u_resolution");

  const STRIDE = FLOATS_PER_BATCHED_VERTEX * BYTES_PER_FLOAT; // 28 bayt

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    capacity * FLOATS_PER_BATCHED_SPRITE * BYTES_PER_FLOAT,
    gl.DYNAMIC_DRAW,
  );

  // Burada divisor yok: üç attribute da köşe başına ilerler (divisor 0).
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, STRIDE, 2 * BYTES_PER_FLOAT);
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(
    aColor,
    3,
    gl.FLOAT,
    false,
    STRIDE,
    4 * BYTES_PER_FLOAT,
  );

  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    makeQuadIndices(capacity),
    gl.STATIC_DRAW,
  );

  gl.bindVertexArray(null);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  return {
    setResolution(width: number, height: number): void {
      gl.useProgram(program);
      gl.uniform2f(uResolution, width, height);
    },

    drawChunk(vertices: Float32Array, spriteCount: number): number {
      if (spriteCount === 0) return 0;

      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

      const floats = spriteCount * FLOATS_PER_BATCHED_SPRITE;
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices, 0, floats);
      gl.drawElements(gl.TRIANGLES, spriteCount * 6, gl.UNSIGNED_SHORT, 0);

      return floats * BYTES_PER_FLOAT;
    },

    dispose(): void {
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ibo);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
