import { describe, expect, it } from 'vitest'
import { MAX_PIXELS, Quality, ladder, maxPixelRatio, startingStep } from './quality'

/** Feed `q` frames `ms` apart for `duration` ms from `at`; returns the time after the last frame and the levels it moved to. */
function run(q: Quality, ms: number, duration: number, at = 0): { at: number; levels: number[] } {
  const levels: number[] = []
  for (let t = at + ms; t <= at + duration; t += ms) {
    if (q.frame(ms, t)) levels.push(q.level)
  }
  return { at: at + duration, levels }
}

/** Frames that alternate one vsync and two, as a 60 Hz screen shows a frame rate between 30 and 60. */
function runUneven(q: Quality, duration: number, at = 0): { at: number; levels: number[] } {
  const levels: number[] = []
  let t = at
  for (let i = 0; t < at + duration; i++) {
    const ms = i % 2 === 0 ? 16.7 : 33.3
    t += ms
    if (q.frame(ms, t)) levels.push(q.level)
  }
  return { at: t, levels }
}

describe('ladder', () => {
  it('steps down depth of field, then AO, then the pixel ratio, then the moon to a baked one, then the island tree to a bush', () => {
    expect(ladder(2)).toEqual([
      { dof: true, ao: true, dpr: 2, moon: true, islandBush: false },
      { dof: false, ao: true, dpr: 2, moon: true, islandBush: false },
      { dof: false, ao: false, dpr: 2, moon: true, islandBush: false },
      { dof: false, ao: false, dpr: 1.5, moon: true, islandBush: false },
      { dof: false, ao: false, dpr: 1, moon: true, islandBush: false },
      { dof: false, ao: false, dpr: 1, moon: false, islandBush: false },
      { dof: false, ao: false, dpr: 1, moon: false, islandBush: true },
    ])
  })

  it('leaves out the pixel ratios a screen does not go above', () => {
    expect(ladder(1).map((s) => s.dpr)).toEqual([1, 1, 1, 1, 1])
    expect(ladder(1.5).map((s) => s.dpr)).toEqual([1.5, 1.5, 1.5, 1, 1, 1])
  })

  it('starts a phone without depth of field or AO, and anything else with the whole look', () => {
    const steps = ladder(2)
    expect(steps[startingStep(steps, true)]).toEqual({ dof: false, ao: false, dpr: 2, moon: true, islandBush: false })
    expect(startingStep(steps, false)).toBe(0)
  })
})

describe('maxPixelRatio', () => {
  it("draws at the screen's own ratio, at most 2, up to a 4K frame", () => {
    expect(maxPixelRatio(1, 1920, 1080)).toBe(1)
    expect(maxPixelRatio(1.5, 2560, 1440)).toBe(1.5)
    expect(maxPixelRatio(3, 1280, 720)).toBe(2)
  })

  it('draws a bigger screen lower, at a 4K frame', () => {
    const dpr = maxPixelRatio(2, 2560, 1440)
    expect(2560 * dpr * 1440 * dpr).toBeCloseTo(MAX_PIXELS)
    expect(dpr).toBeCloseTo(1.5)
    expect(maxPixelRatio(1, 5120, 2160)).toBeLessThan(1)
  })
})

