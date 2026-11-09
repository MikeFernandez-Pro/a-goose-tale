// A texture set: its relief alone, no colour map in the game to ask for.
import { describe, expect, it } from 'vitest'
import { DataTexture, type Texture } from 'three/webgpu'
import { NO_NORMALS, setLayer, type SetNodes } from './texturesets'

/** A layer on fresh nodes, its loader answering at once with a texture named by its url, and the urls asked for. */
function layer() {
  const fetched: string[] = []
  const load = (url: string) => {
    fetched.push(url)
    const map = new DataTexture(new Uint8Array(4), 1, 1)
    map.name = url
    return Promise.resolve<Texture>(map)
  }
  const nodes: SetNodes = { normals: [{ value: NO_NORMALS }], textured: { value: 0 } }
  return { lay: setLayer<'none' | 'bark_05'>('./textures/bark', nodes, load), nodes, fetched }
}
const settled = () => new Promise((done) => setTimeout(done))

describe('a texture set', () => {
  it('fetches its normal map alone, and lays its relief', async () => {
    const { lay, nodes, fetched } = layer()
    lay('bark_05')
    await settled()
    expect(fetched).toEqual(['./textures/bark/bark_05/normal.webp'])
    expect(nodes.normals[0]!.value.name).toBe('./textures/bark/bark_05/normal.webp')
    expect(nodes.textured.value).toBe(1)
  })

  it('fetches it once, however often it is laid', async () => {
    const { lay, fetched } = layer()
    lay('bark_05')
    lay('bark_05')
    await settled()
    expect(fetched).toHaveLength(1)
  })

  it('with none, fetches nothing and lays no relief', async () => {
    const { lay, nodes, fetched } = layer()
    lay('bark_05')
    await settled()
    lay('none')
    await settled()
    expect(fetched).toHaveLength(1)
    expect(nodes.normals[0]!.value).toBe(NO_NORMALS)
    expect(nodes.textured.value).toBe(0)
  })
})
