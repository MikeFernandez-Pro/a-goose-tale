import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3, WebGPUCoordinateSystem } from 'three/webgpu'
import { reachSeen } from './fakelamps'

/** The game's camera as the WebGPU renderer has it: at the origin, looking down -z. */
function camera() {
  const view = new PerspectiveCamera(60, 1, 0.1, 100)
  view.coordinateSystem = WebGPUCoordinateSystem
  view.updateProjectionMatrix()
  return view
}

describe('reachSeen', () => {
  it('keeps a lamp whose reach is in view, and one whose reach only crosses the view', () => {
    const seen = reachSeen(camera())
    expect(seen(new Vector3(0, 0, -10), 1)).toBe(true)
    expect(seen(new Vector3(20, 0, -10), 15)).toBe(true)
  })

  it('leaves out a lamp whose reach is wholly behind, beside or past the far end of the view', () => {
    const seen = reachSeen(camera())
    expect(seen(new Vector3(0, 0, 10), 2)).toBe(false)
    expect(seen(new Vector3(20, 0, -10), 1)).toBe(false)
    expect(seen(new Vector3(0, 0, -110), 5)).toBe(false)
  })

  it('keeps a lamp with no end to its reach wherever it stands', () => {
    expect(reachSeen(camera())(new Vector3(0, 0, 50), 0)).toBe(true)
  })

  it('reads the camera as it stands now, moved since', () => {
    const view = camera()
    view.position.set(0, 0, 20)
    expect(reachSeen(view)(new Vector3(0, 0, 10), 2)).toBe(true)
  })
})
