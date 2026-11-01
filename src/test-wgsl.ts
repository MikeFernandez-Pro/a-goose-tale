// What the shader tests read: the WGSL three's WebGPU backend would generate,
// built against a stand-in for the renderer, so a pass's shader can be checked
// in Node with no device. Taken from three-vat's own test helpers, which the
// package does not ship.
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  HalfFloatType,
  MeshStandardMaterial,
  NearestFilter,
  NoToneMapping,
  PerspectiveCamera,
  RGBAFormat,
  RGFormat,
  SRGBColorSpace,
  Scene,
  Sphere,
  UnsignedByteType,
  Vector3,
  type Material,
  type Object3D,
} from 'three'
import { context } from 'three/tsl'
import { NodeFrame, StandardNodeLibrary, WGSLNodeBuilder } from 'three/webgpu'
import type { NodeMaterial, Renderer } from 'three/webgpu'
import { EndMode, INFINITE_REPETITIONS, LoopMode, type DeltaVAT, type VATClip } from 'three-vat'

/** The WGSL vertex shader for `object` drawn with `material`. */
export function vertexWGSL(object: Object3D, material: Material): string {
  return buildWGSL(object, material).vertexShader
}

/** The WGSL fragment shader for `object` drawn with `material`, built as {@link vertexWGSL} builds the vertex one. */
export function fragmentWGSL(object: Object3D, material: Material): string {
  return buildWGSL(object, material).fragmentShader
}

function buildWGSL(object: Object3D, material: Material): { vertexShader: string; fragmentShader: string } {
  // A classic material becomes its node counterpart, as the renderer's own library makes it.
  const library = new StandardNodeLibrary()
  const renderer = standInRenderer(library)
  // @types/three declares the builder's constructor and little else.
  const builder = new WGSLNodeBuilder(object, renderer as unknown as Renderer) as unknown as {
    material: NodeMaterial
    camera: PerspectiveCamera
    scene: Scene
    nodeFrame: NodeFrame
    build(): void
    vertexShader: string
    fragmentShader: string
  }
  builder.material = library.fromMaterial(material) as NodeMaterial
  builder.camera = new PerspectiveCamera()
  builder.scene = new Scene()
  builder.nodeFrame = new NodeFrame()
  builder.build()
  return builder
}

/** The WGSL for the compute pass `compute` (a `Fn(...)().compute(n)`), built against the same stand-in renderer. */
export function computeWGSL(compute: unknown): string {
  const renderer = standInRenderer(new StandardNodeLibrary())
  const builder = new WGSLNodeBuilder(null as unknown as Object3D, renderer as unknown as Renderer) as unknown as {
    compute: unknown
    nodeFrame: NodeFrame
    build(): void
    computeShader: string
  }
  builder.compute = compute
  builder.nodeFrame = new NodeFrame()
  builder.build()
  return builder.computeShader
}

/** The stand-in renderer's canvas, as a viewport texture keys its copy. */
const canvasTarget = { width: 1, height: 1 }

/** The fields of three's renderer a node build reads, and nothing that needs a device. */
function standInRenderer(library: StandardNodeLibrary) {
  return {
    backend: {
      isWebGPUBackend: true,
      compatibilityMode: false,
      hasFeature: () => false,
      utils: { getTextureSampleData: () => ({ samples: 1, primarySamples: 1, isMSAA: false }) },
      capabilities: { getUniformBufferLimit: () => 65536 },
      device: { limits: { maxUniformBufferBindingSize: 65536 } },
    },
    library,
    contextNode: context(),
    getRenderTarget: () => null,
    // What a viewport texture (the frame as drawn so far) keys its copy by, with no render target set.
    getCanvasTarget: () => canvasTarget,
    getMRT: () => null,
    getOutputRenderTarget: () => null,
    getColorBufferType: () => HalfFloatType,
    toneMapping: NoToneMapping,
    outputColorSpace: SRGBColorSpace,
    currentColorSpace: SRGBColorSpace,
    lighting: { getNode: () => null },
    shadowMap: {},
    xr: { isPresenting: false },
    debug: { diagnostics: { keywords: false } },
    hasFeature: () => false,
    getMaxAnisotropy: () => 1,
  }
}

