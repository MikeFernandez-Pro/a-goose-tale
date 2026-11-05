// The opening (openingscript.ts), as the page plays it: its clock, his walk up the road and the goslings', and how it is skipped.
import { OPENING, branchLanded, goslingAt, roadAheadOf, walkAt, walkOf } from './openingscript'
import { url } from './address'
import type { GoosePlay } from './gooseplay'
import type { PlaySwarm } from '../swarm/play'

/** How long the skip is held to skip, s. */
export const SKIP_HOLD = 0.8

/**
 * The opening: unless `?opening=0` or the page films; its own clock, s, on with the play's and held by
 * its pause; the skip held SKIP_HOLD s (the space bar or the bottom face button) skips to its end. Standing him at his
 * walk's start, so what is made after it reads him there.
 */
export function createOpening(goosePlay: GoosePlay<PlaySwarm>, burningTreeLight: number) {
  const on = !url.has('film') && url.get('opening') !== '0'
  /** The road he walks up in the opening, to where he starts. */
  const walkUp = on ? walkOf(goosePlay.plain.start, goosePlay.plain.road) : []
  /** The way on up the road from where he starts, the goslings bolting along it. */
  const roadAhead = on ? roadAheadOf(goosePlay.plain.start, goosePlay.plain.road) : { x: 0, z: -1 }
  const opening = {
    on,
    t: on ? 0 : OPENING.end,
    running: () => opening.t < OPENING.end,
    /** How long the skip has been held, s: let go, it drains twice as fast. */
    skipHolding: 0,
    /** Whether the opening has put the goslings where they wait, its last word on them: then the play has them. */
    settled: false,
    /** The opening over at once: he where his walk ends, the rest the play's from the next frame. */
    skip() {
      opening.t = OPENING.end
      opening.skipHolding = 0
      opening.walk()
    },
    /** He walks up the road as the opening has him, facing the way he walks. */
    walk() {
      if (walkUp.length === 0) return
      // The lights as the settings have them, as the play will once it starts: the spawn brazier's strength the panel's.
      goosePlay.place()
      // The burning branch no light till it lands, falling from the crown.
      goosePlay.landBranch(branchLanded(opening.t))
      const { at, facing } = walkAt(walkUp, opening.t)
      Object.assign(goosePlay.holder, at)
      Object.assign(goosePlay.facing, facing)
    },
    /** His goslings in the opening, walking round his back: not a ghost's, who follows it in the graveyard. */
    brood: () => goosePlay.goslings.flatMap((g, k) => (g && goosePlay.plain.braziers[k]!.follows === undefined ? [k] : [])),
    /**
     * The goslings as the opening has them: walking round his back, bolting up the plain, then where each waits; the
     * spawn's own, freezing, running only to his place at the light's edge. Over or skipped, each where he waits.
     */
    goslingsFrame() {
      const found = opening.brood()
      found.forEach((k, index) => Object.assign(goosePlay.goslings[k]!, goslingAt(opening.t, k, index, found.length, goosePlay.holder, goosePlay.facing, roadAhead, goosePlay.waitsAt[k]!, k === burningTreeLight)))
      opening.settled = !opening.running()
    },
    /** The skip held through `frame` s of the page, `skipping` if it is held now: skipped once held SKIP_HOLD s. */
    skipFrame(skipping: boolean, frame: number) {
      if (!opening.running()) return
      opening.skipHolding = skipping ? opening.skipHolding + frame : Math.max(0, opening.skipHolding - 2 * frame)
      if (opening.skipHolding >= SKIP_HOLD) opening.skip()
    },
  }
  opening.walk()
  return opening
}

/** The opening as the page has it. */
export type Opening = ReturnType<typeof createOpening>
