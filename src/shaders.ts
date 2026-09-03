// shaders.ts — DİKKAT: `#version 300 es` ilk satır olmak zorunda
export const INSTANCED_VERTEX_SHADER = `#version 300 es
in vec2 a_corner;
in vec2 a_offset;
in float a_size;
in vec3 a_color;
uniform vec2 u_resolution;
out vec2 v_corner;
out vec3 v_color;

void main() {
  vec2 pixel = a_offset + a_corner * a_size;
  vec2 clip = (pixel / u_resolution) * 2.0 - 1.0;
  v_corner = a_corner;
  v_color = a_color;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

export const BATCHED_VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
in vec3 a_color;
uniform vec2 u_resolution;
out vec2 v_corner;
out vec3 v_color;

void main() {
  vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
  v_corner = a_uv;
  v_color = a_color;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

export const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec2 v_corner;
in vec3 v_color;
out vec4 outColor;

void main() {
  float dist = length(v_corner - 0.5);
  if (dist > 0.5) discard;
  float alpha = smoothstep(0.5, 0.35, dist);
  outColor = vec4(v_color, alpha);
}
`;
