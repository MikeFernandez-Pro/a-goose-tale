// What the game is heard doing, frame by frame: the music, his feet and his calls, his goslings' peeps and the words written
// over them, the fires, the pond, the wind, the ghosts, the scenes' sounds and the rats.
import type { GooseSounds, Loop as SoundLoop } from './goosesounds'
import type { GoosePlay } from '../game/gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Goslings } from '../characters/goslings'
import type { Goose } from '../characters/goose'
import type { Rats } from '../swarm/rats'
import type { Ghosts } from '../characters/ghosts'
import type { IslandGeese } from '../characters/islandgeese'
import { type PondLook, swimmingIn, shoreAt } from '../world/pond'
import type { Settings, GooseFeel } from '../settings'
import type { Opening } from '../game/opening'
import type { Ending } from '../game/ending'
import { type PerspectiveCamera, type WebGPURenderer, Vector3 } from 'three/webgpu'
import { url, noPanel, filming } from '../game/address'
import { createGooseMusic } from './goosemusic'
import { createPeepWords } from '../ui/callhint'
import { OUTRO, goslingOf, peepsOf } from '../game/gooseoutro'
import { INTRO, CHAT, litShare } from '../game/gooseintro'
import type { PlayerInput } from '../ui/gooseinput'

/** How near he comes for a gosling waiting to see him, m. */
export const EXCITED_FROM = 7
/** A gosling's head over his feet, m. */
const GOSLING_HEAD = 0.3
/** How far from him a ghost is heard, m, and the pause between its moans, s. */
export const GHOST_HEARD = 18

