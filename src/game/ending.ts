// The ending (gooseoutro.ts) as the page plays it: he and the mother on the island's shore, the dawn, the hearts and the title.
import { GoosePlay } from './gooseplay'
import type { PlaySwarm } from '../swarm/play'
import { type PondLook, islandMiddle, islandShoreAt } from '../world/pond'
import type { IslandGeese, IslandCue } from '../characters/islandgeese'
import type { Tent } from '../world/tent'
import type { Look } from '../settings'
import type { WaterLook, Water } from '../world/water'
import type { GroundFloor } from '../world/ground'
import type { DeadTreesMesh, GrassLook } from '../world/deadtrees'
import type { IslandTree } from '../world/islandtree'
import type { NightLights } from '../light/nightlights'
import type { Light, FixedLight } from '../swarm/swarm'
import type { GooseSounds } from '../sound/goosesounds'
import type { Goose } from '../characters/goose'
import { PerspectiveCamera, WebGPURenderer, Color, Vector3 } from 'three/webgpu'
import { url } from './address'
import { type Stage, type Island, layOutro, ganderAt, planAt, aimOf, motherAt, goslingOf, againOf, heartsOf, HEART_SHOWS, morningOf, fadeOf, titleOf, byOf, DRAIN, dawnOf } from './gooseoutro'
import { type PadButton, padBeside } from '../ui/holdhint'
import { dropKeptRun } from './keptrun'
/** The lights the dawn brings up: the low sun, the sky's fill, and the fires', the torch's among them, dying down; the water's horizon and the floor's colour with them. */
interface DawnLook {
  sun: { color: number; intensity: number; x: number; y: number; z: number; softness: number; shadowColor: number; darkness: number }
  fill: { sky: number; ground: number; intensity: number }
  lamp: { intensity: number }
  fires: number
  water: { horizon: number }
  floor: { saturation: number; lightness: number }
}
/**
 * The dawn as set from the panel on 2026-10-31: a pink sun high on the moon's side, its shadows soft and violet, a
 * pale pink sky over a dark violet ground, the water's horizon turquoise, the floor more coloured; the fires a third
 * of their night's.
 */
const DAWN: DawnLook = {
  sun: { color: 0xff94a4, intensity: 4.7, x: -23.5, y: 27, z: 25, softness: 1.5, shadowColor: 0x241d3a, darkness: 0.64 },
  fill: { sky: 0xffe0f7, ground: 0x221a28, intensity: 0.8 },
  lamp: { intensity: 2.5 },
  fires: 0.35,
  water: { horizon: 0x7cfef5 },
  floor: { saturation: 1.1, lightness: 0.64 },
}

/**
 * The ending: once he swims near the island, unless `?outro=0`; its own clock, s, on with the play's, -1 until it
 * starts. Laid out once as it starts, from where they all are, and played to its end, the title staying.
 */
