// `?bench=route` (pagebench.ts) plays the whole game through as a player would, opening to ending, and logs each
// second of it: where the frames are slow along the way, not only at the places the bench stands him. This is its
// player: what he makes for next and whether he holds the interact key there. No renderer and no DOM, so a whole
// run is played through in Node (routebench.test.ts).
import type { GoosePlay, Zone } from '../game/gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Point } from '../world/plain'

/** What the player does this frame: where he walks to, none standing; the interact key held, or pressed afresh. */
export interface RouteStep {
  to: Point | null
  interact: 'hold' | 'tap' | null
  /** What he is making for, for the log. */
  aim: string
}

/**
 * The player's next step: the burning branch picked up first, then each gosling in the order the plain meets them,
 * worked out of his scene (the well's winch, the dead tree's call, the cage's key and then the cage) or walked up to,
 * then out to the island, where the ending starts. `inZone` is the play's own (gooseplay.ts), handed over.
 */
export function routeStep(play: GoosePlay<PlaySwarm>, island: Point, inZone: (zone: Zone, p: Point) => boolean): RouteStep {
  const at = play.holder
  const work = (zone: Zone, interact: 'hold' | 'tap', aim: string): RouteStep => (inZone(zone, at) ? { to: null, interact, aim } : { to: zone, interact: null, aim })
  const branch = play.branch
  if (branch && !branch.carried) return work(play.branchZoneOf(branch), 'tap', 'branch')
  const k = play.goslings.findIndex((g) => g?.state === 'waiting')
  if (k < 0) return { to: island, interact: null, aim: 'island' }
  const scene = play.scenes.find((s) => s.brazier === k)
  if (scene?.kind === 'cage' && !scene.open) return scene.carried ? work(play.zoneOf(scene), 'hold', `cage ${k}`) : work(play.keyZoneOf(scene), 'tap', `key ${k}`)
  if (scene && scene.kind !== 'cage') return work(play.zoneOf(scene), 'hold', `${scene.kind} ${k}`)
  return { to: play.goslings[k]!, interact: null, aim: `gosling ${k}` }
}
