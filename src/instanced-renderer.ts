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