/** The sounds on what the page has made. `loaded` whether the page has loaded. */
export function createGooseHeard({ gooseSounds, goosePlay, goslings, goose, rats, ghosts, islandGeese, pondLook, burningTreeLight, run, settings, feel, opening, ending, input, camera, renderer, dev, hisAt, standAt, torchFilledOnce, loaded }: {
  gooseSounds: GooseSounds | undefined
  goosePlay: GoosePlay<PlaySwarm>
  goslings: Goslings
  goose: Goose
  rats: Rats
  ghosts: Ghosts | undefined
  islandGeese: IslandGeese
  pondLook: PondLook
  burningTreeLight: number
  run: GoosePlay<PlaySwarm>['run']
  settings: Settings
  feel: GooseFeel
  opening: Opening
  ending: Ending
  input: PlayerInput
  camera: PerspectiveCamera
  renderer: WebGPURenderer
  dev: Pick<typeof import('../dev/devtools'), 'mountSoundPanel' | 'mountTakesPanel'> | undefined
  hisAt: () => { x: number; y: number; z: number }
  standAt: (x: number, z: number) => number
  torchFilledOnce: () => boolean
  loaded: () => boolean
}) {
  /** The torch's crackle this frame: its level, of its own; and how much faster it plays. */
  const torchHeard = { level: 0, faster: 1 }
  /**
   * Its music: the track looped under it all (goosesounds.ts' `music`); or, with `?lullaby`, the lullaby made as it plays
   * (goosemusic.ts), growing with his goslings, `?music=N` holding it at layer N. Neither with `?nomusic`.
   */
  const lullaby = url.has('lullaby') || url.has('music')
  const gooseMusic = gooseSounds && lullaby && !url.has('nomusic') ? createGooseMusic(gooseSounds) : undefined
  if (gooseMusic && url.has('music')) gooseMusic.layers = Number(url.get('music'))
  const backgroundMusic = gooseSounds && !lullaby && !url.has('nomusic') ? gooseSounds.loop('music') : undefined
  /**
   * The track silent through the opening, its strike and its quake; once the game is his, coming up from its start over
   * MUSIC_FADE s, slow at first, only while it can be heard (not paused, loaded, the page clicked); going down over
   * MUSIC_FADE_OUT s as the ending starts, its own music (`outro`) played once in its place. `musicIn` how far up.
   */
  const MUSIC_FADE = 8
  const MUSIC_FADE_OUT = 3
  let musicIn = 0
  if (gooseSounds) {
    addEventListener('keydown', (event) => {
      if (event.code !== 'KeyM' || event.repeat || event.target instanceof HTMLInputElement) return
      gooseSounds.muted = !gooseSounds.muted
    })
    if (!noPanel) {
      dev?.mountSoundPanel(gooseSounds, gooseMusic)
      // The takes as ElevenLabs gave them come from the dev server alone.
      if (import.meta.env.DEV) dev?.mountTakesPanel()
    }
  }
  /** Whether the strike's fright has been heard; which goslings were with him last frame. */
  let frightHeard = false
  const withHer: boolean[] = []
  /**
   * A gosling seeing him come: the nearest still waiting, once the goose is EXCITED_FROM m off, peeps happily now and then,
   * the pause between, s, shrinking from its calmest to its quickest as the goose comes to EXCITED_NEAR m, slowly at first
   * and then faster, each drawn EXCITED_JITTER times it, never on a beat; now and then two peeps close together,
   * EXCITED_TWICE of the time; louder as the goose comes. Found, as he comes back to the goose, he peeps FOUND_PEEPS times
   * running, each FOUND_GAP s after the last; a happy peep is written over him, small (`createPeepWords`).
   */
  const EXCITED_NEAR = 1.2
  const EXCITED_PAUSE = [2.4, 0.8] as const
  const EXCITED_JITTER = [0.6, 1.6] as const
  const EXCITED_TWICE = 0.2
  const EXCITED_GAIN = [0.6, 1] as const
  const FOUND_PEEPS = [4, 5] as const
  const FOUND_GAP = [0.09, 0.32] as const
  const peepWords = !filming ? createPeepWords() : undefined
  /** How far over a gosling's head his *peep* is written, m. */
  const PEEP_OVER = 0.06
  const peepHead = new Vector3()
  /** A happy peep from gosling `k`, `after` s from now: heard and written over his head as drawn, up a tree or down a well. */
  function happyPeep(k: number, gain: number, after = 0) {
    const g = goosePlay.goslings[k]
    if (!g) return
    goslings.headOf(k, peepHead)
    peepAt({ x: peepHead.x, y: peepHead.y, z: peepHead.z }, gain, after)
  }
  /** A happy peep from a gosling whose head is at `at`, `after` s from now: heard and written over him. */
  function peepAt(at: { x: number; y: number; z: number }, gain: number, after = 0) {
    gooseSounds?.play('happy_peep', at, gain, after)
    peepWords?.peep({ x: at.x, y: at.y + PEEP_OVER, z: at.z }, after)
  }
  /** How loud each gosling's peeps are as he hops for joy in the ending's ring, many at once; and how far into the ending they have been heard, s. */
  const ENDING_PEEP_GAIN = 0.7
  let endingHeard = -1
  /**
   * The island's goslings seeing their father come: once he is within ISLAND_SEES m of its waterline, one of them, any,
   * peeps now and then, the pause between, s, shrinking as he nears the shore, each drawn ISLAND_JITTER times it, never
   * on a beat, and louder; on through the ending at its quickest, his goslings with them, as they run down to meet
   * him and round the two of them, until they settle in the ring, where each peeps a run of his own (`endingPeepsFrame`).
   */
  const ISLAND_SEES = 12
  const ISLAND_PAUSE = [1.8, 0.45] as const
  const ISLAND_JITTER = [0.6, 1.4] as const
  const ISLAND_GAIN = [0.45, 0.75] as const
  let islandCallWait = 0
  function islandCallsFrame(dt: number) {
    if (!pondLook.island.show || opening.running()) return
    const stage = ending.stage
    let close = 1
    if (stage) {
      if (ending.t >= OUTRO.settle) return
    } else {
      const { holder } = goosePlay
      const { middle } = ending.island
      const dx = holder.x - middle.x
      const dz = holder.z - middle.z
      const off = Math.hypot(dx, dz) - ending.island.shoreAt(Math.atan2(dz, dx))
      if (off > ISLAND_SEES) {
        islandCallWait = 0
        return
      }
      close = Math.min(1, Math.max(0, (ISLAND_SEES - off) / (ISLAND_SEES - OUTRO.near)))
    }
    islandCallWait -= dt
    if (islandCallWait > 0) return
    islandCallWait = (ISLAND_PAUSE[0] + (ISLAND_PAUSE[1] - ISLAND_PAUSE[0]) * close) * (ISLAND_JITTER[0] + Math.random() * (ISLAND_JITTER[1] - ISLAND_JITTER[0]))
    const island = stage ? [...ending.brood.map((k) => goosePlay.goslings[k]!), ...stage.island.map((_, j) => goslingOf(stage, false, j, ending.t).at)] : islandGeese.cast().goslings
    const at = island[Math.floor(Math.random() * island.length)]
    if (at) peepAt({ x: at.x, y: standAt(at.x, at.z) + GOSLING_HEAD, z: at.z }, ISLAND_GAIN[0] + (ISLAND_GAIN[1] - ISLAND_GAIN[0]) * close)
  }
  /** Every gosling in the ending's ring, his and the island's, peep peep peep as he hops for joy: those due since the last frame. */
  function endingPeepsFrame() {
    const stage = ending.stage
    if (!stage || !ending.running()) return
    const from = endingHeard
    endingHeard = ending.t
    const due = (brood: boolean, k: number) => peepsOf(stage, brood, k).some((t) => t > from && t <= ending.t)
    ending.brood.forEach((k, i) => due(true, i) && happyPeep(k, ENDING_PEEP_GAIN))
    stage.island.forEach((_, j) => {
      if (!due(false, j)) return
      const { at, act } = goslingOf(stage, false, j, ending.t)
      peepAt({ x: at.x, y: standAt(at.x, at.z) + (act?.lift ?? 0) + GOSLING_HEAD, z: at.z }, ENDING_PEEP_GAIN)
    })
  }
  const peepOn = new Vector3()
  /** The peeps' words laid out where the camera sees their goslings, `dt` s on. */
  function peepWordsFrame(dt: number) {
    if (!peepWords) return
    const box = renderer.domElement.getBoundingClientRect()
    peepWords.update(dt, (at) => {
      peepOn.set(at.x, at.y, at.z).project(camera)
      if (peepOn.z > 1 || Math.abs(peepOn.x) > 1 || Math.abs(peepOn.y) > 1) return null
      return { x: box.left + ((peepOn.x + 1) / 2) * box.width, y: box.top + ((1 - peepOn.y) / 2) * box.height }
    })
  }
  let excitedWait = 0
  /** The nearest gosling still waiting, if the goose has lit his torch once and the gosling is within EXCITED_FROM m, peeping the quicker the nearer the goose comes. */
  function excitedFrame(dt: number) {
    if (!gooseSounds || opening.running() || dt <= 0 || !torchFilledOnce()) return
    const { holder } = goosePlay
    let near = -1
    let off = EXCITED_FROM
    goosePlay.goslings.forEach((g, k) => {
      const d = g?.state === 'waiting' ? Math.hypot(g.x - holder.x, g.z - holder.z) : Infinity
      if (d < off) {
        near = k
        off = d
      }
    })
    if (near < 0) return
    excitedWait -= dt
    if (excitedWait > 0) return
    const close = Math.min(1, Math.max(0, (EXCITED_FROM - off) / (EXCITED_FROM - EXCITED_NEAR)))
    const eased = close * close
    excitedWait = (EXCITED_PAUSE[0] + (EXCITED_PAUSE[1] - EXCITED_PAUSE[0]) * eased) * (EXCITED_JITTER[0] + Math.random() * (EXCITED_JITTER[1] - EXCITED_JITTER[0]))
    const gain = EXCITED_GAIN[0] + (EXCITED_GAIN[1] - EXCITED_GAIN[0]) * close
    happyPeep(near, gain)
    if (Math.random() < EXCITED_TWICE) happyPeep(near, gain * 0.9, FOUND_GAP[0] + Math.random() * (FOUND_GAP[1] - FOUND_GAP[0]))
  }
  /**
   * The last gosling waiting ahead for the goose to follow: once he has stood GUIDE_CALLS_AFTER s, a small peep, quieter than
   * his happy ones, and another every GUIDE_CALL_PAUSE s or so for as long as the goose keeps him waiting.
   */
  const GUIDE_CALLS_AFTER = 1.5
  const GUIDE_CALL_PAUSE = [2.5, 5] as const
  const GUIDE_CALL_GAIN = 0.6
  let guideCallWait = 0
  function guideCallFrame(dt: number) {
    if (ending.running() || goosePlay.guideWaits < GUIDE_CALLS_AFTER) {
      guideCallWait = 0
      return
    }
    guideCallWait -= dt
    if (guideCallWait > 0) return
    guideCallWait = GUIDE_CALL_PAUSE[0] + Math.random() * (GUIDE_CALL_PAUSE[1] - GUIDE_CALL_PAUSE[0])
    happyPeep(goosePlay.guide, GUIDE_CALL_GAIN)
  }
  /**
   * The goslings' fright in the opening: at the strike each peeps twice as they cower, at his own times, s after it;
   * bolting, each peeps over and over as he runs, every so often, s: heard going off
   * every way into the dark. A gosling runs while he goes faster than PANIC_PACE m/s, and slower than a jump to his place.
   */
  const COWER_PEEPS = [
    [0.05, 0.35],
    [0.45, 0.8],
  ] as const
  const PANIC_PEEPS = [0.16, 0.28] as const
  const PANIC_PACE = [1.5, 20] as const
  const panicWait: number[] = []
  const goslingWas: ({ x: number; z: number } | undefined)[] = []
  /**
   * His honks after his shouts, heard only, s into the opening and how loud: he goes on calling after his goslings
   * once they are out of sight, a little quieter.
   */
  const CALLS_AFTER = [{ at: INTRO.rush + 1, gain: 0.85 }] as const
  /**
   * The opening's chatter as they walk (CHAT): a gosling's happy peep, written over him, or the goose's soft answer, heard and
   * written over his head as small as a peep, HIS_WORD; how loud the goslings are, and how far over him the word goes, m.
   */
  const HIS_WORD = '*honk*'
  const CHAT_GAIN = 0.75
  const HIS_HEAD = 0.95
  let chatHeard = 0
  function chatFrame() {
    for (let line = CHAT[chatHeard]; line && opening.t >= line.at; line = CHAT[++chatHeard]) {
      // Skipped past, or come to the strike: unsaid.
      if (!opening.running() || opening.t >= INTRO.strike) continue
      if (typeof line.who === 'number') {
        const found = opening.brood()
        if (found.length) happyPeep(found[line.who % found.length]!, CHAT_GAIN)
        continue
      }
      gooseSounds?.play(line.who, hisAt())
      const { position } = goose.object
      peepWords?.peep({ x: position.x, y: position.y + HIS_HEAD, z: position.z }, 0, HIS_WORD)
    }
  }
  /** The opening's own clock, s, run on past its end for his last honks; whether it was skipped, which hushes them. */
  let openingClock = 0
  let openingSkipped = false
  let callsAfterHeard = 0
  /** The pause between his sounds of his own as he walks, s, and the share of them that are a soft questioning honk, the rest muttered grunts. */
  const MUTTER_PAUSE = [14, 32] as const
  const QUERIES = 0.35
  let mutterWait = MUTTER_PAUSE[1]
  /** The fires as heard: the burning tree's crackle, every other lit fire's calm burning, his torch's; the pond; the wind and the leaves everywhere. */
  const fireLoops: SoundLoop[] = []
  const torchLoop = gooseSounds?.loop('torch')
  const pondLoop = gooseSounds?.loop('river_calm')
  const windLoop = gooseSounds?.loop('wind')
  const leavesLoop = gooseSounds?.loop('leaves')
  /**
   * His sounds, `dt` s on: his feet on land and his paddling in the pond, his goslings' after his; the fright as the
   * strike lands and his calls after them once they bolt; a gosling's happy peeps as he comes to the little one, and as the little one comes
   * back to him; a sound of his own now and then; the fires, the pond, the wind and the leaves; the rats. Paused or
   * loading, all hushed.
   */
  function gooseSoundsFrame(dt: number) {
    if (!gooseSounds) return
    gooseSounds.hushed = settings.paused || !loaded()
    gooseMusic?.frame(!opening.running(), goosePlay.circle, goosePlay.goslings.filter(Boolean).length)
    if (backgroundMusic) {
      if (ending.running()) musicIn = Math.max(0, musicIn - dt / MUSIC_FADE_OUT)
      else if (!opening.running() && !gooseSounds.hushed && gooseSounds.context.state === 'running') musicIn = Math.min(1, musicIn + dt / MUSIC_FADE)
      backgroundMusic.set(musicIn * musicIn)
    }
    const at = hisAt()
    gooseSounds.walk(at, dt, swimmingIn(pondLook, at.x, at.z, pondLook.goose), goose.footfalls)
    goosePlay.goslings.forEach((g, k) => {
      if (!g) return
      const here = { x: g.x, y: standAt(g.x, g.z) + 0.1, z: g.z }
      gooseSounds.patter(k, here, dt, swimmingIn(pondLook, g.x, g.z, pondLook.gosling))
      const back = g.state !== 'waiting'
      // Back with him: a run of happy peeps, each after the last at a gap of its own.
      if (back && withHer[k] === false && !opening.running()) {
        const [least, most] = FOUND_PEEPS
        const peeps = least + Math.floor(Math.random() * (most - least + 1))
        for (let p = 0, after = 0; p < peeps; p++, after += FOUND_GAP[0] + Math.random() * (FOUND_GAP[1] - FOUND_GAP[0])) happyPeep(k, 1, after)
      }
      withHer[k] = back
    })
    excitedFrame(dt)
    guideCallFrame(dt)
    islandCallsFrame(dt)
    endingPeepsFrame()
    chatFrame()
    if (opening.on && !openingSkipped) {
      openingClock += dt
      if (!opening.running() && openingClock < INTRO.end - 0.1) openingSkipped = true
    }
    if (opening.running() && !frightHeard && opening.t >= INTRO.strike) {
      frightHeard = true
      gooseSounds.play('fright', at)
      const tree = run.lights()[burningTreeLight]
      if (tree) gooseSounds.play('thunder', { x: tree.x, y: standAt(tree.x, tree.z) + 2, z: tree.z })
      opening.brood().forEach((k) => {
        const g = goosePlay.goslings[k]!
        const here = { x: g.x, y: standAt(g.x, g.z) + 0.2, z: g.z }
        for (const [soonest, latest] of COWER_PEEPS) gooseSounds.play('cower_peep', here, 1, soonest + Math.random() * (latest - soonest))
      })
    }
    goosePlay.goslings.forEach((g, k) => {
      const was = goslingWas[k]
      goslingWas[k] = g && { x: g.x, z: g.z }
      if (!g || !was || dt <= 0 || !opening.running() || opening.t < INTRO.bolt || goosePlay.plain.braziers[k]!.follows !== undefined) return
      const pace = Math.hypot(g.x - was.x, g.z - was.z) / dt
      if (pace < PANIC_PACE[0] || pace > PANIC_PACE[1]) return
      panicWait[k] = (panicWait[k] ?? Math.random() * PANIC_PEEPS[0]) - dt
      if (panicWait[k]! > 0) return
      panicWait[k] = PANIC_PEEPS[0] + Math.random() * (PANIC_PEEPS[1] - PANIC_PEEPS[0])
      gooseSounds.play('panic_peep', { x: g.x, y: standAt(g.x, g.z) + 0.2, z: g.z })
    })
    const after = CALLS_AFTER[callsAfterHeard]
    if (after && !openingSkipped && openingClock >= after.at) {
      callsAfterHeard++
      gooseSounds.play('honk', at, after.gain)
    }
    if (!opening.running() && dt > 0) {
      mutterWait -= dt
      if (mutterWait <= 0) {
        mutterWait = MUTTER_PAUSE[0] + Math.random() * (MUTTER_PAUSE[1] - MUTTER_PAUSE[0])
        gooseSounds.play(Math.random() < QUERIES ? 'query' : 'mutter', at)
      }
    }
    run.lights().forEach((light, k) => {
      const loop = (fireLoops[k] ??= gooseSounds.loop(k === burningTreeLight ? 'fire_crackling' : 'fire_calm'))
      loop.set(k === burningTreeLight ? litShare(opening.t) : light.on ? 1 : 0, { x: light.x, y: standAt(light.x, light.z) + 0.6, z: light.z })
    })
    torchLoop?.set(torchHeard.level, { x: at.x, y: at.y + 0.5, z: at.z }, torchHeard.faster)
    // From the shore nearest him, or from him once he is in.
    const dx = at.x - pondLook.x
    const dz = at.z - pondLook.z
    const off = Math.hypot(dx, dz) || 1
    const shore = Math.min(off, shoreAt(pondLook, Math.atan2(dz, dx)))
    pondLoop?.set(1, { x: pondLook.x + (dx / off) * shore, y: at.y, z: pondLook.z + (dz / off) * shore })
    windLoop?.set(1)
    leavesLoop?.set(1)
    ratsHeardFrame()
    scenesHeardFrame(dt, at)
  }
  /** The pause between a ghost's moans, s. */
  const GHOST_PAUSE = [5, 11] as const
  let ghostWait = GHOST_PAUSE[0]
  /** Now and then, the ghost nearest him moans, from where it walks, if near enough. */
  function ghostsHeardFrame(dt: number) {
    if (!ghosts || !gooseSounds || opening.running() || dt <= 0) return
    ghostWait -= dt
    if (ghostWait > 0) return
    ghostWait = GHOST_PAUSE[0] + Math.random() * (GHOST_PAUSE[1] - GHOST_PAUSE[0])
    const { holder } = goosePlay
    const away = (g: { x: number; z: number }) => Math.hypot(g.x - holder.x, g.z - holder.z)
    const nearest = ghosts.lights.reduce<(typeof ghosts.lights)[number] | undefined>((best, g) => (!best || away(g) < away(best) ? g : best), undefined)
    if (nearest && away(nearest) < GHOST_HEARD) gooseSounds.play('moan', { x: nearest.x, y: standAt(nearest.x, nearest.z) + 1, z: nearest.z })
  }
  /**
   * His torch catching, heard once each time: as it lights, out, at a fire; and lit, as he starts holding to top it up
   * there, not quite full. The well's winch, heard while its bucket winds up, and quicker as it drops back; the cage's padlock giving
   * and its door creaking open as it unlocks.
   */
  let litWas = true
  let toppingWas = false
  const winchUp = gooseSounds?.loop('winch')
  const winchDown = gooseSounds?.loop('winch', 1.8)
  const woundWas: number[] = []
  const unlockedWas: boolean[] = []
  /** When each cage's key was last heard taken, s of the play. */
  const takenHeard: number[] = []
  let fallingWas = false
  function scenesHeardFrame(dt: number, at: { x: number; y: number; z: number }) {
    if (!gooseSounds || dt <= 0) return
    const lit = goosePlay.run.torch.lit
    const topping = lit && goosePlay.atRefill && input.commands.interact
    if ((lit && !litWas) || (topping && !toppingWas && goosePlay.run.fuel < 0.98)) gooseSounds.play('ignite', { x: at.x, y: at.y + 0.5, z: at.z })
    litWas = lit
    toppingWas = topping
    // His death, as he falls.
    const falling = !Number.isNaN(goosePlay.fallen)
    if (falling && !fallingWas) gooseSounds.play('death')
    fallingWas = falling
    let up = 0
    let down = 0
    let well = at
    goosePlay.scenes.forEach((scene, s) => {
      const here = { x: scene.x, y: standAt(scene.x, scene.z) + 0.8, z: scene.z }
      if (scene.kind === 'well') {
        const turned = scene.wound - (woundWas[s] ?? scene.wound)
        woundWas[s] = scene.wound
        if (turned > 0) up = 1
        if (turned < 0) down = 1
        if (turned !== 0) well = here
      } else if (scene.kind === 'cage') {
        const unlocked = !Number.isNaN(scene.unlockedAt)
        if (unlocked && unlockedWas[s] === false) gooseSounds.play('padlock', here)
        unlockedWas[s] = unlocked
        // Its key taken up: heard from where it lay, and the gosling in the cage, seeing it, peeps once.
        if (!Number.isNaN(scene.takenAt) && scene.takenAt !== takenHeard[s]) {
          takenHeard[s] = scene.takenAt
          gooseSounds.play('key', { x: scene.key.x, y: standAt(scene.key.x, scene.key.z) + 0.2, z: scene.key.z })
          if (feel.key.peep > 0) happyPeep(scene.brazier, feel.key.peep, feel.key.peepAfter)
        }
      }
    })
    winchUp?.set(up, well)
    winchDown?.set(down, well)
  }
  /**
   * The swarm heard in its three rings (goosesounds.ts), all as the rats in view are many, RATS_LOUD and more the most;
   * none before the rush: the far ring first, full at a share FAR_FULL of that; the near ring as they are many. And as
   * A Plague Tale's rats tell the player of their state, the edge, the rats running hardest at his light's edge: a little,
   * EDGE[0] of it, while his torch burns well, the more as it burns down past DANGER_FROM of its fuel, all of it once out.
   */
  const RATS_LOUD = 300
  const FAR_FULL = 0.4
  const EDGE = [0.1, 1] as const
  const DANGER_FROM = 0.3
  const swarmFar = gooseSounds?.loop('swarm_far')
  const swarmNear = gooseSounds?.loop('swarm_near')
  const swarmEdge = gooseSounds?.loop('swarm_edge')
  function ratsHeardFrame() {
    if (!gooseSounds) return
    const many = rats.object.visible ? Math.min(1, rats.drawn / RATS_LOUD) : 0
    const { torch, fuel } = goosePlay.run
    const danger = !torch.lit ? 1 : Math.max(0, 1 - fuel / DANGER_FROM)
    swarmFar?.set(Math.min(1, many / FAR_FULL))
    swarmNear?.set(many)
    swarmEdge?.set(many * (EDGE[0] + (EDGE[1] - EDGE[0]) * danger))
  }
  return {
    torchHeard,
    /** When each cage's key was last heard taken, s of the play. */
    takenHeard,
    frame: gooseSoundsFrame,
    ghostsFrame: ghostsHeardFrame,
    wordsFrame: peepWordsFrame,
  }
}