/**
 * Every read, in the shader's `main`, of a TSL variable no path to it has
 * assigned, each as the variable and the line it is read on. WGSL zeroes
 * three's variables where it declares them, so such a read compiles and draws
 * as if the value were 0, with nothing on the console.
 *
 * Read off the text three writes, one statement or brace a line: an `if`
 * passes on what both its sides assign, an `if` without an `else` and a loop
 * pass on nothing.
 */
export function unassignedReads(wgsl: string): string[] {
  const lines = wgsl.slice(wgsl.indexOf('fn main(')).split('\n')
  const body = lines.findIndex((line) => line.trimEnd().endsWith('{'))
  // The function's own scope first; each `if`, `else` and loop opens one on a copy of the scope it is in.
  const scopes: { kind: 'main' | 'if' | 'else' | 'loop'; assigned: Set<string>; ifAssigned?: Set<string> }[] = [
    { kind: 'main', assigned: new Set() },
  ]
  const current = () => scopes[scopes.length - 1]!
  const found: string[] = []
  const read = (code: string, line: string) => {
    for (const name of code.match(/\bnodeVar\d+/g) ?? []) if (!current().assigned.has(name)) found.push(`${name}: ${line}`)
  }
  for (const raw of lines.slice(body + 1)) {
    const line = raw.trim()
    // A variable declared ahead of the flow, as three does for a compute pass with barriers, is no read.
    if (line === '' || line.startsWith('//') || /^var nodeVar\d+ : [^=]+;$/.test(line)) continue
    if (line === '}') {
      const closed = scopes.pop()!
      if (closed.kind === 'main') break
      if (closed.kind === 'else') {
        for (const name of closed.assigned) if (closed.ifAssigned!.has(name)) current().assigned.add(name)
      }
    } else if (line === '} else {') {
      const ifAssigned = scopes.pop()!.assigned
      scopes.push({ kind: 'else', assigned: new Set(current().assigned), ifAssigned })
    } else if (line.startsWith('if (') || line.startsWith('for (')) {
      read(line, line)
      scopes.push({ kind: line.startsWith('if') ? 'if' : 'loop', assigned: new Set(current().assigned) })
    } else {
      const target = /^(nodeVar\d+)\s*=(?!=)/.exec(line)
      read(target ? line.slice(target[0].length) : line, line)
      if (target) current().assigned.add(target[1]!)
    }
  }
  return found
}

const clip = (name: string, startFrame: number, frames: number, fps = 30): VATClip => ({
  name,
  startFrame,
  frames,
  fps,
  duration: frames / fps,
  maxDelta: 0.5,
  loopMode: LoopMode.Repeat,
  repetitions: INFINITE_REPETITIONS,
  endMode: EndMode.Clamp,
  speed: 1,
})

/** A texture as a bake makes it: read texel for texel. */
function exact(texture: DataTexture): DataTexture {
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

/**
 * A baked VAT standing in for a bake, for a shader built over the decode: six
 * vertices in two material groups, two clips, and each layer in the format the
 * baker writes, at one texel each.
 */
export function vatFixture(): DeltaVAT {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(18), 3))
  geometry.addGroup(0, 3, 0)
  geometry.addGroup(3, 3, 1)
  const bounds = new Box3(new Vector3(-2, 0, -2), new Vector3(2, 3, 2))
  geometry.boundingBox = bounds.clone()
  geometry.boundingSphere = bounds.getBoundingSphere(new Sphere())
  const frameBounds = new Float32Array(18 * 6)
  for (let f = 0; f < 18; f++) frameBounds.set([-2 + f * 0.2, 0, -2, -1.4 + f * 0.2, 3, 2], f * 6)
  const normals = new DataTexture(new Uint8Array(2), 1, 1, RGFormat, UnsignedByteType)
  normals.unpackAlignment = 1
  return {
    positionTexture: exact(new DataTexture(new Uint16Array(4), 1, 1, RGBAFormat, HalfFloatType)),
    normalTexture: exact(normals),
    clips: [clip('walk', 0, 10), clip('run', 10, 8, 24)],
    bounds,
    frameBounds,
    vertexCount: 6,
    totalFrames: 18,
    rowsPerFrame: 1,
    encoding: 'delta',
    fallback: null,
    geometry,
    materials: [new MeshStandardMaterial({ name: 'body' }), new MeshStandardMaterial({ name: 'visor' })],
  }
}
