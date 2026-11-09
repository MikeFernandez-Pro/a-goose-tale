// How much of the look a device draws: a ladder of steps, from the whole look
// down to a baked moon, and a governor that moves along it by how the frames
// come. Too many slow frames, and it steps down; a while of smooth ones, and
// it tries a step up. No renderer and no DOM, so it is tested in Node.
//
// A 60 Hz screen shows a frame every 16.7 ms however little the GPU needed,
// so room to spare cannot be read off the frames. The governor finds it by
// trying: it steps up, and if that step is too slow it comes back down and
// waits longer before trying again; failed twice, it never tries that step
// again. A phone that heats up only gets slower, so a step given up stays
// given up.
//
// Measured on an iPhone 15 Pro Max over WebGPU, 2,000 rats (2026-10-07): the
// whole look at a pixel ratio of 2 is 35 fps; without depth of field and AO,
// or at a pixel ratio of 1, it holds 60.

/** The most pixels a frame is drawn at: a 4K screen's. The frame costs by its pixels (the rats' overdraw), and past 4K the eye does not see them. */
export const MAX_PIXELS = 3840 * 2160

/**
 * The most the pixel ratio is drawn at on a screen `width` by `height` CSS
 * pixels whose own ratio is `deviceDpr`: the screen's, at most 2, and lower
 * where the frame would pass `MAX_PIXELS`. A 5K screen at 200 % draws at about
 * 1.5, and keeps its depth of field and AO, which the ladder would otherwise
 * give up first.
 */
export function maxPixelRatio(deviceDpr: number, width: number, height: number): number {
  return Math.min(deviceDpr, 2, Math.sqrt(MAX_PIXELS / (width * height)))
}

/** One step of the ladder: what is drawn; `moon`, whether the moon's map is drawn live round him or baked once (moonbake.ts). */
export interface Step {
  dof: boolean
  ao: boolean
  dpr: number
  moon: boolean
  /** The island's oak stood down to a bush: its leaf cards cost a Mi 9's ending 16 ms (2026-11-07). */
  islandBush: boolean
}

/**
 * The ladder for a screen whose pixel ratio is drawn at `maxDpr` at most:
 * depth of field off, then AO, then the pixel ratio down to 1.5 and 1, then
 * the moon baked, then the island's oak a bush. A pixel ratio the screen does not go above is no step.
 * The rats are never a step: a tenth of them saved nothing on the PC, the
 * iPhone or the Mi 9 (2026-11-02 to 11-06), and fewer would make the game
 * easier where it runs slower. The live moon's map is redrawn on most frames
 * with every caster in it, 6 of a frame's 8.9 million triangles at the dead
 * tree (RTX 5080, 2026-11-06), what a weak GPU feels most.
 */
export function ladder(maxDpr: number): Step[] {
  const steps: Step[] = [
    { dof: true, ao: true, dpr: maxDpr, moon: true, islandBush: false },
    { dof: false, ao: true, dpr: maxDpr, moon: true, islandBush: false },
    { dof: false, ao: false, dpr: maxDpr, moon: true, islandBush: false },
  ]
  for (const dpr of [1.5, 1]) if (dpr < maxDpr) steps.push({ dof: false, ao: false, dpr, moon: true, islandBush: false })
  const lowest = steps[steps.length - 1].dpr
  steps.push({ dof: false, ao: false, dpr: lowest, moon: false, islandBush: false }, { dof: false, ao: false, dpr: lowest, moon: false, islandBush: true })
  return steps
}

/** Where a device starts: a phone without depth of field or AO, the most it held 60 fps with; anything else with the whole look. */
export function startingStep(steps: Step[], phone: boolean): number {
  return phone ? steps.findIndex((s) => !s.dof && !s.ao) : 0
}

/** The frames are judged over this long, ms. */
const WINDOW = 1500
/** After a change of step, frames are not judged for this long, ms: the new pipeline compiles, and the first frames hitch. */
const SETTLE = 1000
/**
 * A frame longer than this is slow, ms: past one vsync at 60 Hz. A phone too, since 2026-11-06: 60 fps at a pixel
 * ratio of 1 before 30 at 1.5 (as asked); it held 36, past two, content with 30.
 */