describe('Quality', () => {
  it('holds the whole look while frames keep up', () => {
    const q = new Quality(ladder(2), 0)
    expect(run(q, 16.7, 20000).levels).toEqual([])
  })

  it('steps down one step at a time while frames come too slowly', () => {
    const q = new Quality(ladder(2), 0)
    const { levels } = run(q, 25, 6000)
    expect(levels.length).toBeGreaterThanOrEqual(2)
    expect(levels).toEqual(levels.map((_, i) => i + 1))
  })

  it('steps down from a frame rate between 30 and 60, which a 60 Hz screen shows unevenly', () => {
    const q = new Quality(ladder(2), 0)
    expect(runUneven(q, 3000).levels).toEqual([1])
  })

  it('goes to the foot at once from a few frames a second', () => {
    const steps = ladder(2)
    const q = new Quality(steps, 0)
    expect(run(q, 333, 6000).levels).toEqual([steps.length - 1])
  })

  it('says a device is far behind at the foot only once a window there is judged', () => {
    const steps = ladder(2)
    const q = new Quality(steps, 0)
    let t = 0
    while (!q.frame(333, (t += 333)));
    expect(q.level).toBe(steps.length - 1)
    expect(q.farBehind).toBe(false)
    for (const end = t + 4000; t < end; ) q.frame(333, (t += 333))
    expect(q.farBehind).toBe(true)
    for (const end = t + 4000; t < end; ) q.frame(16.7, (t += 16.7))
    expect(q.farBehind).toBe(false)
  })

  it('held, as in the opening, moves only for a device far behind', () => {
    const steps = ladder(2)
    const slow = new Quality(steps, 0)
    let levels: number[] = []
    for (let t = 25; t <= 6000; t += 25) if (slow.frame(25, t, true)) levels.push(slow.level)
    expect(levels).toEqual([])
    const far = new Quality(steps, 0)
    levels = []
    for (let t = 333; t <= 6000; t += 333) if (far.frame(333, t, true)) levels.push(far.level)
    expect(levels).toEqual([steps.length - 1])
  })

  it('ignores one hitch among smooth frames', () => {
    const q = new Quality(ladder(2), 0)
    let { at } = run(q, 16.7, 2000)
    expect(q.frame(200, (at += 200))).toBe(false)
    expect(run(q, 16.7, 3000, at).levels).toEqual([])
  })

  it('ignores a gap like a tab put away', () => {
    const q = new Quality(ladder(2), 0)
    const { at } = run(q, 16.7, 1000)
    expect(q.frame(5000, at + 5000)).toBe(false)
    expect(run(q, 16.7, 3000, at + 5000).levels).toEqual([])
  })

  it('stays at the bottom however slow the frames', () => {
    const steps = ladder(2)
    const q = new Quality(steps, steps.length - 1)
    expect(run(q, 50, 10000).levels).toEqual([])
    expect(q.level).toBe(steps.length - 1)
  })

  it('tries a step up after a while of smooth frames, and keeps it while frames keep up', () => {
    const q = new Quality(ladder(2), 2)
    expect(run(q, 16.7, 8000).levels).toEqual([1])
  })

  it('goes back down from a step up that is too slow, and gives that step up after two tries', () => {
    const q = new Quality(ladder(2), 2)
    let at = 0
    const levels: number[] = []
    // Smooth at step 2, slow at step 1: every try up fails.
    for (let i = 0; i < 4000; i++) {
      const ms = q.level <= 1 ? 25 : 16.7
      at += ms
      if (q.frame(ms, at)) levels.push(q.level)
    }
    expect(levels).toEqual([1, 2, 1, 2])
    expect(q.level).toBe(2)
  })

  it('counts a step up that slows a few seconds in as a failed try, and gives it up after two', () => {
    const q = new Quality(ladder(2), 2)
    let at = 0
    let upAt = 0
    const levels: number[] = []
    // At step 1 the frames keep up for 3 s, then come too slowly: as a crowd gathering round him.
    for (let i = 0; i < 20000; i++) {
      const ms = q.level <= 1 && at - upAt > 3000 ? 25 : 16.7
      at += ms
      if (q.frame(ms, at)) {
        levels.push(q.level)
        if (q.level === 1) upAt = at
      }
    }
    expect(levels).toEqual([1, 2, 1, 2])
    expect(q.level).toBe(2)
  })

  it('waits longer before trying a step up again after one has failed', () => {
    const q = new Quality(ladder(2), 2)
    let at = 0
    const ups: number[] = []
    for (let i = 0; i < 4000; i++) {
      const ms = q.level <= 1 ? 25 : 16.7
      at += ms
      if (q.frame(ms, at) && q.level === 1) ups.push(at)
    }
    expect(ups).toHaveLength(2)
    // The first try comes after the first wait; the second after a longer one, counted from the step back down.
    expect(ups[1] - ups[0]).toBeGreaterThan(ups[0] * 1.5)
  })
})
