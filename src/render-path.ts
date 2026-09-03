// render-path.ts — puts both paths behind a single interface
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
