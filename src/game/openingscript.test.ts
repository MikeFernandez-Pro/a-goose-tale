import { describe, expect, it } from 'vitest'
import { CHAT, OPENING, WALK_PACE, roadAheadOf, roundHisBack, boltWays, boltJump, afterglow, skyDarkened, branchAt, branchFlare, branchLanded, cowering, flameGrown, goslingAt, litShare, ratsOut, rumbleAt, shakeAt, startled, walkAt, walkOf } from './openingscript'

const AT = { x: 0, z: 0 }
const UP = { x: 0, z: -1 }
const HOME = { x: 3, z: -20 }

describe('the opening', () => {
  it('walks him up the road to where he starts, from as far back as he walks', () => {
    const start = { x: 2, z: 50 }
    const road = [
      { x: 8, z: 66 },
      { x: 3, z: 59 },
      { x: 1, z: 52 },
      { x: -2, z: 45 },
    ]
    const walk = walkOf(start, road)
    expect(walk[walk.length - 1]).toEqual(start)
    let length = 0
    for (let k = 1; k < walk.length; k++) length += Math.hypot(walk[k]!.x - walk[k - 1]!.x, walk[k]!.z - walk[k - 1]!.z)
    expect(length).toBeCloseTo(WALK_PACE * OPENING.strike)
    expect(walk[0]!.z).toBeGreaterThan(start.z)
    expect(walkAt(walk, OPENING.strike).at.x).toBeCloseTo(start.x)
    expect(walkAt(walk, OPENING.strike).at.z).toBeCloseTo(start.z)
    expect(walkAt(walk, OPENING.strike + 1).at).toEqual(walkAt(walk, OPENING.strike).at)
    expect(walkAt(walk, 1).facing.z).toBeLessThan(0)
  })

  it('turns him round a bend of the road over a stretch of it, never at once', () => {
    const walk = walkOf({ x: 0, z: 0 }, [
      { x: 0, z: 20 },
      { x: 0, z: 3 },
      { x: 2, z: -3 },
    ])
    const yaw = (t: number) => Math.atan2(walkAt(walk, t).facing.x, -walkAt(walk, t).facing.z)
    for (let t = 0.05; t <= OPENING.strike; t += 0.05) expect(Math.abs(yaw(t) - yaw(t - 0.05))).toBeLessThan(0.05)
  })

  it('bolts the goslings on up the road', () => {
    const road = [
      { x: 0, z: 5 },
      { x: 0, z: 0 },
      { x: 10, z: -10 },
    ]
    const ahead = roadAheadOf({ x: 0, z: 0 }, road)
    expect(ahead.x).toBeCloseTo(Math.SQRT1_2)
    expect(ahead.z).toBeCloseTo(-Math.SQRT1_2)
    expect(roadAheadOf(AT)).toEqual(UP)
    const running = goslingAt(OPENING.bolt + 1, 0, 3, AT, UP, ahead, 0, HOME, false, false)
    expect(running.x).toBeGreaterThan(1)
  })

  it('walks straight back down the plain with no road', () => {
    const walk = walkOf(AT)
    expect(walk[0]).toEqual({ x: 0, z: WALK_PACE * OPENING.strike })
  })

  it('has the goslings peep at him, and he answers them, as they walk, hushed by the strike', () => {
    expect(CHAT.some((line) => typeof line.who === 'number')).toBe(true)
    expect(CHAT.some((line) => typeof line.who !== 'number')).toBe(true)
    for (let k = 1; k < CHAT.length; k++) expect(CHAT[k]!.at).toBeGreaterThan(CHAT[k - 1]!.at)
    expect(CHAT[CHAT.length - 1]!.at).toBeLessThan(OPENING.strike - 1)
  })

  it('stops them dead at the strike, frightened, before the goslings bolt', () => {
    expect(startled(OPENING.strike - 0.01)).toBeUndefined()
    expect(startled(OPENING.strike + 0.1)).toBeGreaterThan(0)
    expect(OPENING.bolt).toBeGreaterThan(OPENING.strike)
    expect(cowering((OPENING.strike + OPENING.bolt) / 2)).toBe(true)
    expect(cowering(OPENING.bolt)).toBe(false)
  })

  it('leaves the night pale after the strike, easing back to dark', () => {
    expect(afterglow(OPENING.strike - 0.01)).toBe(0)
    expect(afterglow(OPENING.strike + 0.2)).toBeGreaterThan(afterglow(OPENING.strike + 0.8))
    expect(afterglow(OPENING.strike + 0.8)).toBeGreaterThan(0)
    expect(afterglow(OPENING.strike + 3)).toBe(0)
  })

  it('darkens the sky just after the strike, as the rats come out, whole by the end and after', () => {
    expect(skyDarkened(OPENING.strike + 0.5)).toBe(0)
    expect(skyDarkened(OPENING.rush)).toBeGreaterThan(0)
    expect(skyDarkened(OPENING.rush + 1)).toBeGreaterThan(skyDarkened(OPENING.rush))
    expect(skyDarkened(OPENING.end)).toBe(1)
    expect(skyDarkened(OPENING.end + 5)).toBe(1)
  })

  it('keeps the tree dark until the strike, lit at once by it, and the rats away until their rush after it', () => {
    expect(litShare(OPENING.strike - 0.01)).toBe(0)
    expect(litShare(OPENING.strike)).toBeGreaterThan(0.5)
    expect(OPENING.rush).toBeGreaterThan(OPENING.bolt)
    expect(ratsOut(OPENING.rush - 0.01)).toBe(false)
    expect(ratsOut(OPENING.rush)).toBe(true)
    expect(litShare(OPENING.strike + OPENING.spread / 2)).toBeGreaterThan(litShare(OPENING.strike))
    expect(litShare(OPENING.strike + OPENING.spread + 0.01)).toBe(1)
  })

  it('climbs the tree from its foot, where the strike lands, to its crown', () => {
    const t = OPENING.strike + OPENING.spread / 2
    expect(flameGrown(OPENING.strike - 0.01, 0)).toBe(0)
    expect(flameGrown(t, 0)).toBe(1)
    expect(flameGrown(t, 1)).toBe(0)
    expect(flameGrown(OPENING.strike + OPENING.spread + 1, 1)).toBe(1)
  })

  it('walks the goslings round his back, bolts them up the plain, and has them waiting once out of view', () => {
    const walking = goslingAt(0, 0, 3, AT, UP, UP, 0, HOME, false, false)
    expect(Math.hypot(walking.x, walking.z)).toBeLessThan(1)
    expect(walking.z).toBeGreaterThan(0)
    const running = goslingAt(OPENING.bolt + 1, 0, 3, AT, UP, UP, 0, HOME, false, false)
    expect(running.z).toBeLessThan(walking.z - 1)
    expect(goslingAt(OPENING.end, 0, 3, AT, UP, UP, 0, HOME, false, false)).toEqual(HOME)
    // Still in view as the opening nears its end, he runs on; out of it, he waits.
    expect(goslingAt(OPENING.end - 0.5, 0, 3, AT, UP, UP, 0, HOME, false, false).z).toBeLessThan(running.z - 10)
    expect(goslingAt(OPENING.bolt + 1, 0, 3, AT, UP, UP, 0, HOME, false, true)).toEqual(HOME)
  })

  it('fans the goslings out wide up the road, each on the side he walks, with nothing in the way', () => {
    const from = [0, 1, 2].map((index) => roundHisBack(index, 3, AT, UP))
    const ways = boltWays(from, UP, () => true)
    expect(ways[0]).toBeGreaterThan(0.6)
    expect(ways[1]).toBeCloseTo(0)
    expect(ways[2]).toBeLessThan(-0.6)
    // The first walks on his right, +x, and bolts to it.
    expect(from[0]!.x).toBeGreaterThan(0)
    expect(goslingAt(OPENING.bolt + 1, 0, 3, AT, UP, UP, ways[0]!, HOME, false, false).x).toBeGreaterThan(1)
  })

  it('turns a gosling off his place in the fan the least he can, to a way no wall stands on', () => {
    const from = [0, 1, 2].map((index) => roundHisBack(index, 3, AT, UP))
    // A wall along x = 2, the right side of the road.
    const clear = (a: { x: number }, b: { x: number }) => Math.max(a.x, b.x) < 2
    const ways = boltWays(from, UP, clear)
    const open = boltWays(from, UP, () => true)
    expect(ways[0]).toBeLessThan(open[0]!)
    expect(ways[0]).toBeGreaterThan(ways[1]!)
    from.forEach((start, index) => expect(start.x + Math.sin(ways[index]!) * 10).toBeLessThan(2))
  })

  it('jumps each gosling where he stands as they bolt, all at once, and runs him the moment his jump is over', () => {
    expect(boltJump(OPENING.bolt - 0.01)).toBeUndefined()
    expect(boltJump(OPENING.bolt)?.clip).toBe('jump')
    let runs = OPENING.bolt
    while (boltJump(runs) !== undefined) runs += 0.005
    // Past his landing, before the hop's clip is played out.
    expect(runs).toBeGreaterThan(OPENING.bolt + OPENING.jump * 0.6)
    expect(runs).toBeLessThan(OPENING.bolt + OPENING.jump)
    const lifts = Array.from({ length: 20 }, (_, k) => boltJump(OPENING.bolt + (k / 20) * (runs - OPENING.bolt))!.lift)
    expect(Math.max(...lifts)).toBeGreaterThan(0)
    const stood = goslingAt(OPENING.bolt, 0, 3, AT, UP, UP, 0, HOME, false, false)
    expect(goslingAt(runs - 0.01, 0, 3, AT, UP, UP, 0, HOME, false, false)).toEqual(stood)
    expect(goslingAt(runs + 0.1, 0, 3, AT, UP, UP, 0, HOME, false, false).z).toBeLessThan(stood.z - 0.2)
  })

  it('stops the one that freezes where he waits', () => {
    const near = { x: 2, z: 1 }
    expect(goslingAt(OPENING.end, 0, 3, AT, UP, UP, 0, near, true, false)).toEqual(near)
  })

  it('snaps the burning branch off the crown after the strike, and has it lying where it lands before the opening ends', () => {
    const from = { x: 4, y: 3, z: 50 }
    const to = { x: 1, y: 0.1, z: 52 }
    expect(OPENING.branch).toBeGreaterThan(OPENING.strike)
    expect(OPENING.branch + OPENING.branchFalls).toBeLessThan(OPENING.end - 1)
    expect(branchAt(OPENING.branch - 0.01, from, to)).toMatchObject({ shown: false, landed: false })
    expect(branchAt(OPENING.branch, from, to)).toMatchObject({ at: from, shown: true, landed: false })
    // Hanging at its break first, sagging a little, where it snapped.
    const hung = branchAt(OPENING.branch + OPENING.branchSags / 2, from, to)
    expect(hung.at.x).toBe(from.x)
    expect(hung.at.y).toBeLessThan(from.y)
    expect(hung.at.y).toBeGreaterThan(from.y - 0.1)
    // Then dropping from still, faster and faster, drifting out to where it lands.
    const drops = OPENING.branchFalls - OPENING.branchSags
    const half = branchAt(OPENING.branch + OPENING.branchSags + drops / 2, from, to)
    expect(half.at.x).toBeCloseTo((from.x + to.x) / 2)
    expect(half.at.y).toBeLessThan(hung.at.y)
    expect(half.at.y).toBeGreaterThan(to.y)
    expect(half.landed).toBe(false)
    const early = branchAt(OPENING.branch + OPENING.branchSags + drops * 0.1, from, to)
    const late = branchAt(OPENING.branch + OPENING.branchSags + drops * 0.9, from, to)
    expect(half.at.y - late.at.y).toBeGreaterThan(early.at.y - half.at.y)
    const down = branchAt(OPENING.branch + OPENING.branchFalls, from, to)
    expect(down.landed).toBe(true)
    expect(branchLanded(OPENING.branch + OPENING.branchFalls - 0.01)).toBe(false)
    expect(branchLanded(OPENING.branch + OPENING.branchFalls)).toBe(true)
    expect(down.at.y).toBeCloseTo(to.y)
    expect(branchAt(OPENING.end, from, to)).toEqual({ at: to, tumble: 0, shown: true, landed: true })
  })

  it('turns the branch over as it falls, to land lying, and rocks it still', () => {
    const from = { x: 0, y: 3, z: 0 }
    const to = { x: 0, y: 0, z: 2 }
    // Out and up off its break as it hangs, turning slowly down to lie as it lands: never a spin.
    const tumbles: number[] = []
    for (let t = OPENING.branch; t < OPENING.branch + OPENING.branchFalls; t += 0.02) tumbles.push(branchAt(t, from, to).tumble)
    expect(tumbles[0]).toBeGreaterThan(1)
    for (let k = 1; k < tumbles.length; k++) expect(tumbles[k]).toBeLessThanOrEqual(tumbles[k - 1]! + 1e-9)
    expect(Math.abs(branchAt(OPENING.branch + OPENING.branchFalls - 0.01, from, to).tumble)).toBeLessThan(0.1)
    const bounced = branchAt(OPENING.branch + OPENING.branchFalls + 0.12, from, to)
    expect(bounced.at.y).toBeGreaterThan(to.y)
    expect(branchAt(OPENING.branch + OPENING.branchFalls + 2, from, to)).toEqual({ at: to, tumble: 0, shown: true, landed: true })
  })

  it("flares the branch's light as it lands, settling back to its own reach", () => {
    const landed = OPENING.branch + OPENING.branchFalls
    expect(branchFlare(landed - 0.01)).toBe(1)
    expect(branchFlare(landed)).toBeGreaterThan(1.5)
    expect(branchFlare(landed + 0.2)).toBeLessThan(branchFlare(landed))
    expect(branchFlare(landed + 0.2)).toBeGreaterThan(1)
    expect(branchFlare(landed + 1)).toBe(1)
    expect(branchFlare(OPENING.end)).toBe(1)
  })

  it('shakes the screen the moment the strike hits, not before', () => {
    expect(shakeAt(OPENING.strike - 0.01)).toEqual({ x: 0, y: 0, z: 0 })
    expect(Math.abs(shakeAt(OPENING.strike + 0.02).y) + Math.abs(shakeAt(OPENING.strike + 0.02).x)).toBeGreaterThan(0)
    expect(shakeAt(OPENING.strike + OPENING.shaking + 0.1)).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('shakes the screen with a rumble only while it lasts, never past its most, none before one', () => {
    const still = { x: 0, y: 0, z: 0 }
    expect(rumbleAt(Number.NaN, 0.05, 4)).toEqual(still)
    expect(rumbleAt(-0.1, 0.05, 4)).toEqual(still)
    expect(rumbleAt(4, 0.05, 4)).toEqual(still)
    let hardest = 0
    for (let since = 0; since < 4; since += 1 / 120) {
      const { x, y, z } = rumbleAt(since, 0.05, 4)
      hardest = Math.max(hardest, Math.abs(x), Math.abs(y), Math.abs(z))
    }
    expect(hardest).toBeGreaterThan(0.02)
    expect(hardest).toBeLessThanOrEqual(0.05)
  })

  it('shakes less and less as a rumble dies away', () => {
    const hardestFrom = (start: number) => {
      let hardest = 0
      for (let since = start; since < start + 0.5; since += 1 / 120) {
        const { x, y } = rumbleAt(since, 0.05, 4)
        hardest = Math.max(hardest, Math.abs(x), Math.abs(y))
      }
      return hardest
    }
    expect(hardestFrom(3)).toBeLessThan(hardestFrom(0.5))
  })
})
