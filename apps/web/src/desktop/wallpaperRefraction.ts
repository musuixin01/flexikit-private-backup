import type { DesktopWidget } from '@/types/desktopWidget'
import { createWallpaperAtlas, type WallpaperSnapshot } from '@/desktop/wallpaperLayout'

const MAX_TEXTURE_SIZE = 2048
const MAX_DEVICE_SCALE = 1.5
const SUPPORTED_TYPES = new Set(['glass', 'clear', 'dense'])
const VERTEX = `#version 300 es
layout(location = 0) in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec4 u_rect;
uniform float u_radius;
uniform float u_strength;
uniform vec2 u_pointer;
out vec4 o_color;

float roundRectSdf(vec2 xy, vec2 size, float radius) {
  vec2 halfSize = size * .5;
  vec2 p = abs(xy - halfSize) - (halfSize - vec2(radius));
  return length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - radius;
}

void main() {
  vec2 pixel = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 local = pixel - u_rect.xy;
  float sdf = roundRectSdf(local, u_rect.zw, u_radius);
  // Match the rounded silhouette to the actual framebuffer's pixel
  // footprint; fixed-width alpha feather produced a ring on mixed DPI.
  float aa = max(fwidth(sdf) * .7, .75);
  if (sdf > aa) discard;
  float coverage = 1.0 - smoothstep(-aa, aa, sdf);
  float edgeDistance = max(-sdf, 0.0);

  // One continuous low-amplitude lens curve. The bend begins at zero
  // on the glass silhouette and disappears naturally toward the center.
  float band = (1.0 - exp(-edgeDistance / 4.5))
    * exp(-edgeDistance / 17.0);
  vec2 center = u_rect.zw * .5;
  vec2 normal = normalize((local - center) / max(center, vec2(1.0)) + vec2(.00001));
  vec2 tangent = vec2(-normal.y, normal.x);

  // Stable pointer parallax replaces perpetual sinusoidal water ripples.
  vec2 pointerDelta = (pixel - u_pointer) / vec2(160.0);
  float influence = exp(-dot(pointerDelta, pointerDelta) * 1.2);
  float parallax = clamp(dot(pointerDelta, tangent), -1.0, 1.0) * influence;
  vec2 bend = normal * (3.0 + 1.0 * u_strength) * band
    + tangent * parallax * .35 * band;

  // The configured wallpaper atlas supplies one pixel sample. Frosting is
  // handled by the CSS glass shell, not a second 4-34px GPU blur transition.
  vec2 samplePoint = pixel - bend;
  vec2 uv = clamp(samplePoint / u_resolution, vec2(0.0), vec2(1.0));
  vec3 color = texture(u_image, vec2(uv.x, 1.0 - uv.y)).rgb;

  float edgeLight = exp(-edgeDistance / 14.0) * coverage;
  float highlight = edgeLight
    * max(0.0, dot(normal, normalize(vec2(-.85, -.55))));
  float deepEdge = edgeLight
    * max(0.0, dot(normal, normalize(vec2(.55, .85))));
  color += vec3(.008) * highlight * u_strength;
  color -= vec3(.004) * deepEdge;
  o_color = vec4(clamp(color, 0.0, 1.0), .97 * coverage);
}`

export interface CanvasRefractionRenderer {
  render(widgets: readonly DesktopWidget[], pointer?: { x: number; y: number }): void
  dispose(): void
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('GPU shader allocation failed')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Shader compilation failed'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

export async function createCanvasRefractionRenderer(
  canvas: HTMLCanvasElement,
  wallpaperSnapshot: WallpaperSnapshot,
  signal?: AbortSignal,
): Promise<CanvasRefractionRenderer> {
  const atlas = await createWallpaperAtlas(wallpaperSnapshot, canvas.clientWidth, canvas.clientHeight, signal)
  if (signal?.aborted) {
    atlas.width = 0
    atlas.height = 0
    throw new Error('Outdated GPU initialization cancelled')
  }
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    premultipliedAlpha: false,
    powerPreference: 'low-power',
  })
  if (!gl) {
    atlas.width = 0
    atlas.height = 0
    throw new Error('WebGL2 is unavailable; original glass retained')
  }

  let vertex: WebGLShader | null = null
  let fragment: WebGLShader | null = null
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  let texture: WebGLTexture | null = null
  let alive = true
  try {
    vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX)
    fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    program = gl.createProgram()
    if (!program) throw new Error('GPU program allocation failed')
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'GPU program linking failed')
    }
    gl.useProgram(program)
    buffer = gl.createBuffer()
    if (!buffer) throw new Error('GPU buffer allocation failed')
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    texture = gl.createTexture()
    if (!texture) throw new Error('Wallpaper GPU texture allocation failed')
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

    if (Math.max(atlas.width, atlas.height) > MAX_TEXTURE_SIZE) throw new Error('Wallpaper atlas exceeds GPU budget')
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
    atlas.width = 0
    atlas.height = 0

    const resolution = gl.getUniformLocation(program, 'u_resolution')
    const widgetRect = gl.getUniformLocation(program, 'u_rect')
    const cornerRadius = gl.getUniformLocation(program, 'u_radius')
    const strength = gl.getUniformLocation(program, 'u_strength')
    const pointerUniform = gl.getUniformLocation(program, 'u_pointer')
    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0)

    const render = (widgets: readonly DesktopWidget[], pointer?: { x: number; y: number }): void => {
      if (!alive || gl.isContextLost()) return
      const scale = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_SCALE)
      const width = Math.max(1, Math.round(canvas.clientWidth * scale))
      const height = Math.max(1, Math.round(canvas.clientHeight * scale))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      gl.viewport(0, 0, width, height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.SCISSOR_TEST)
      gl.uniform2f(resolution, width, height)
      gl.uniform2f(pointerUniform, (pointer?.x ?? -3000) * scale, (pointer?.y ?? -3000) * scale)
      for (const widget of widgets) {
        if (!SUPPORTED_TYPES.has(widget.appearance.preset)) continue
        const { x, y, width: w, height: h } = widget.frame
        if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue
        const left = Math.max(0, Math.floor(x * scale))
        const top = Math.max(0, Math.floor(y * scale))
        const right = Math.min(width, Math.ceil((x + w) * scale))
        const bottom = Math.min(height, Math.ceil((y + h) * scale))
        if (left >= right || top >= bottom) continue
        gl.scissor(left, height - bottom, right - left, bottom - top)
        gl.uniform4f(widgetRect, x * scale, y * scale, w * scale, h * scale)
        gl.uniform1f(cornerRadius, Math.min(widget.appearance.borderRadius, w / 2, h / 2) * scale)
        gl.uniform1f(strength, widget.appearance.preset === 'clear' ? 1.15 : .75)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      gl.disable(gl.SCISSOR_TEST)
    }
    const dispose = (): void => {
      if (!alive) return
      alive = false
      // WebGL resources are already invalid after context loss. Do not issue
      // deletes or reset canvas dimensions until Chromium restores the device.
      if (gl.isContextLost()) return
      if (texture) gl.deleteTexture(texture)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
      if (vertex) gl.deleteShader(vertex)
      if (fragment) gl.deleteShader(fragment)
      canvas.width = 0
      canvas.height = 0
    }
    return { render, dispose }
  } catch (error) {
    atlas.width = 0
    atlas.height = 0
    if (!gl.isContextLost()) {
      if (texture) gl.deleteTexture(texture)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
      if (vertex) gl.deleteShader(vertex)
      if (fragment) gl.deleteShader(fragment)
    }
    throw error
  }
}
