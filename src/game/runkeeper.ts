// The run kept as it goes, and taken up again.
import type { GoosePlay } from './gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Opening } from './opening'
import type { Ending } from './ending'
import { filming, benchOn, phone, url } from './address'
import { keptRun, keepRun } from './keptrun'

/** The keeper of the run, on what the page has made. */
export function createRunKeeper({ goosePlay, opening, ending, heard, arrive }: {
  goosePlay: GoosePlay<PlaySwarm>
  opening: Opening
  ending: Ending
  heard: { takenHeard: number[] }
  arrive: { rushed: boolean; cameFor: number; dueIn: number }
}) {
  // On a phone the page can go at any moment, dropped behind another app or a locked screen, and come back from nothing.
  // So the run is kept (keptrun.ts) and taken up where he last filled his torch, past the opening. `?keep` tries it elsewhere.
  /** How often the run is kept, s of the page: a phone may drop it with no warning. */
  const KEEP_EVERY = 2
  const keeping = !filming && !benchOn && (phone || url.has('keep'))
  let runToTakeUp = keeping ? keptRun() : undefined
  let keepIn = KEEP_EVERY
  /** The run kept now, unless he is yet to have a run worth keeping, or it is over. */
  function keepTheRun() {
    if (!keeping || !goosePlay.armed || opening.running() || ending.running() || goosePlay.down) return
    keepRun(goosePlay.saved())
  }
  if (keeping) {
    document.addEventListener('visibilitychange', () => document.hidden && keepTheRun())
    addEventListener('pagehide', keepTheRun)
  }
  /** A frame of the page past its loading: the kept run taken up on the first, as if the opening were skipped; and kept again as it goes. */
  function keptRunFrame(frame: number) {
    if (!keeping) return
    if (runToTakeUp) {
      opening.skip()
      arrive.rushed = true
      goosePlay.restore(runToTakeUp)
      arrive.cameFor = goosePlay.circleHeard
      arrive.dueIn = -1
      // What was done before, not heard again.
      goosePlay.scenes.forEach((scene, s) => {
        if (scene.kind === 'cage') heard.takenHeard[s] = scene.takenAt
      })
      runToTakeUp = undefined
    }
    if ((keepIn -= frame) > 0) return
    keepIn = KEEP_EVERY
    keepTheRun()
  }
  return keptRunFrame
}
