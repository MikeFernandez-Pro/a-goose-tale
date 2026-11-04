// The loader for the game's models: they are packed with meshopt
// (EXT_meshopt_compression), their normals, uvs, colours and weights stored as
// normalised integers, so every GLTFLoader here needs the decoder.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { BufferAttribute, type BufferGeometry } from 'three/webgpu'

/** A GLTFLoader that reads the game's packed models. */
export function modelLoader(): GLTFLoader {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
}

/**
 * `geometry`'s normals as floats, as a geometry made in code has them: the same shader over another layout is another
 * pipeline, and a phone's first build of one is half a second.
 */
export function unpackNormals(geometry: BufferGeometry): void {
  const normal = geometry.getAttribute('normal')
  const floats = new Float32Array(normal.count * 3)
  for (let i = 0; i < normal.count; i++) floats.set([normal.getX(i), normal.getY(i), normal.getZ(i)], i * 3)
  geometry.setAttribute('normal', new BufferAttribute(floats, 3))
}
