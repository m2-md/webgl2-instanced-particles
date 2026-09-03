// 500 ms'lik pencereyle FPS ve ortalama kare süresi
export function createSampler(windowMs = 500) {
  let frames = 0;
  let last = 0;
  let fps = 0;

  return (now: number): { fps: number; frameMs: number } => {
    frames++;
    if (last === 0) last = now;
    const elapsed = now - last;
    if (elapsed >= windowMs) {
      fps = (frames * 1000) / elapsed;
      frames = 0;
      last = now;
    }
    return { fps, frameMs: fps > 0 ? 1000 / fps : 0 };
  };
}
