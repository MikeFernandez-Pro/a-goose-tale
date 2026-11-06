// The moon's shadows drawn once, `?moon=baked` and the quality's last step (quality.ts): its map over the whole level from a camera that never moves, of what
// stands still alone, the trees, the walls, the scenes' props and the ground; the goose, his goslings, the rats and the
// ghosts in none of it. The live moon draws a 32 m window round him again on most frames, the rats moving in it, 6 of a
// frame's 8.9 million triangles at the dead tree (RTX 5080, dpr 3, 2026-11-06); drawn once, only reading it is left.
// What moves in the map is held as it was drawn: the trees' sway, the well's winch, the cage's door.
import { Box3, Matrix4, Vector3, type DirectionalLight, type InstancedMesh, type Mesh, type Object3D, type RenderTarget, type Scene } from 'three/webgpu'

/** The layer the map's camera alone sees: on everything that stands still. The fires' shadows have 7. */
const LAYER = 8
/**
 * How fine the map is where the address does not say, m a texel, and the least it is blurred, texels. At 10 cm, unblurred
 * as the live map's softness came to there, 0.23 texels, each texel stood out as a block; blurred 1.5 or 3 it was soft;
 * at 6 cm blurred 1 it looked the nearest the live moon of the four tried (judged by eye, 2026-11-06). The level being 250 m
 * across the moon's way, MOST holds it a little coarser, 6.1 cm.
 */
const TEXEL = 0.06
const BLUR = 1
/** The most texels a side, whatever the level: what any device's WebGPU or WebGL 2 can hold. */
const MOST = 4096
/** How far past the level the map's camera stands, along the moon, m. */
const STAND_OFF = 20

/** The targets three's shadow node draws the moon's map into, which its typings leave out. */
export interface ShadowTargets {
  shadowMap: RenderTarget | null
  vsmShadowMapVertical: RenderTarget | null
}

export interface MoonBake {
  /** m a texel, for the softness to blur as far on the ground as the live map's does. */
  texel: number
  /** The least its blur, texels (nightlights.ts). */
  blur: number
  /** Whether the map is the baked one, its camera held over the level. */
  on: boolean
  /** Whether the map is still to be drawn: it is drawn on the next frame that asks, and never again while it is on. */
  due: boolean
  /**
   * A frame in play: true when the map is to be drawn in it, asked of the moon's shadow. On the frame after, the targets
   * only its drawing uses, the depth and the first of the variance's two blurs, are made a texel: read, the map is the
   * second blur alone, and at 4096 by 2600 the three held 156 MB (RTX 5080, 2026-11-06). three sizes each again before
   * it draws into it, live or baked anew.
   */
  frame(): boolean
  /** The map's camera aimed over the level and its map sized for it; everything still put on its layer. */
  aim(sunward: { x: number; y: number; z: number }): void
  /** The live map's camera and size again, as they were before the first `aim`: the page follows him with it again. */
  release(): void
}

/** The moon's map drawn once over `scene` of all but `moving` and what is under it. */
export function createMoonBake(sun: DirectionalLight, scene: Scene, moving: (Object3D | undefined)[], node: ShadowTargets, texel = TEXEL, blur = BLUR): MoonBake {
  const skip = new Set<Object3D>()
  const corner = new Vector3()
  const box = new Box3()
  const instance = new Matrix4()
  const camera = sun.shadow.camera
  let drawing = false
  const live = { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom, near: camera.near, far: camera.far, width: sun.shadow.mapSize.x, height: sun.shadow.mapSize.y, layers: camera.layers.mask }
  const bake: MoonBake = {
    texel,
    blur,
    on: false,
    due: false,
    aim(sunward) {
      bake.on = bake.due = true
      for (const root of moving) root?.traverse((o) => skip.add(o))
      // Everything still, as the moon's camera will see it: its world box, then its box in the camera's frame.
      const still: Mesh[] = []
      const world = new Box3()
      scene.traverse((o) => {
        const mesh = o as Mesh
        if (!mesh.isMesh || skip.has(o) || !(mesh.castShadow || mesh.receiveShadow)) return
        o.layers.enable(LAYER)
        still.push(mesh)
      })
      const eachCorner = (visit: (point: Vector3) => void) => {
        for (const mesh of still) {
          mesh.updateWorldMatrix(true, false)
          mesh.geometry.boundingBox ?? mesh.geometry.computeBoundingBox()
          const { min, max } = mesh.geometry.boundingBox!
          // A geometry with no positions of its own, laid by a shader, has no box to go by.
          if (![min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite)) continue
          const instanced = mesh as unknown as InstancedMesh
          const count = instanced.isInstancedMesh ? instanced.instanceMatrix.count : 1
          for (let i = 0; i < count; i++) {
            box.set(min, max)
            if (instanced.isInstancedMesh) {
              instanced.getMatrixAt(i, instance)
              box.applyMatrix4(instance)
            }
            box.applyMatrix4(mesh.matrixWorld)
            for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) visit(corner.set(x, y, z))
          }
        }
      }
      eachCorner((point) => world.expandByPoint(point))
      const centre = world.getCenter(new Vector3())
      const reach = world.getSize(new Vector3()).length() / 2 + STAND_OFF
      sun.target.position.copy(centre)
      sun.position.copy(centre).addScaledVector(new Vector3(sunward.x, sunward.y, sunward.z).normalize(), reach)
      sun.target.updateMatrixWorld()
      sun.updateMatrixWorld()
      camera.position.copy(sun.position)
      camera.lookAt(centre)
      camera.updateMatrixWorld()
      const seen = new Box3()
      eachCorner((point) => seen.expandByPoint(point.applyMatrix4(camera.matrixWorldInverse)))
      Object.assign(camera, { left: seen.min.x, right: seen.max.x, bottom: seen.min.y, top: seen.max.y, near: Math.max(0.1, -seen.max.z - 1), far: -seen.min.z + 1 })
      camera.updateProjectionMatrix()
      camera.layers.set(LAYER)
      const width = Math.min(MOST, Math.ceil((seen.max.x - seen.min.x) / texel))
      const height = Math.min(MOST, Math.ceil((seen.max.y - seen.min.y) / texel))
      sun.shadow.mapSize.set(width, height)
      // Held to MOST, the map is coarser than asked: the softness follows the texel it has.
      bake.texel = Math.max((seen.max.x - seen.min.x) / width, (seen.max.y - seen.min.y) / height)
    },
    frame() {
      if (drawing && !sun.shadow.needsUpdate) {
        drawing = false
        for (const target of [node.shadowMap, node.vsmShadowMapVertical]) target?.setSize(1, 1, target.depth)
      }
      if (!bake.due) return false
      bake.due = false
      drawing = true
      sun.shadow.needsUpdate = true
      return true
    },
    release() {
      bake.on = bake.due = false
      Object.assign(camera, { left: live.left, right: live.right, top: live.top, bottom: live.bottom, near: live.near, far: live.far })
      camera.updateProjectionMatrix()
      camera.layers.mask = live.layers
      sun.shadow.mapSize.set(live.width, live.height)
    },
  }
  return bake
}
