// `?errors`: the console's errors and warnings written on the page, for a phone, which has no console to read; the first
// dozen, and of a long one its start and the lines that say what went wrong, not the shader's source. Above them, the
// GPU's limits a shader can run into. Fetched only when asked for (boot.ts), and first, so that it hears the game's start.

const box = document.createElement('pre')
box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:60%;overflow:auto;margin:0;padding:8px;font:11px/1.3 monospace;color:#ffb0a0;background:#000c;white-space:pre-wrap;z-index:9;display:none'

function reveal() {
  box.style.display = 'block'
  if (!box.isConnected) document.body.append(box)
}

let shown = 0
function show(kind: string, args: unknown[]) {
  if (shown++ >= 12) return
  let text = args.map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  if (text.length > 600) {
    // three marks the line a shader fails on with '>', after the stage's name.
    const telling = text.split('\n').filter((line) => /material|info log|error|warning|limit|exceed|too many|reason|message|^\s*>|^(VERTEX|FRAGMENT)$/i.test(line) && line.length < 400)
    text = text.slice(0, 300) + '\n  ...\n' + telling.slice(0, 25).join('\n')
  }
  box.textContent += kind + ': ' + text + '\n\n'
  reveal()
}

function limits() {
  const gl = document.createElement('canvas').getContext('webgl2')
  let line = ''
  if (gl) {
    const names = ['MAX_VERTEX_UNIFORM_VECTORS', 'MAX_FRAGMENT_UNIFORM_VECTORS', 'MAX_VARYING_VECTORS', 'MAX_TEXTURE_IMAGE_UNITS', 'MAX_VERTEX_TEXTURE_IMAGE_UNITS', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS', 'MAX_TEXTURE_SIZE', 'MAX_UNIFORM_BLOCK_SIZE', 'MAX_SAMPLES'] as const
    line += 'webgl2: ' + names.map((n) => n.replace('MAX_', '').toLowerCase() + ' ' + gl.getParameter(gl[n])).join(', ') + '\n'
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    if (info) line += 'gpu: ' + gl.getParameter(info.UNMASKED_RENDERER_WEBGL) + '\n'
    line += 'float render: ' + !!gl.getExtension('EXT_color_buffer_float') + '\n'
  }
  box.textContent = line + box.textContent
  const { gpu } = navigator as unknown as { gpu?: { requestAdapter(options: { featureLevel: string }): Promise<{ limits: Record<string, number>; features: Set<string> } | null> } }
  void gpu?.requestAdapter({ featureLevel: 'compatibility' }).then((a) => {
    if (!a) return
    const l = a.limits
    const names = ['maxSamplersPerShaderStage', 'maxSampledTexturesPerShaderStage', 'maxStorageBuffersPerShaderStage', 'maxStorageBuffersInVertexStage', 'maxStorageBuffersInFragmentStage', 'maxStorageTexturesPerShaderStage', 'maxUniformBuffersPerShaderStage', 'maxUniformBufferBindingSize', 'maxTextureDimension2D', 'maxInterStageShaderVariables', 'maxColorAttachments']
    box.textContent = 'webgpu (' + (a.features.has('core-features-and-limits') ? 'core' : 'compatibility') + '): ' + names.filter((n) => n in l).map((n) => n + ' ' + l[n]).join(', ') + '\n' + box.textContent
  })
}

limits()
reveal()

// A program the driver will not link, with no log to say why: its shaders' sizes, which tell one material from another,
// and whether each compiled.
const failed = new Set<WebGLProgram>()
const parameter = WebGL2RenderingContext.prototype.getProgramParameter
WebGL2RenderingContext.prototype.getProgramParameter = function (this: WebGL2RenderingContext, program: WebGLProgram, name: number) {
  const value: unknown = parameter.call(this, program, name)
  if (name === this.LINK_STATUS && value === false && !failed.has(program)) {
    failed.add(program)
    const shaders = (this.getAttachedShaders(program) ?? []).map((s) => {
      const type = this.getShaderParameter(s, this.SHADER_TYPE) === this.VERTEX_SHADER ? 'vertex' : 'fragment'
      const log = (this.getShaderInfoLog(s) ?? '').trim().slice(0, 200)
      return type + ' ' + (this.getShaderSource(s) ?? '').length + ' chars, compiled ' + this.getShaderParameter(s, this.COMPILE_STATUS) + (log ? ', log: ' + log : '')
    })
    box.textContent += 'link failed #' + failed.size + ': ' + shaders.join('; ') + '\n'
  }
  return value
}

for (const kind of ['error', 'warn'] as const) {
  const original = console[kind].bind(console)
  console[kind] = (...args: unknown[]) => {
    show(kind, args)
    original(...args)
  }
}
addEventListener('error', (e) => show('error', [e.error ?? e.message]))
addEventListener('unhandledrejection', (e) => show('rejection', [e.reason]))

export {}
