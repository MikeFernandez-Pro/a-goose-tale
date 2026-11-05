// The plain's own pieces of the route, as the edit mode (gooseedit.ts) and the route's saved places move them.
import type { GoosePlay } from './gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { GooseScenes, EditPiece } from './goosescenes'
import type { Lights } from '../light/lights'
import type { Goslings } from '../characters/goslings'
import { keptShown } from '../world/plain'

/** The plain's pieces, on what the page has made. */
export function createPlainPieces(goosePlay: GoosePlay<PlaySwarm>, gooseScenes: GooseScenes, lights: Lights, goslings: Goslings, burningTreeLight: number) {
  /** The plain braziers, those with no scene, and their goslings while waiting, and the fire pit by each well, as edit pieces: moved only. */
  function plainPieces(): EditPiece[] {
    const play = goosePlay
    // The well's fire pit saved where it stands before the settings' offset, as the dead tree's brazier is.
    const wellPits = play.wellFires.flatMap(({ brazier, place }, w): EditPiece[] => {
      const object = gooseScenes.wellPits[w]
      if (!object) return []
      return [
        {
          name: `well fire ${brazier + 1}`,
          object,
          shown: keptShown(play.plain.braziers[brazier]!, 'fire'),
          move(dx, dz) {
            place.x += dx
            place.z += dz
          },
          save(braziers) {
            braziers[brazier]!.fire = { ...place }
          },
        },
      ]
    })
    return [...wellPits, ...plainBraziers(play)]
  }

  /** The plain braziers, those with no scene, and their goslings while waiting, as edit pieces. */
  function plainBraziers(play: GoosePlay<PlaySwarm>): EditPiece[] {
    return play.plain.braziers.flatMap((b, k): EditPiece[] => {
      if (b.scene || b.follows !== undefined) return []
      const light = play.layout.lights[k]!
      const stand = (k === burningTreeLight ? gooseScenes.pit : undefined) ?? lights.object.children[k]
      const g = play.goslings[k]
      const bird = goslings.object.children[k]
      const pieces: EditPiece[] = []
      if (stand) {
        pieces.push({
          name: `brazier ${k + 1}`,
          object: stand,
          shown: keptShown(b, 'fire'),
          move(dx, dz) {
            light.x += dx
            light.z += dz
          },
          save(braziers) {
            braziers[k]!.x = light.x
            braziers[k]!.z = light.z
          },
        })
      }
      if (bird && g?.state === 'waiting') {
        pieces.push({
          name: `gosling ${k + 1}`,
          object: bird,
          shown: keptShown(b, 'gosling'),
          move(dx, dz) {
            g.x += dx
            g.z += dz
            play.waitsAt[k]!.x += dx
            play.waitsAt[k]!.z += dz
          },
          // Where he waits, not where a searching gosling has paced to.
          save(braziers) {
            braziers[k]!.gosling = { ...play.waitsAt[k]! }
          },
        })
      }
      return pieces
    })
  }
  return plainPieces
}
