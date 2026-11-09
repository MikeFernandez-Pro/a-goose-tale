// The opening (openingscript.ts), as the page plays it: its clock, his walk up the road and the goslings', and how it is skipped.
import { OPENING, boltJump, boltWays, branchLanded, goslingAt, roadAheadOf, roundHisBack, walkAt, walkOf } from './openingscript'
import { url } from './address'
import { GOSLING_RADIUS, type GoosePlay } from './gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Point } from '../world/plain'

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
  /** The way each of his brood bolts, in the order they walk round his back: picked as they bolt, he standing still by then. */
  let ways: number[] | undefined
  /** The goslings bolted out of view, each now where he waits. */
  const gone = new Set<number>()
  const opening = {
    on,
    t: on ? 0 : OPENING.end,
    running: () => opening.t < OPENING.end,
    /** How long the skip has been held, s: let go, it drains twice as fast. */
    skipHolding: 0,
    /** Whether the opening has put the goslings where they wait, its last word on them: then the play has them. */
    settled: false,
    /**
     * The opening over at once: he where his walk ends, each gosling where he waits, the rest the play's from the next
     * frame. Its last word on the goslings said here, so a kept run taken up after it (runkeeper.ts) is not sent back too.
     */
    skip() {
      opening.t = OPENING.end
      opening.skipHolding = 0
      opening.walk()
      opening.goslingsFrame()
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
     * The goslings as the opening has them: walking round his back, bolting up the plain until `seen` loses him, then
     * where each waits; the spawn's own, freezing, running only to his place at the light's edge. Over or skipped, each
     * where he waits.
     */
    goslingsFrame(seen: (at: Point) => boolean = () => false) {
      const found = opening.brood()
      const { holder, facing } = goosePlay
      if (opening.t >= OPENING.bolt) {
        ways ??= boltWays(
          found.map((_, index) => roundHisBack(index, found.length, holder, facing)),
          roadAhead,
          (from, to) => goosePlay.clearWay(from, to, GOSLING_RADIUS),
        )
      }
      found.forEach((k, index) => {
        const g = goosePlay.goslings[k]!
        const freezes = k === burningTreeLight
        Object.assign(g, goslingAt(opening.t, index, found.length, holder, facing, roadAhead, ways?.[index] ?? 0, goosePlay.waitsAt[k]!, freezes, gone.has(k)))
        if (!freezes && opening.t > OPENING.bolt && !gone.has(k) && !seen(g)) {
          gone.add(k)
          Object.assign(g, goosePlay.waitsAt[k]!)
        }
      })
      opening.settled = !opening.running()
    },
    /** Gosling `k`'s jump into his run as he bolts, for the goslings' clips: his brood's, while the opening runs. */
    act: (k: number) => (opening.running() && opening.brood().includes(k) ? { act: boltJump(opening.t) } : undefined),
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