const SLOW_FRAME = 20
/** More than this share of slow frames in a window, and the device is not keeping up. */
const SLOW_SHARE = 0.25
/**
 * Most frames in a window longer than this, ms, under 20 fps, and the device is far behind: no one step saves it, so it
 * goes to the ladder's foot at once, a pipeline rebuilt once rather than at each step, and climbs back from there. A
 * laptop drawing 3 fps took 15 s a step at a time (2026-11-09).
 */
const FAR_FRAME = 50
/**
 * A gap longer than this is no frame, ms: the tab put away, or the page paused. At 250 a laptop drawing 3 fps had
 * none of its frames judged, and kept the whole look (2026-11-09).
 */
const GAP = 1000
/** How long the frames must keep up before a step up is tried, ms; doubled each time a try fails. */
const UP_WAIT = 5000
/** Tries at a step before it is given up. */
const TRIES = 2
/**
 * A step up that falls back this soon after it is tried failed, ms, though its first frames kept up: on a Mi 9 at the
 * start, 1.5 held a few seconds each time as the rats gathered, then fell, and was tried again every 15 to 30 s for
 * minutes, a second's settle each time (2026-11-06).
 */
const FAIL_WITHIN = 10000

export class Quality {
  /** The step drawn now: an index into the ladder, 0 the whole look. */
  level: number
  /** No step above this is tried again: those were too slow. */
  private ceiling = 0
  private readonly failures: number[]
  private windowStart = -1
  private frames = 0
  private slow = 0
  private far = 0
  /** Until when frames are not judged, ms. */
  private settledAt: number
  /** How long the frames have kept up since the last change, ms. */
  private smooth = 0
  private upWait = UP_WAIT
  /** Stepped up and not yet judged at the new step: slow there, and the try failed. */
  private trying = false
  /** When the last step up was tried, ms; none since the last step down. */
  private triedAt = -Infinity

  constructor(
    readonly steps: Step[],
    start: number,
    private readonly slowFrame = SLOW_FRAME,
  ) {
    this.level = start
    this.failures = steps.map(() => 0)
    this.settledAt = SETTLE
  }

  get step(): Step {
    return this.steps[this.level]
  }

  /**
   * A frame `ms` long, ending at `now` ms: true when the step changes. `held`, as in the opening, the step moves only
   * for a device far behind.
   */
  frame(ms: number, now: number, held = false): boolean {
    if (ms > GAP || now < this.settledAt) {
      this.windowStart = -1
      return false
    }
    if (this.windowStart < 0) {
      this.windowStart = now - ms
      this.frames = this.slow = this.far = 0
    }
    this.frames++
    if (ms > this.slowFrame) this.slow++
    if (ms > FAR_FRAME) this.far++
    if (now - this.windowStart < WINDOW) return false

    const keepingUp = this.slow <= this.frames * SLOW_SHARE
    const farBehind = this.far > this.frames / 2
    const length = now - this.windowStart
    const foot = this.steps.length - 1
    this.windowStart = -1
    if (held) return farBehind && this.level < foot && this.change(foot, now)
    if (!keepingUp) {
      this.smooth = 0
      if (this.trying || now - this.triedAt < FAIL_WITHIN) {
        // The step up was too slow, at once or soon after: back down, wait longer, and after enough tries give it up.
        this.trying = false
        this.triedAt = -Infinity
        if (++this.failures[this.level] >= TRIES) this.ceiling = this.level + 1
        this.upWait *= 2
      }
      if (this.level === foot) return false
      return this.change(farBehind ? foot : this.level + 1, now)
    }
    if (this.trying) {
      this.trying = false
      this.upWait = UP_WAIT
    }
    this.smooth += length
    if (this.smooth < this.upWait || this.level <= this.ceiling) return false
    this.trying = true
    this.triedAt = now
    return this.change(this.level - 1, now)
  }

  private change(level: number, now: number): boolean {
    this.level = level
    this.smooth = 0
    this.settledAt = now + SETTLE
    return true
  }
}