export function createEnding({ goosePlay, pondLook, islandGeese, tent, look, waterLook, water, ground, deadTreesMesh, deadTreeGrass, islandTree, nightLights, light, gooseSounds, goose, camera, renderer }: {
  goosePlay: GoosePlay<PlaySwarm>
  pondLook: PondLook
  islandGeese: IslandGeese
  tent: Tent
  look: Look
  waterLook: WaterLook
  water: Water
  ground: GroundFloor
  deadTreesMesh: DeadTreesMesh
  deadTreeGrass: GrassLook
  islandTree: IslandTree
  nightLights: NightLights
  light: Light
  gooseSounds: GooseSounds | undefined
  goose: Goose
  camera: PerspectiveCamera
  renderer: WebGPURenderer
}) {
  const on = url.get('outro') !== '0'
  const ending = {
    on,
    t: -1,
    running: () => ending.t >= 0,
    stage: undefined as Stage | undefined,
    /** His goslings as it starts, those in his circle, in the stage's order. */
    brood: [] as number[],
    /** The island as it is drawn now, the ending's to read. */
    island: {
      get middle() {
        return islandMiddle(pondLook)
      },
      shoreAt: (angle: number) => islandShoreAt(pondLook.island, angle),
    } as Island,
    /** How far the camera's follow looks off him, m: toward the middle of the two of them as the ending goes on. */
    aim: { x: 0, z: 0 },
    /** How much of their night's light the fires give now, as the dawn comes up. */
    firesLeft: 1,
    /** Play again pressed, if it shows. */
    playAgain: undefined as (() => void) | undefined,
    /** On a pad, its button beside Play again. */
    againPad: undefined as PadButton | undefined,
    start: startOutro,
    walk: walkOutro,
    cue: outroCue,
    act: outroAct,
    frame: outroFrame,
    withDawn,
    againShown,
    get card() {
      return outroCard
    },
  }
  /** How far ahead of him the last gosling leads him, m, toward the island, out past his body as the camera sees him; and how far off its waterline the gosling keeps. */
  const GUIDE_AHEAD = 3.5
  const GUIDE_OFF_ISLAND = 1
  // The last gosling found leads him on to the island.
  goosePlay.guideTo = (holder) => {
    const { middle } = ending.island
    const dx = middle.x - holder.x
    const dz = middle.z - holder.z
    const d = Math.hypot(dx, dz) || 1
    const keep = ending.island.shoreAt(Math.atan2(-dz, -dx)) + GUIDE_OFF_ISLAND
    const lead = Math.min(GUIDE_AHEAD, Math.max(0, d - keep))
    return { x: holder.x + (dx * lead) / d, z: holder.z + (dz * lead) / d }
  }
  /** The night's lights as the ending starts, to bring the dawn up from. */
  let outroNight: DawnLook | undefined
  /** The ending started: laid out from where he, the mother and every gosling are now. */
  function startOutro() {
    dropKeptRun()
    const play = goosePlay
    ending.brood = play.goslings.flatMap((g, k) => (g?.state === 'circle' || g?.state === 'guiding' ? [k] : []))
    const { mother, motherYaw, goslings: island } = islandGeese.cast()
    const brood = ending.brood.map((k) => ({ x: play.goslings[k]!.x, z: play.goslings[k]!.z }))
    ending.stage = layOutro(ending.island, { gander: { ...play.holder }, mother, door: tent.object.visible ? tent.door() : undefined, motherYaw, island, brood })
    outroNight = dawnLookOf(look)
    dawnFloor = undefined
    ending.t = 0
    // In by now, asked for when the last gosling was found; else as soon as it comes.
    void gooseSounds?.load('outro').then(() => gooseSounds.play('outro'))
  }
  /** He and his goslings where the ending has them, the camera's look with them. */
  function walkOutro() {
    const stage = ending.stage
    if (!stage) return
    const { at, facing } = ganderAt(stage, ending.t)
    Object.assign(goosePlay.holder, at)
    Object.assign(goosePlay.facing, facing)
    ending.brood.forEach((k, i) => Object.assign(goosePlay.goslings[k]!, planAt(stage.brood[i]!, ending.t).at))
    const aim = aimOf(ending.t)
    ending.aim.x = (stage.pair.x - at.x) * aim
    ending.aim.z = (stage.pair.z - at.z) * aim
  }
  /** The island's geese as the ending has them, or nothing before it. */
  function outroCue(): IslandCue | undefined {
    const stage = ending.stage
    if (!stage) return undefined
    return { mother: motherAt(stage, ending.t), goslings: stage.island.map((_, j) => goslingOf(stage, false, j, ending.t)) }
  }
  /** What his gosling `k` does in the ending, shaking dry or hopping, and the way the gosling faces standing, if anything. */
  function outroAct(k: number) {
    const i = ending.brood.indexOf(k)
    return ending.stage && i >= 0 ? goslingOf(ending.stage, true, i, ending.t) : undefined
  }
  const dawnLookOf = (from: typeof look): DawnLook => ({
    sun: { color: from.sun.color, intensity: from.sun.intensity, x: from.sun.x, y: from.sun.y, z: from.sun.z, softness: from.sun.softness, shadowColor: from.sun.shadowColor, darkness: from.sun.darkness },
    fill: { sky: from.fill.sky, ground: from.fill.ground, intensity: from.fill.intensity },
    lamp: { intensity: from.lamp.intensity },
    fires: 1,
    water: { horizon: waterLook.horizon },
    floor: { saturation: from.floor.saturation, lightness: from.floor.lightness },
  })
  const dawnFrom = new Color()
  const dawnTo = new Color()
  /** The floor's lightness and saturation as the dawn last set them: moved off them from the panel, the floor is the panel's for the rest of the ending. */
  let dawnFloor: { saturation: number; lightness: number } | undefined
  /** The dawn brought up `share` of the way from the night it started at: into the look, and the lights set from it. */
  function dawnFrame(share: number) {
    if (!outroNight) return
    const mixed = (a: number, b: number) => dawnFrom.setHex(a).lerp(dawnTo.setHex(b), share).getHex()
    const between = (a: number, b: number) => a + (b - a) * share
    const night = outroNight
    Object.assign(look.sun, {
      color: mixed(night.sun.color, DAWN.sun.color),
      intensity: between(night.sun.intensity, DAWN.sun.intensity),
      x: between(night.sun.x, DAWN.sun.x),
      y: between(night.sun.y, DAWN.sun.y),
      z: between(night.sun.z, DAWN.sun.z),
      // The dawn's sun casts shadows, whether or not the night's did.
      shadows: true,
      softness: between(night.sun.softness, DAWN.sun.softness),
      shadowColor: mixed(night.sun.shadowColor, DAWN.sun.shadowColor),
      darkness: between(night.sun.darkness, DAWN.sun.darkness),
    })
    Object.assign(look.fill, { sky: mixed(night.fill.sky, DAWN.fill.sky), ground: mixed(night.fill.ground, DAWN.fill.ground), intensity: between(night.fill.intensity, DAWN.fill.intensity) })
    look.lamp.intensity = between(night.lamp.intensity, DAWN.lamp.intensity)
    ending.firesLeft = between(night.fires, DAWN.fires)
    waterLook.horizon = mixed(night.water.horizon, DAWN.water.horizon)
    water.set(waterLook)
    const floorTaken = dawnFloor && (look.floor.saturation !== dawnFloor.saturation || look.floor.lightness !== dawnFloor.lightness)
    if (!floorTaken) {
      look.floor.saturation = between(night.floor.saturation, DAWN.floor.saturation)
      look.floor.lightness = between(night.floor.lightness, DAWN.floor.lightness)
      dawnFloor = { saturation: look.floor.saturation, lightness: look.floor.lightness }
      ground.set(look.floor)
      deadTreesMesh.setGrass(deadTreeGrass, look.floor)
      islandTree.setGrass(look.floor)
    }
    nightLights.dawned(look, light.on)
  }
  /**
   * The night fading out at the ending's end, and the game's title over it, in the hints' hand; under it, in the slot the
   * loading screen's Enter key has, the key to play again, by its button or the controls' confirm once it shows: the page
   * loaded again. Filmed, the title stays alone.
   */
  const outroCard = on ? document.createElement('div') : undefined
  const outroTitle = on ? document.createElement('div') : undefined
  const outroAgain = on && !url.has('film') ? document.createElement('button') : undefined
  function againShown() {
    return !!outroAgain && ending.running() && againOf(ending.t) > 0
  }
  /** Who made it, a link at the foot of the screen, coming in before Play again: at the foot, so the title stands where the loading screen has it. */
  const outroBy = outroAgain ? document.createElement('a') : undefined
  if (outroCard && outroTitle) {
    outroCard.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;opacity:0;pointer-events:none;z-index:20;visibility:hidden'
    outroTitle.style.cssText = 'font-family:Gaegu,cursive;font-weight:700;font-size:min(13vw,128px);color:#f6ead0;opacity:0'
    outroTitle.textContent = 'A Goose Tale'
    const slot = document.createElement('div')
    slot.style.cssText = 'height:64px;margin-top:12px'
    if (outroAgain) {
      outroAgain.className = 'enter'
      outroAgain.textContent = 'Play again'
      ending.againPad = padBeside(outroAgain)
      outroAgain.style.cssText = 'opacity:0;pointer-events:none;visibility:hidden'
      let again = false
      const once = () => {
        if (again || !againShown()) return
        again = true
        outroAgain.disabled = true
        location.reload()
      }
      outroAgain.addEventListener('click', once)
      ending.playAgain = once
      slot.append(outroAgain)
    }
    outroCard.append(outroTitle, slot)
    if (outroBy) {
      outroBy.textContent = 'a game by Mike Fernandez'
      outroBy.href = 'https://www.mike-fernandez.dev/'
      outroBy.target = '_blank'
      outroBy.rel = 'noopener'
      outroBy.style.cssText = 'position:absolute;bottom:max(20px,env(safe-area-inset-bottom));font:700 22px/1.2 Gaegu,cursive;color:#f6ead0;text-decoration:none;opacity:0;pointer-events:none;visibility:hidden'
      outroCard.append(outroBy)
    }
    document.body.append(outroCard)
  }
  /**
   * The hearts going up over the two of them once they meet (gooseoutro.ts heartsOf), drawn as the game's words are:
   * each swells in past its size and settles, rises a little and slowly, floats round their heads in loops of HEART_LOOP px, and fades.
   * HEART_WIDE px across at its usual size; HEART_UP m over him it starts, HEART_RISE px it rises, HEART_SCATTER px to
   * its side at the most.
   */
  const HEART_WIDE = 15
  const HEART_UP = 0.9
  const HEART_RISE = 35
  const HEART_SCATTER = 55
  const HEART_LOOP = 10
  /** The heart, cut in facets: its red rim, the paler red inside, and the light caught down its left. */
  const HEART_RIM = '#ff2450'
  const HEART_INSIDE = '#ff5c78'
  const HEART_SHINE = '#ffb8c4'
  const HEART_SVG = `<svg viewBox="120 110 410 315" width="WIDE"><polygon fill="${HEART_RIM}" points="126,237 153,154 263,115 326,175 386,115 497,155 525,237 326,421"/><polygon fill="${HEART_INSIDE}" points="178,244 201,182 281,154 326,197 371,154 453,183 473,247 326,383"/><polygon fill="${HEART_SHINE}" points="201,182 178,244 326,383 190,243 206,181"/></svg>`
  const hearts = on ? heartsOf() : []
  const heartMarks = hearts.map((heart) => {
    const mark = document.createElement('div')
    mark.innerHTML = HEART_SVG.replace('WIDE', String(Math.round(HEART_WIDE * heart.size)))
    mark.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;opacity:0;line-height:0;filter:drop-shadow(0 2px 3px #000c)'
    document.body.append(mark)
    return mark
  })
  const heartFrom = new Vector3()
  function heartsFrame() {
    heartMarks.forEach((mark, k) => {
      const heart = hearts[k]!
      const age = ending.t - heart.at
      const shown = ending.running() && !!ending.stage && age >= 0 && age < HEART_SHOWS
      mark.style.opacity = shown ? String(Math.min(1, age / 0.3) * Math.min(1, (HEART_SHOWS - age) / 1)) : '0'
      if (!shown) return
      heartFrom.set(ending.stage!.pair.x, goose.object.position.y + HEART_UP, ending.stage!.pair.z).project(camera)
      const box = renderer.domElement.getBoundingClientRect()
      const share = age / HEART_SHOWS
      const x = box.left + ((heartFrom.x + 1) / 2) * box.width + heart.side * HEART_SCATTER * Math.min(1, age / 1.2) + Math.sin(age * 1.8 + k) * HEART_LOOP
      const y = box.top + ((1 - heartFrom.y) / 2) * box.height - HEART_RISE * (1 - (1 - share) ** 2) + Math.cos(age * 1.8 + k) * HEART_LOOP * 0.5
      const pop = age < 0.3 ? 0.6 + (age / 0.3) * 0.55 : Math.max(1, 1.15 - (age - 0.3) * 0.5)
      mark.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) rotate(${heart.side * 12 + Math.sin(age * 1.8 + k) * 8}deg) scale(${pop})`
    })
  }
  /** The ending a frame on: the dawn, the hearts, the fade and the title. */
  function outroFrame() {
    heartsFrame()
    if (!ending.running()) return
    dawnFrame(morningOf(ending.t))
    // Hidden until each shows, not only see-through: else Tab and a screen reader find them long before the ending.
    if (outroCard) {
      outroCard.style.opacity = String(fadeOf(ending.t))
      outroCard.style.visibility = fadeOf(ending.t) > 0 ? '' : 'hidden'
    }
    if (outroTitle) outroTitle.style.opacity = String(titleOf(ending.t))
    if (outroAgain) {
      outroAgain.style.opacity = String(againOf(ending.t))
      outroAgain.style.pointerEvents = againShown() ? 'auto' : 'none'
      outroAgain.style.visibility = againShown() ? '' : 'hidden'
    }
    if (outroBy) {
      outroBy.style.opacity = String(byOf(ending.t) * 0.75)
      outroBy.style.pointerEvents = byOf(ending.t) > 0 ? 'auto' : 'none'
      outroBy.style.visibility = byOf(ending.t) > 0 ? '' : 'hidden'
    }
  }
  /** The swarm's lights with the dawn's first: reaching out from the two of them as it comes up, the rats draining off out of it. */
  function withDawn(lights: FixedLight[]): FixedLight[] {
    if (!ending.stage) return lights
    const reach = DRAIN * dawnOf(ending.t)
    return reach > 0 ? [{ x: ending.stage.pair.x, z: ending.stage.pair.z, reach, on: true }, ...lights] : lights
  }
  return ending
}

/** The ending as the page has it. */
export type Ending = ReturnType<typeof createEnding>
