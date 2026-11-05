// The rats coming in: all at once at the opening's rush, and more for every gosling he finds.
import type { GoosePlay } from './gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Settings } from '../settings'
import type { Opening } from './opening'
import type { GpuSwarm } from '../swarm/gpuswarm'
import type { RemoteSwarm } from '../swarm/swarm-remote'
import { type Dark, sightEdge } from '../swarm/swarm'
import { url } from './address'

/** How long after a gosling's find his rats come, s. */
export const RATS_AFTER = 1.2
/** How loud a found gosling's rats rumble in, of the opening's. */
export const RUMBLE_GAIN = 0.5

/** The rats' arrival, on what the page has made. */
export function createRatsArrive({ goosePlay, settings, opening, swarm }: {
  goosePlay: GoosePlay<PlaySwarm>
  settings: Settings
  opening: Opening
  swarm: GpuSwarm | RemoteSwarm
}) {
  const arrive = {
    /** Whether the rats have rushed in yet. */
    rushed: false,
    /** How many goslings' rats have come; how long till the next gosling's do, s, or none due. */
    cameFor: 0,
    dueIn: -1,
    rushIn,
    /** The rats come for the goslings found so far, over the game's own. */
    forGoslings: () => (settings.rats > 0 ? arrive.cameFor * RATS_PER_GOSLING : 0),
    comeFrame: ratsComeFrame,
  }
  /**
   * How far past the edge of the view the rats are set down for the rush, m, at the nearest and the farthest: fewest
   * near it and more the further out, so they come in one by one at first, then thicker, never as a block.
   */
  const RUSH_FROM = [0.6, 18] as const
  /** How far either side of the way spared the rats of a rush do not come from, rad. */
  const RUSH_SPARED = Math.PI / 4
  /**
   * Rats `from` to `to` set down out of view, on every side of him, to rush in: few just past its edge, more and more
   * behind. Given `notFrom`, a way over the ground, none come from within RUSH_SPARED rad of it.
   */
  function rushIn(dark: Dark, from: number, to: number, notFrom?: number) {
    const [near, far] = RUSH_FROM
    const spared = notFrom === undefined ? 0 : RUSH_SPARED
    const start = (notFrom ?? 0) + spared
    for (let i = from; i < to; i++) {
      const way = start + Math.random() * (2 * Math.PI - 2 * spared)
      const ux = Math.cos(way)
      const uz = Math.sin(way)
      // More the further out: the nearest share s of the way out holds s² of them.
      const r = sightEdge(dark, ux, uz) + near + Math.sqrt(Math.random()) * (far - near)
      swarm.setDown(i, dark.x + ux * r, dark.z + uz * r)
    }
  }

  /**
   * More rats for every gosling he finds, RATS_PER_GOSLING of them (`?ratsPerGosling=N` for others): the little one's
   * peeps were heard in the dark. They come RATS_AFTER s after the find, once he has him back, rushing in from out of
   * view as the opening's do over a lower rumble, but never from the bottom of the screen. None while the game's rats
   * are at none, and none for a ghost's gosling.
   */
  const askedPerGosling = Number(url.get('ratsPerGosling'))
  const RATS_PER_GOSLING = url.has('ratsPerGosling') && askedPerGosling >= 0 ? Math.round(askedPerGosling) : 300
  /** Whether a found gosling's rats come this frame, `dt` s on: one gosling's at a time, RATS_AFTER s apart. */
  function ratsComeFrame(dt: number): boolean {
    const circle = goosePlay.circleHeard
    // Through the opening, or the play started again: none come for those with him.
    if (opening.running() || circle < arrive.cameFor) {
      arrive.cameFor = circle
      arrive.dueIn = -1
      return false
    }
    if (arrive.dueIn < 0 && circle > arrive.cameFor) arrive.dueIn = RATS_AFTER
    if (arrive.dueIn < 0 || (arrive.dueIn -= dt) > 0) return false
    arrive.cameFor++
    arrive.dueIn = -1
    return true
  }
  return arrive
}
