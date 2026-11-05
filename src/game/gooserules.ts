// What the game starts with: how its rats crowd and run, the panel's first settings, and how he feels to play.
import type { Settings, GooseFeel } from '../settings'
import { url, debugOn } from './address'
import { RAT_SPEEDS, SIZE_BY_SPEED, LIGHT_SPEED, CROWD } from './gameplay'
import { defaultTuning } from '../swarm/swarm'
import type { Feathers } from '../characters/feathers'

/** How fast the light walks under `?film`, m/s: a take covers more ground in its few seconds. */
const FILM_LIGHT_SPEED = 2
/** The game's rats to start, 100 since 2026-11-02, more coming with each gosling found: ?rats=N asks for others. */
const GOOSE_RATS = 100
// The game's rats as set from the panel on 2026-10-26: quicker to come on, and quicker still from the light, bigger; bigger again, 2.2, since 2026-10-29, and spaced 1.2 the same day (1.8 read as too tame).
const GOOSE_SPEEDS = { minSpeed: 3, maxSpeed: 4, fleeMinSpeed: 4, fleeMaxSpeed: 4.5 }
const GOOSE_RAT_SIZE = 2.2
const GOOSE_SPACING = 1.2
/** How far off the game's rats out of view come round from, m, with no fog to hide them nearer, set on 2026-10-26. */
const GOOSE_ROUND_PAST = 30

/** The settings the page starts on, the rats held to `capacity`. */
export function startingSettings(capacity: number): Settings {
  /** The count the address asks for, ?rats=N: zero included. */
  const askedRats = Math.round(Number(url.get('rats') ?? GOOSE_RATS))
  // The start, saved from the panel on 2026-10-05: the game's rats, their size and speeds (gameplay.ts), each as
  // big as it is fast, a dim light that walks as fast as they run, and the run played at the rat's own pace.
  return {
    rats: Math.min(Math.max(Number.isNaN(askedRats) ? GOOSE_RATS : askedRats, 0), capacity),
    ...RAT_SPEEDS,
    ...GOOSE_SPEEDS,
    size: GOOSE_RAT_SIZE,
    sizeBySpeed: SIZE_BY_SPEED,
    spacing: GOOSE_SPACING,
    on: true,
    // The debug keys on the developer's page, and in a take, which the keys run.
    debug: debugOn || url.has('film'),
    shadows: url.has('shadows'),
    runAnimation: 1.7,
    lightSpeed: url.has('film') ? FILM_LIGHT_SPEED : LIGHT_SPEED,
    paused: false,
    bringRound: true,
    // The game's rats come round from out of the camera's view or past GOOSE_ROUND_PAST m, the fog nearer where it is on.
    roundPast: GOOSE_ROUND_PAST,
    // ?nocharacter starts with the character hidden, its torch, flame, embers and smoke with it, as the panel's toggle does.
    character: !url.has('nocharacter'),
  }
}

/** The swarm's tuning as the game has it, from `settings`; and the collision disc at the usual size, which the rat scale and the spacing multiply. */
export function gooseTuning(settings: Settings) {
  const tuning = defaultTuning()
  // The game's crowd (gameplay.ts).
  Object.assign(tuning, CROWD)
  /** How far off the game's rats notice him, m: short of every theme's fog, so the rats further off are seen wandering.
   * 6 since 2026-10-29 (4.5 from 2026-10-27), set from the rats' pull folder. */
  const GOOSE_NOTICE = 6
  // The game's rats notice him within GOOSE_NOTICE m, his goslings drawing them from as far as he does, each running
  // at the nearest of them; the rats further off ignore him and run about at their own pace, bending back his way only as they
  // roam more than 16 m past that (2026-10-26).
  Object.assign(tuning, { notice: GOOSE_NOTICE, wander: 1, roam: 16 })
  // The game's rats pile up a fifth of a rat's height since 2026-11-02 (a whole one from 2026-10-29); and since
  // 2026-10-25 they lunge and weave, softly, a harder lunge reading too
  // aggressive here; a little more since 2026-10-26: about once in 3.5 s each, at 2.1 times its pace
  // for 0.13 s, swerving up to 0.4 rad.
  Object.assign(tuning, { pull: tuning.notice, pile: 0.2, dashRate: 1 / 3.5, dashSpeed: 2.1, dashTime: 0.13, weave: 0.4 })
  // The game's rats quick to answer since 2026-10-29, the calmer answer of 2026-10-25 read
  // as too tame; but still no bolt at once, from the light or into a lunge.
  Object.assign(tuning, { reaction: 0.25, turnRate: 10, fleeReaction: 0.3, fleeTurn: 1.5 })
  /** The collision disc at the usual size: the rat scale and the spacing multiply it. */
  const RAT_RADIUS = tuning.ratRadius
  tuning.minSpeed = settings.minSpeed
  tuning.maxSpeed = settings.maxSpeed
  tuning.fleeMinSpeed = settings.fleeMinSpeed
  tuning.fleeMaxSpeed = settings.fleeMaxSpeed
  tuning.ratRadius = RAT_RADIUS * settings.size * settings.spacing
  return { tuning, RAT_RADIUS }
}

/**
 * How he feels to play (the panel's feel folder, GooseFeel): his walk all but at the keys' pace, or stopped, in
 * `inertia` s, `?inertia=` to start at another; and a rat's bite on him, the pained honk, `?bite=hiss` to start with
 * the hiss. Pushed past real, as the game is drawn: a long red flash, the camera snapped and springing back, the
 * edges closing in dark red.
 */
export function startingFeel(feathers: Feathers, deathTimed: () => void): GooseFeel {
  const askedInertia = Number(url.get('inertia'))
  return {
    inertia: url.has('inertia') && askedInertia >= 0 ? askedInertia : 0.15,
    bite: { sound: url.get('bite') === 'hiss' ? 'hiss' : 'honk', gap: 0.7, lasts: 0.22, squash: 0.12, flash: 1.2, flashColour: 0xfe9590, flashLasts: 0.45, edge: 0.55, edgeColour: 0x5d0909, knock: 0.16, knockLasts: 0.4 },
    feathers: { look: feathers.look, changed: () => feathers.set() },
    // His death (goosedeath.ts) as made; the dark's timing follows it.
    death: { speed: 1, changed: () => deathTimed() },
    // Its flight into his wing is the scenes', handed over once they are made.
    key: { taken: undefined, peep: 0.8, peepAfter: 0.3 },
    lean: { from: 5, near: 1.5, pull: 0.35, most: 0.9, ease: 0.8, low: true },
    torch: { low: 0.3, gutter: 1.5, dips: 0.6, thin: 0.5, rise: 0.4, flare: 0.9, reach: 0.25, flareLasts: 0.7, pop: 0.45, popLasts: 0.45, sparks: 16, sparkSpeed: 2.4, knock: 0.05, knockLasts: 0.35 },
    // Small, a fifth of the opening's strike; over as its sound all but is, the rumble played an octave down.
    rumble: { shake: 0.03, lasts: 4 },
  }
}
