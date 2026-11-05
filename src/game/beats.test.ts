import { describe, expect, it } from 'vitest'
import type { Look } from '../settings'
import { createBeats } from './beats'

const stopMotion = (over: Partial<Look['stopMotion']> = {}): Look['stopMotion'] => ({
  enabled: true,
  fps: 12,
  run: true,
  swarm: true,
  light: true,
  camera: false,
  shadeWobble: false,
  shadeAmount: 0,
  lightFlicker: false,
  lightAmount: 0,
  strokeJitter: false,
  strokeAmount: 0,
  frameJitter: false,
  frameAmount: 0,
  paperOnBeat: false,
  uneven: false,
  unevenShare: 0,
  stagger: false,
  boil: false,
  boilAmount: 0,
  boilScale: 1,
  snap: false,
  ...over,
})

describe('the beats', () => {
  it('holds no beat with the stop motion off, the beat following the clock', () => {
    const beats = createBeats(stopMotion({ enabled: false }))
    beats.clock = 1.5
    expect(beats.frame(() => {})).toBe(false)
    expect(beats.beat).toBe(-1)
    expect(beats.beatAt).toBe(1.5)
    expect(beats.vary(3)).toBe(0)
  })

  it('counts a beat for each step of the clock, however many a frame covers', () => {
    const beats = createBeats(stopMotion())
    expect(beats.frame(() => {})).toBe(true)
    expect(beats.beat).toBe(0)
    expect(beats.frame(() => {})).toBe(false)
    beats.clock = 3 / 12 + 0.001
    expect(beats.frame(() => {})).toBe(true)
    expect(beats.beat).toBe(3)
    expect(beats.beatAt).toBeCloseTo(3 / 12)
  })

  it('draws the same variation each time on one beat, and another on the next', () => {
    const beats = createBeats(stopMotion())
    beats.frame(() => {})
    const first = beats.vary(5)
    expect(beats.vary(5)).toBe(first)
    beats.clock = 1 / 12 + 0.001
    beats.frame(() => {})
    expect(beats.vary(5)).not.toBe(first)
  })

  it('sets the look again on the first beat, and on later ones only if a variation asks', () => {
    let plain = 0
    const still = createBeats(stopMotion())
    still.frame(() => plain++)
    still.clock = 1 / 12 + 0.001
    still.frame(() => plain++)
    expect(plain).toBe(1)

    let varied = 0
    const boiling = createBeats(stopMotion({ boil: true }))
    boiling.frame(() => varied++)
    boiling.clock = 1 / 12 + 0.001
    boiling.frame(() => varied++)
    expect(varied).toBe(2)
  })

  it('sets the look again as the stop motion goes off', () => {
    const stop = stopMotion()
    const beats = createBeats(stop)
    beats.frame(() => {})
    stop.enabled = false
    let set = 0
    beats.frame(() => set++)
    expect(set).toBe(1)
    expect(beats.beat).toBe(-1)
  })
})
