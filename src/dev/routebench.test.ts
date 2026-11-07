// The route bench's player (routebench.ts) on the saved route, with no browser: a sixtieth of a second a frame, his
// torch kept full and his life too, as the bench keeps them.
import { describe, expect, it } from 'vitest'
import { GoosePlay, inZone } from '../game/gooseplay'
import { STEP } from '../swarm/swarm-remote'
import { routeStep } from './routebench'

describe('the route bench', () => {
  it('finds every gosling and swims out to the island', () => {
    const play = new GoosePlay({ rats: 200, seed: 3 })
    play.landBranch(true)
    const island = play.plain.pond
    const aims: string[] = []
    let tapped = false
    for (let t = 0; t < 600; t += STEP) {
      const step = routeStep(play, island, inZone)
      if (aims.at(-1) !== step.aim) aims.push(step.aim)
      if (step.aim === 'island' && Math.hypot(island.x - play.holder.x, island.z - play.holder.z) < 1) break
      tapped = step.interact === 'tap' && !tapped
      const d = step.to ? Math.hypot(step.to.x - play.holder.x, step.to.z - play.holder.z) : 0
      play.run.fuel = 1
      play.life = 1
      play.frame(STEP, { heading: step.to && d > 0 ? { x: (step.to.x - play.holder.x) / d, z: (step.to.z - play.holder.z) / d } : null, interact: step.interact === 'hold' || tapped })
    }
    expect(play.goslings.every((g) => g === undefined || g.state !== 'waiting')).toBe(true)
    expect(aims.at(-1)).toBe('island')
    expect(Math.hypot(island.x - play.holder.x, island.z - play.holder.z)).toBeLessThan(1)
    expect(aims[0]).toBe('branch')
    // Each scene worked, not walked past: the cage's key before the cage.
    expect(aims.map((aim) => aim.split(' ')[0]).filter((kind) => kind !== 'gosling')).toEqual(['branch', 'well', 'tree', 'key', 'cage', 'island'])
  })
})
