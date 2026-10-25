import { BAYER8, coverRect } from './dither';

export type GlRenderer = {
  render(img: ImageBitmap, opts: { levels: number }): void;
  onContextLost(cb: () => void): void;
  dispose(): void;
};

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Mirrors ditherPixels() in dither.ts: tone → fade by row → per-channel Bayer quantize.
const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImg;
uniform vec4 uCrop;   // x, y, w, h of the cover crop in 0–1 texture space
uniform vec2 uSize;   // backing size in pixels
uniform float uLevels;
uniform float uBayer[64];
out vec4 outColor;

void main() {
  vec2 px = floor(gl_FragCoord.xy);
  float row = uSize.y - 1.0 - px.y;                  // 0 at the top
  vec2 uv = uCrop.xy + (vec2(px.x, row) + 0.5) / uSize * uCrop.zw;
  vec3 c = texture(uImg, uv).rgb;

  float t = clamp((row / uSize.y - 0.2) / 0.68, 0.0, 1.0);
  float fade = 0.5 * pow(1.0 - t * t * (3.0 - 2.0 * t), 1.6);

  float th = uBayer[int(mod(row, 8.0)) * 8 + int(mod(px.x, 8.0))];
  float steps = uLevels - 1.0;
  vec3 v = pow(c, vec3(1.2)) * fade * steps;
  vec3 base = floor(v);
  vec3 level = min(vec3(steps), base + vec3(greaterThan(v - base, vec3(th))));
  outColor = vec4(level / steps, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** WebGL2 dither renderer, or null when WebGL2 or the shaders aren't available. */
export function createGlRenderer(canvas: HTMLCanvasElement): GlRenderer | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  const u = (name: string) => gl.getUniformLocation(program, name);
  const loc = { img: u('uImg'), crop: u('uCrop'), size: u('uSize'), levels: u('uLevels'), bayer: u('uBayer[0]') };
  const vao = gl.createVertexArray();
  const texture = gl.createTexture();
  let uploaded: ImageBitmap | null = null;
  const lostCallbacks: (() => void)[] = [];

  const onLost = (e: Event) => {
    e.preventDefault();
    lostCallbacks.forEach((cb) => cb());
  };
  canvas.addEventListener('webglcontextlost', onLost);

  return {
    render(img, { levels }) {
      if (gl.isContextLost()) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (uploaded !== img) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        uploaded = img;
      }
      const { sx, sy, sw, sh } = coverRect(img.width, img.height, canvas.width, canvas.height);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform1i(loc.img, 0);
      gl.uniform4f(loc.crop, sx / img.width, sy / img.height, sw / img.width, sh / img.height);
      gl.uniform2f(loc.size, canvas.width, canvas.height);
      gl.uniform1f(loc.levels, levels);
      gl.uniform1fv(loc.bayer, BAYER8);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    onContextLost(cb) {
      lostCallbacks.push(cb);
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteTexture(texture);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
