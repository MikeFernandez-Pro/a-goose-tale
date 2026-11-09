// A texture set's normal map, laid on a material's texture nodes, as the cart's
// wood (cartwood.ts), the dead trees' bark (deadtrees.ts) and the graves' stone
// (graves.ts) lay theirs, loaded once the set is asked for. The sets show their
// relief alone, over the material's plain colour: their colour maps are gone.
import { DataTexture, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three/webgpu'

/** What stands in for `none`'s maps: no colour of its own, no relief. */
function pixel(r: number, g: number, b: number): Texture {
  const map = new DataTexture(new Uint8Array([r, g, b, 255]), 1, 1)
  map.colorSpace = NoColorSpace
  map.needsUpdate = true
  return map
}
export const NO_COLOUR = pixel(255, 255, 255)
export const NO_NORMALS = pixel(128, 128, 255)

/** Each map, loaded once asked for, kept after, tiled. */
const maps = new Map<string, Promise<Texture>>()
export function loadMap(url: string, colour: boolean): Promise<Texture> {
  let map = maps.get(url)
  if (!map) {
    map = new TextureLoader().loadAsync(url).then((loaded) => {
      loaded.wrapS = loaded.wrapT = RepeatWrapping
      loaded.minFilter = LinearMipmapLinearFilter
      loaded.anisotropy = 8
      loaded.colorSpace = colour ? SRGBColorSpace : NoColorSpace
      return loaded
    })
    maps.set(url, map)
  }
  return map
}

/** The nodes a set is laid on: its map's texture nodes, and the uniform its relief is laid by. */
export interface SetNodes {
  normals: readonly { value: Texture }[]
  /** 1 with a set laid, 0 with none. */
  textured: { value: number }
}

/**
 * What lays the set `folder`/`name`/ on `nodes`, `none` no set: its normal map once loaded, under the plain colour.
 * A newer ask while one loads wins.
 */
export function setLayer<N extends string>(folder: string, nodes: SetNodes, load: typeof loadMap = loadMap): (name: N) => void {
  let asked: N | undefined
  return (name) => {
    if (name === asked) return
    asked = name
    if (name === 'none') {
      for (const node of nodes.normals) node.value = NO_NORMALS
      nodes.textured.value = 0
      return
    }
    void load(`${folder}/${name}/normal.webp`, false).then((map) => {
      if (asked !== name) return
      for (const node of nodes.normals) node.value = map
      nodes.textured.value = 1
    })
  }
}
