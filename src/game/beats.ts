// The game's clock and the stop motion's beats: time posterized, each beat a photograph of its own.
import type { Look } from '../settings'

/**
 * mulberry32 on the beat and a channel: the same draw for the same beat, so a
 * beat is the same photograph every time it comes round; -1 to 1.
 */
function beatDraw(beat: number, channel: number): number {
  let a = (beat * 1013 + channel * 7919 + 0x9e3779b9) >>> 0
  a = (a + 0x6d2b79f5) >>> 0
  let t = a
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
}

/**
 * The flame's draws, by channel: on the beat, the beat's own, past the
 * channels the look's variations take; smooth, two waves on the clock at a
 * pace of the channel's own, so it wavers rather than jumps.
 */
const FLAME_CHANNELS = 100

/** The clock and the beats as `stop`, the look's stop motion, has them. */
export function createBeats(stop: Look['stopMotion']) {
  const beats = {
    /** Game time, s: what the run plays by, before the stop motion holds it. */
    clock: 0,
    /** The stop motion's current beat, -1 with it off; when it began; and when the next begins. */
    beat: -1,
    beatAt: 0,
    nextBeatAt: 0,
    /** How long a beat lasts, s: a frame at the rate, or half as long again for a `longer` one when the beats are uneven. */
    length: (longer: boolean) => (longer ? 1.5 : 1) / stop.fps,
    /** A between-beats variation, by `channel`: this beat's draw, or 0 with the stop motion off. */
    vary: (channel: number) => (beats.beat < 0 ? 0 : beatDraw(beats.beat, channel)),
    flameDraw: (channel: number) => {
      if (beats.beat >= 0) return beatDraw(beats.beat, FLAME_CHANNELS + channel)
      const rate = 4 + ((channel * 1.37) % 5)
      return Math.sin(beats.clock * rate + channel * 1.7) * 0.6 + Math.sin(beats.clock * rate * 2.3 + channel) * 0.4
    },
    /**
     * The beats as the clock now has them: true on a new one, with `lookChanged` called when the look is to be set again.
     *
     * The run plays the clock as of the last beat, and the rats' places are read only when a beat begins and held until
     * the next; the light, the fog and the camera move every frame. A beat lasts a frame at the rate, or half as long
     * again when uneven; and on each new beat, with any variation asked for, the look is set again with that beat's draw,
     * so each beat is a photograph of its own.
     */
    frame(lookChanged: () => void): boolean {
      let newBeat = false
      if (!stop.enabled) {
        if (beats.beat !== -1) {
          beats.beat = -1
          lookChanged()
        }
        beats.beatAt = beats.nextBeatAt = beats.clock
      } else {
        while (beats.clock >= beats.nextBeatAt) {
          beats.beat++
          beats.beatAt = beats.nextBeatAt
          const longer = stop.uneven && beatDraw(beats.beat, 13) < stop.unevenShare * 2 - 1
          beats.nextBeatAt = beats.beatAt + beats.length(longer)
          newBeat = true
        }
      }
      // The first beat after the stop motion comes on sets the look again too, for what belongs to it.
      if (newBeat && (beats.beat === 0 || stop.shadeWobble || stop.lightFlicker || stop.strokeJitter || stop.frameJitter || stop.boil)) lookChanged()
      return newBeat
    },
  }
  return beats
}
