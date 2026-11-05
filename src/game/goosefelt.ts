// What the game does to be felt: a bite on him, the torch running low and catching, the ground's rumble, his fall and his wake.
import { GoosePlay, MOST_BITERS, eased } from './gooseplay'
import { type PlaySwarm } from '../swarm/play'
import { type GooseFeel } from '../settings'
import { type GooseSounds } from '../sound/goosesounds'
import { type Goose } from '../characters/goose'
import { createFeathers } from '../characters/feathers'
import { createEmbers } from '../light/embers'
import { createFlame } from '../light/flame'
import { createPost, type DarkLook } from '../look/post'
import { type Goslings } from '../characters/goslings'
import { type NightLights } from '../light/nightlights'
import { type PlayerInput } from '../ui/gooseinput'
import { PerspectiveCamera, Vector3 } from 'three/webgpu'
import { createBeats } from './beats'
import { type Opening } from './opening'
import { type Ending } from './ending'
import { rumbleAt } from './gooseintro'
import { type FixedLight } from '../swarm/swarm'

/** What is felt, on what the page has made. */
export function createGooseFelt({ goosePlay, feel, gooseSounds, hisAt, standAt, goose, feathers, embers, flame, post, goslings, nightLights, torchHeard, input, camera, view, beats, opening, ending, darkLook, darkHeld }: {
  goosePlay: GoosePlay<PlaySwarm>
  feel: GooseFeel
  gooseSounds: GooseSounds | undefined
  hisAt: () => { x: number; y: number; z: number }
  standAt: (x: number, z: number) => number
  goose: Goose
  feathers: ReturnType<typeof createFeathers>
  embers: ReturnType<typeof createEmbers>
  flame: ReturnType<typeof createFlame>
  post: ReturnType<typeof createPost>
  goslings: Goslings
  nightLights: NightLights
  torchHeard: { level: number; faster: number }
  input: PlayerInput
  camera: PerspectiveCamera
  view: { cameraKnock: Vector3; controls: { target: Vector3 } }
  beats: ReturnType<typeof createBeats>
  opening: Opening
  ending: Ending
  darkLook: DarkLook
  darkHeld: number
}) {
  const { cameraKnock, controls } = view
  const felt = {
    /** When J last showed his death clip whole, s of the play. */
    deathShownAt: Number.NEGATIVE_INFINITY,
    /** When a found gosling's rats last rumbled in, on the play's time; none yet, NaN. */
    rumbledAt: Number.NaN,
    biteFrame,
    torchFrame,
    rumbleFrame,
    lifeFrame,
    wakeFlare,
    dyingAt,
  }
  /** When a bite on him was last heard and seen, s of the play; how hard it was, 0 to 1; and which way it came from, on the ground. */
  let biteCued = Number.NEGATIVE_INFINITY
  let biteHard = 0
  const biteCame = { x: 0, z: 0 }
  /** How hard a bite by one rat is, of the hardest, MOST_BITERS of them at once. */
  const BITE_SOFTEST = 0.6
  /**
   * A rat's bite on him, heard and seen: at once as the first bites, then at most once a `feel.bite.gap` s however many
   * bite him, so six at once never chatter; the harder the more there are. Heard as the pained honk or the hiss; seen as
   * his flinch, squashed down from his feet at once and springing back a little past his height, then still; as his
   * body flashing, held a moment and fading, the frame's edges closing in with it, the more as his life runs low; as the
   * camera snapped the way the bite came and springing back past where it was; as feathers puffing off him away from
   * the bite; and in his goslings with him, cowering, a frightened peep from one or two.
   */
  function biteFrame() {
    const { t, biters } = goosePlay
    const { bite } = feel
    if (biters > 0 && t - biteCued >= bite.gap) {
      biteCued = t
      biteHard = BITE_SOFTEST + ((1 - BITE_SOFTEST) * (Math.min(biters, MOST_BITERS) - 1)) / (MOST_BITERS - 1)
      gooseSounds?.play(bite.sound === 'honk' ? 'bite_honk' : 'bite_hiss', hisAt(), biteHard)
      biteCame.x = goosePlay.biteFrom.x
      biteCame.z = goosePlay.biteFrom.z
      biteBody.set(goose.object.position.x, goose.object.position.y + BITE_BODY, goose.object.position.z)
      feathers.burst(biteBody, biteCame, biteHard)
      goslingsFright(t)
    }
    const since = t - biteCued
    /** How far through a part of it lasting `lasts` s the bite is, 0 to 1; 1 over, or none yet. */
    const through = (lasts: number) => (since >= 0 ? Math.min(1, since / Math.max(lasts, 1e-3)) : 1)
    // Squashed at the bite, through his height a third of the way back, stretched a little two thirds back, still at the end.
    const flinch = through(bite.lasts)
    const squash = bite.squash * biteHard * Math.cos(flinch * 1.5 * Math.PI) * (1 - flinch)
    goose.object.scale.set(1 + squash / 2, 1 - squash, 1 + squash / 2)
    // The flash, held whole a moment and fading; the edges with it, the more as his life runs low.
    const fade = through(bite.flashLasts)
    const flash = biteHard * (fade < FLASH_HELD ? 1 : ((1 - fade) / (1 - FLASH_HELD)) ** 2)
    goose.material.flash.color.value.set(bite.flashColour)
    goose.material.flash.strength.value = bite.flash * flash
    post.hurt(bite.edge * flash * (EDGE_FULL_LIFE + (1 - EDGE_FULL_LIFE) * (1 - goosePlay.life)), bite.edgeColour)
    // The knock: the camera snapped the way the bite pushes him, away from the rats, and a little down, at once; springing
    // back past where it was, then settling.
    const settle = through(bite.knockLasts)
    const knock = bite.knock * biteHard * (1 - settle) ** 2 * Math.cos(2.5 * Math.PI * settle)
    cameraKnock.set(-biteCame.x * knock, -knock * 0.5, -biteCame.z * knock)
  }
  /** How high on him the feathers puff off, m over his feet. */
  const BITE_BODY = 0.3
  const biteBody = new Vector3()
  /** The share of the flash held whole before it fades. */
  const FLASH_HELD = 0.15
  /** The share of the edges a bite closes in with his life full; all of it with his life gone. */
  const EDGE_FULL_LIFE = 0.6
  /** How long his goslings cower after a bite, s; how long between their frightened peeps at the least, s; and how many peep at once at most. */
  const GOSLING_FRIGHT = 0.9
  const FRIGHT_PEEPS_GAP = 1.6
  const FRIGHT_PEEPERS = 2
  let frightPeeped = Number.NEGATIVE_INFINITY
  goslings.cowering = (k) => goosePlay.goslings[k]?.state === 'circle' && goosePlay.t - biteCued < GOSLING_FRIGHT
  /** A bite at `t`: his goslings with him cower (goslings.ts `cowering`), and one or two peep, not more often than FRIGHT_PEEPS_GAP. */
  function goslingsFright(t: number) {
    if (!gooseSounds || t - frightPeeped < FRIGHT_PEEPS_GAP) return
    const withHim = goosePlay.goslings.flatMap((g, k) => (g?.state === 'circle' ? [k] : []))
    if (withHim.length === 0) return
    frightPeeped = t
    for (let n = 0; n < Math.min(FRIGHT_PEEPERS, withHim.length); n++) {
      const [k] = withHim.splice(Math.floor(Math.random() * withHim.length), 1)
      const g = goosePlay.goslings[k!]!
      gooseSounds.play('cower_peep', { x: g.x, y: standAt(g.x, g.z) + 0.2, z: g.z }, 1, 0.05 + Math.random() * 0.15)
    }
  }

  /** When the torch's last catch was seen, s of the play, NaN none; and how hard it was, 0 to 1. */
  let torchCaughtSeen = Number.NaN
  let torchHard = 0
  /** Whether the catch last seen was his first: lit from nothing, the game's first light his own. */
  let torchFirst = false
  /** His first catch's flare: how far past its reach it throws the light, of its reach, and how long it takes to settle, s, over a catch's own. */
  const FIRST_FLARE_REACH = 0.8
  const FIRST_FLARE_LASTS = 1.4
  /** How hard the catch of a torch topped up from all but full is, of one lit from out. */
  const TORCH_SOFTEST = 0.35
  /** How long the flare takes to reach its height, s: a whoomph, not a blink. */
  const FLARE_IN = 0.06
  /** How often the guttering may dip the torch, s of the held time; how often a step dips it with the torch all but out, and how deep, of the panel's dips. */
  const GUTTER_STEP = 0.09
  const GUTTER_CHANCE = 0.45
  const GUTTER_DEPTH = [0.5, 1] as const
  /** How long the crackle's speed takes to follow where it goes, s; how loud a topped-up torch's catch sounds, of a lit one's. */
  const CRACKLE_EASE = 0.12
  const TOPPED_IGNITE = 0.8
  /** A draw from 0 to 1 by `n`, the same for the same `n`. */
  const drawOf = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  const awayFromLook = new Vector3()
  /**
   * The torch, felt: its flame smaller as its light fades, in a straight line; running low, past `low` of its fuel, its flame wilder, the lamp guttering, dipping now
   * and then, the more often the lower, its crackle thinner; filled at a fire, the crackle rising as it fills, from
   * nothing while it is out. And catching full (GoosePlay.caughtAt), the harder the lower it was: a spray of sparks, the
   * light flaring past its reach and the lamp past its glow, the rats at its edge thrown back with it, then settling;
   * the flame popping up tall, dipping back past its height and still; the camera nudged back off him, springing back.
   */
  function torchFrame(dt: number, held: number) {
    const { torch } = feel
    const { run, t, caughtAt, caughtFrom, kindled } = goosePlay
    const lit = run.torch.lit
    const low = lit ? Math.max(0, 1 - run.fuel / Math.max(torch.low, 1e-3)) : 0
    // A dip on this step of the held time or none, so on the stop motion's beat it holds with the rest.
    const step = Math.floor(held / GUTTER_STEP)
    const dip = drawOf(step) < low * GUTTER_CHANCE ? GUTTER_DEPTH[0] + (GUTTER_DEPTH[1] - GUTTER_DEPTH[0]) * drawOf(step + 0.5) : 0
    if (!Number.isNaN(caughtAt) && caughtAt !== torchCaughtSeen) {
      torchFirst = Number.isNaN(torchCaughtSeen)
      torchCaughtSeen = caughtAt
      torchHard = TORCH_SOFTEST + (1 - TORCH_SOFTEST) * (1 - caughtFrom)
      embers.burst(torch.sparks * torchHard, torch.sparkSpeed)
      // Lit from out, its ignite is heard already (scenesHeardFrame); a top-up's catch is heard here.
      if (caughtFrom > 0) gooseSounds?.play('ignite', hisAt(), torchHard * TOPPED_IGNITE)
    }
    const since = t - caughtAt
    const caught = since >= 0
    /** How far through a part of the catch lasting `lasts` s it is, 0 to 1; 1 over, or none yet. */
    const through = (lasts: number) => (caught ? Math.min(1, since / Math.max(lasts, 1e-3)) : 1)
    // His first catch, the branch picked up or his torch first lit, flares further and longer: the ring of rats opens round him.
    const flareLasts = torchFirst ? FIRST_FLARE_LASTS : torch.flareLasts
    const flare = caught ? torchHard * Math.min(1, since / FLARE_IN) * (1 - through(flareLasts)) ** 2 : 0
    nightLights.torchFlare = 1 + (torchFirst ? FIRST_FLARE_REACH : torch.reach) * flare
    nightLights.torchGlow = (1 + torch.flare * flare) * (1 - torch.dips * dip)
    const popped = through(torch.popLasts)
    const pop = torch.pop * torchHard * (1 - popped) ** 2 * Math.cos(2.5 * Math.PI * popped)
    // Its flame its full size, as see-through as its light is short of a full torch's: fading in a straight line as the light fades out.
    const left = lit ? run.torch.reach / Math.max(goosePlay.runTuning.torchReach, 1e-3) : 0
    flame.burning(1 - 0.5 * torch.dips * dip + pop, 1 + 0.4 * pop, 1 + torch.gutter * low, left)
    const filling = goosePlay.atRefill && input.commands.interact
    const faster = filling ? 1 + torch.rise * (lit ? run.fuel : kindled) : 1
    torchHeard.faster += (faster - torchHeard.faster) * (1 - Math.exp(-dt / CRACKLE_EASE))
    torchHeard.level = lit ? 1 - torch.thin * low : filling ? kindled : 0
    // Nudged back along the camera's look, off him, at once; springing back past where it was, then settling.
    const settled = through(torch.knockLasts)
    const knock = torch.knock * torchHard * (1 - settled) ** 2 * Math.cos(2.5 * Math.PI * settled)
    if (knock !== 0) cameraKnock.add(awayFromLook.subVectors(camera.position, controls.target).normalize().multiplyScalar(knock))
  }

  /** The ground shaking the camera under a found gosling's rats, for as long as their rumble is heard. */
  function rumbleFrame() {
    const { x, y, z } = rumbleAt(goosePlay.t - felt.rumbledAt, feel.rumble.shake, feel.rumble.lasts)
    cameraKnock.x += x
    cameraKnock.y += y
    cameraKnock.z += z
  }

  /** How long past its end the shown death holds its last frame, s. */
  const DEATH_SHOWN_HOLD = 0.8
  /**
   * How far into his death he is, s of it, at the feel folder's speed: as he falls, from his fall's start; or shown
   * whole by J; none, he is not dying.
   */
  function dyingAt(): number | undefined {
    const { fallen, t } = goosePlay
    const { speed } = feel.death
    if (!Number.isNaN(fallen)) return fallen * speed
    const shown = (t - felt.deathShownAt) * speed
    return shown >= 0 && shown < goose.deathLength + DEATH_SHOWN_HOLD ? shown : undefined
  }
  /**
   * His fall and wake: black as he falls; waking, the black lifting over WAKE_BLACK s
   * of it, the fire he wakes by flaring, its light reaching WAKE_FLARE more at its height, up and back over
   * WAKE_FLARE_AT s, and his colour coming back over WAKE_COLOUR s. His torch catches between (gooseplay.ts RISE_CATCH).
   */
  const fallenBlack = document.getElementById('fallen')
  const WAKE_BLACK = [0.15, 0.7] as const
  const WAKE_FLARE = 0.8
  const WAKE_FLARE_AT = [0.1, 0.55, 1.6] as const
  const WAKE_COLOUR = [1, 2.2] as const

  /** Where he is on the screen, 0 to 1 from its top left: where his life's dark closes on. */
  const darkOn = new Vector3()

  /** His life, shown on the frame alone: its colour draining with it, grey as it runs out; his death's dark swirling in as he falls, black, coming back as he wakes; in full colour and clear through the opening and the ending. */
  function lifeFrame() {
    const { fallen, woken } = goosePlay
    const scripted = opening.running() || ending.running()
    const { after, finish, progress } = darkLook
    // The fall as long as his death and the dark take, read live; his torch dying over both, so the rats close in slowly
    // and never bury him as he dies.
    goosePlay.settings.fall.lasts = after + finish + darkHeld
    goosePlay.settings.fall.dims = after + finish
    let black = 0
    if (fallen >= after + finish) black = 1
    else if (!Number.isNaN(woken)) black = 1 - eased(woken, ...WAKE_BLACK)
    if (fallenBlack) fallenBlack.style.opacity = String(black)
    const colour = Number.isNaN(woken) ? goosePlay.life : eased(woken, ...WAKE_COLOUR)
    post.colour(scripted ? 1 : colour)
    // His death's dark: swirling in over `finish` s once his death has played `after` s; or held at the folder's progress, to see it.
    const falling = !Number.isNaN(fallen)
    const dark = progress >= 0 ? progress : falling && !scripted ? Math.min(1, Math.max(0, fallen - after) / Math.max(finish, 1e-3)) : 0
    darkOn.set(goose.object.position.x, goose.object.position.y + 0.4, goose.object.position.z).project(camera)
    post.dark(dark, (darkOn.x + 1) / 2, (1 - darkOn.y) / 2, falling ? fallen : beats.clock, darkLook)
  }

  /** The lights as drawn, the fire he wakes by flaring while he wakes: the lit flame nearest where he wakes. */
  function wakeFlare(placed: readonly FixedLight[]): readonly FixedLight[] {
    const { woken } = goosePlay
    if (Number.isNaN(woken)) return placed
    const [from, top, to] = WAKE_FLARE_AT
    const up = woken < top ? eased(woken, from, top) : 1 - eased(woken, top, to)
    const { restAt, level } = goosePlay
    let nearest = -1
    let best = Number.POSITIVE_INFINITY
    level.lights.forEach((one, k) => {
      const off = Math.hypot(one.x - restAt.x, one.z - restAt.z)
      if (one.flame && one.on && off < best) [nearest, best] = [k, off]
    })
    return placed.map((one, k) => (k === nearest ? { ...one, reach: one.reach * (1 + WAKE_FLARE * up) } : one))
  }
  return felt
}
