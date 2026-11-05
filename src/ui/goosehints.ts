// What is written over the game to lead the player: the hold indicator over him, the calling gosling's badge and his honks,
// and what to do written over where it is done.
import { type GoosePlay, inZone, type SceneState, type Zone } from '../game/gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Goslings } from '../characters/goslings'
import type { GooseSounds } from '../sound/goosesounds'
import type { Opening } from '../game/opening'
import type { Ending } from '../game/ending'
import type { PlayerInput } from './gooseinput'
import { type PerspectiveCamera, type WebGPURenderer, Vector3 } from 'three/webgpu'
import { filming, url, phone, featureOn, noPanel } from '../game/address'
import { createHoldHint, promptedOf } from './holdhint'
import { createGoslingBadge, mountBadgeControls } from './goslingbadge'
import { createCallHint, type CallAt, callAt } from './callhint'
import { touchLayout, STICK_REACH, BUTTON_RADIUS } from './goosetouch'
import { EXCITED_FROM } from '../sound/gooseheard'

/** The hints on what the page has made. */
export function createGooseHints({ goosePlay, goslings, gooseSounds, opening, ending, input, camera, renderer, dev, standAt, torchFilledOnce, burningTreeLight }: {
  goosePlay: GoosePlay<PlaySwarm>
  goslings: Goslings
  gooseSounds: GooseSounds | undefined
  opening: Opening
  ending: Ending
  input: PlayerInput
  camera: PerspectiveCamera
  renderer: WebGPURenderer
  dev: Pick<typeof import('../dev/devtools'), 'GUI'> | undefined
  standAt: (x: number, z: number) => number
  torchFilledOnce: () => boolean
  burningTreeLight: number
}) {
  /**
   * The game's hold indicator, over the goose while he is by the burning branch lying there, at the well or the dead tree (#190), at the cage's skull
   * or the cage (#191); none in a take. A scene the key works now before a fire's dip it overlaps. Where the key does nothing yet, what to do first: at the dead tree with his torch out.
   * At the cage without its key, the hint over the cage says it.
   */
  const holdHint = !filming ? createHoldHint() : undefined
  /** How high over the ground he stands on the indicator's foot, m: over his head. */
  const HINT_HEIGHT = 1.15
  const hintAt = new Vector3()
  /**
   * The hold indicator over him as the camera now sees him: filling as the bucket comes up at the well, as the dead tree
   * catches, as the torch fills at a fire; hidden elsewhere.
   */
  function holdHintFrame(shown: { x: number; z: number }, stood: number) {
    holdShown = false
    if (!holdHint) return
    holdHint.prompt(promptedOf(input.commands))
    if (opening.running() || ending.running() || goosePlay.down) return holdHint.update(null, 0)
    const well = goosePlay.scenes.find((s) => s.kind === 'well' && s.near)
    const winching = well?.kind === 'well'
    const tree = goosePlay.scenes.find((s) => s.kind === 'tree' && s.near)
    const lighting = tree?.kind === 'tree'
    // At the cage with its key, a hold; at the key: one press.
    const cage = goosePlay.scenes.find((s) => s.kind === 'cage' && s.near && s.carried)
    const unlocking = cage?.kind === 'cage'
    const pressing = !unlocking && goosePlay.scenes.some((s) => s.kind === 'cage' && s.near)
    // In a scene's zone, its gosling still in it, the key doing nothing yet.
    const { holder } = goosePlay
    const waiting = (s: { brazier: number }) => goosePlay.goslings[s.brazier]!.state === 'waiting'
    const unlit = goosePlay.scenes.some((s) => s.kind === 'tree' && waiting(s) && Number.isNaN(s.calledAt) && !goosePlay.run.torch.lit && inZone(goosePlay.zoneOf(s), holder))
    // By the burning branch, lying there: one press.
    const branch = goosePlay.atBranch
    if (!winching && !lighting && !unlocking && !pressing && !unlit && !branch && !goosePlay.atRefill) return holdHint.update(null, 0)
    holdShown = true
    hintAt.set(shown.x, stood + HINT_HEIGHT, shown.z).project(camera)
    const box = renderer.domElement.getBoundingClientRect()
    const at = { x: box.left + ((hintAt.x + 1) / 2) * box.width, y: box.top + ((1 - hintAt.y) / 2) * box.height }
    if (branch) holdHint.update(at, 0, 'pick it up!')
    else if (winching) holdHint.update(at, well.wound)
    else if (lighting) holdHint.update(at, tree.catching)
    else if (unlocking) holdHint.update(at, cage.unlocking, 'hold to unlock')
    else if (pressing) holdHint.update(at, 0, 'pick it up')
    else if (goosePlay.atRefill) holdHint.update(at, goosePlay.run.torch.lit ? goosePlay.run.fuel : goosePlay.kindled, torchFilledOnce() ? 'hold to refill' : 'light your torch')
    else holdHint.update(at, 0, 'light your torch', false)
  }
  /**
   * `?marker` (the game's default, the portrait) or `?marker=doodle`: the calling gosling's badge
   * (goslingbadge.ts), there all the time he calls and on over his head as the goose comes, quiet, till the goose has
   * him; its honks small, said rather than shouted, over
   * the gosling's head in view alone, none by the badge, and heard barely far off, louder as the goose comes; and his torch
   * out, or at the cage with its key, what to do written over where it is done (aheadFrame).
   */
  const badgeLook = url.get('marker') === 'doodle' ? 'doodle' : 'portrait'
  /**
   * On a phone, the badge fitted to the screen: as drawn on a short side of BADGE_FIT_SIDE px, smaller on a smaller one,
   * never larger, and read each frame, so it follows the phone turned; elsewhere as drawn.
   */
  const BADGE_FIT_SIDE = 800
  const badgeFit = () => (phone ? Math.min(1, Math.min(innerWidth, innerHeight) / BADGE_FIT_SIDE) : 1)
  const callBadge = !filming && featureOn('marker') ? createGoslingBadge(badgeLook, badgeFit) : undefined
  if (dev && callBadge && badgeLook === 'portrait' && !noPanel) mountBadgeControls(dev.GUI)
  /** The badge's honk, as said, and how big it is written; whether its gosling is in view, for it to be written at all. */
  const BADGE_WORD = '*honk*'
  const BADGE_CALL = 0.5
  let callSeen = false
  /** How loud the badge's gosling calls, far off (CALL_FAR m) and near (CALL_QUIET m): barely heard, then louder as the goose comes. */
  const BADGE_HEARD = [0.08, 1] as const
  /** The nearest waiting gosling's call, over him or at the screen's edge on his side (callhint.ts); none in a take. */
  const callHint =
    !filming
      ? createCallHint(
          (far) => {
            const heard = callBadge ? BADGE_HEARD[1] + (BADGE_HEARD[0] - BADGE_HEARD[1]) * far : CALL_HEARD[0] + (CALL_HEARD[1] - CALL_HEARD[0]) * far
            gooseSounds?.play('call', callHeard, heard)
            callBadge?.pop()
          },
          // Out of view, written nowhere.
          callBadge && (() => (callSeen ? BADGE_WORD : '')),
        )
      : undefined
  /** Where the gosling calling is heard from, m; how loud he calls, near and far: louder far, as his word is bigger. */
  const callHeard = new Vector3()
  const CALL_HEARD = [0.7, 1.3] as const
  /** How near the goose comes for him to call his smallest, m. */
  const CALL_QUIET = 3
  /** How big he calls at CALL_QUIET m off, growing to CALL_LOUDEST at CALL_FAR m off or further: a far gosling calls louder for the goose. */
  const CALL_NEAREST = 0.85
  const CALL_LOUDEST = 1.5
  const CALL_FAR = 20
  /** How near the goose comes for the badge to start shrinking, m, smallest at CALL_QUIET m: he is nearly there. */
  const BADGE_SHRINKS_FROM = 10
  /** How fast the goose walks away from the gosling for him to call his most urgently, m/s; how long his urgency takes to follow the goose, s. */
  const CALL_HURRY = 1
  const CALL_SETTLE = 0.4
  /** How far in from the screen's edge a call out of view sits, px, whatever its size. */
  const CALL_MARGIN = 120
  /** How far in from it the badge sits out of view, px, further in than the words, fitted to a phone's screen as the badge is. */
  const BADGE_MARGIN = 160
  /** How far clear of the touch stick and button a badge out of view keeps, px. */
  const BADGE_THUMBS_GAP = 10
  /** A badge out of view reaching `reach` px from `at` lifted clear of the touch stick and button while they show. */
  function clearOfThumbs(at: CallAt, reach: number) {
    if (!input.thumbsShown || !at.out) return
    const layout = touchLayout(input.viewport())
    for (const [middle, radius] of [[layout.stick, STICK_REACH], [layout.button, BUTTON_RADIUS]] as const) {
      const clear = radius + reach + BADGE_THUMBS_GAP
      const across = at.x - middle.x
      if (Math.abs(across) < clear) at.y = Math.min(at.y, middle.y - Math.sqrt(clear * clear - across * across))
    }
  }
  const CALL_HEIGHT = 0.05
  const callFrom = new Vector3()
  /** The gosling calling, how far off the goose was last frame, m, and how urgently he calls, -1 the goose comes to 1 the goose goes. */
  let calling = -1
  let callAway = 0
  let callUrgency = 0
  /** How long the calls rest after a gosling is found, s; how long is left of it; and how many goslings were still waiting. */
  const CALL_REST = 2
  let callRest = 0
  let stillWaiting = -1
  /**
   * Whether what to do is written this frame, over him (holdHintFrame) or where it is done (aheadFrame): he is there,
   * so the badge, saying where to go, hides in view, lest it lie over the words.
   */
  let holdShown = false
  let aheadShown = false
  /** But a well's gosling's badge stays over him with the words till the goose is this near him, m: nearly at the well. */
  const BADGE_AT_WELL = 4
  const badgeShown = (at: CallAt, kid: number, off: number) => {
    const atWell = goosePlay.scenes.some((s) => s.brazier === kid && s.kind === 'well') && off > BADGE_AT_WELL
    return !at.out && (holdShown || (aheadShown && !atWell)) ? 0 : 1
  }
  /** How long after the opening the first gosling calls, the goose's torch lit or not, s; and how long since it ended. */
  const CALL_AFTER_INTRO = 1
  let sinceIntro = 0
  /**
   * The nearest gosling still waiting calling him, till he finds the little one: only the nearest, so one passed by falls quiet as
   * he goes on, and he need not find them all. Once he is within EXCITED_FROM m the gosling stops calling: the little one has seen him
   * coming, and peeps happily instead (excitedFrame). With none left waiting, the badge stays on the gosling leading him home, quiet, till the ending.
   */
  function callHintFrame(dt: number) {
    if (!callHint || opening.running()) return
    if (ending.running()) {
      callBadge?.update(null, 0, dt)
      return callHint.update(null, dt)
    }
    // One just found, the rest wait CALL_REST s before the next calls: he has the little one back first.
    const waiting = goosePlay.goslings.filter((g) => g?.state === 'waiting').length
    if (stillWaiting >= 0 && waiting < stillWaiting) callRest = CALL_REST
    stillWaiting = waiting
    callRest = Math.max(0, callRest - dt)
    sinceIntro += dt
    const { holder } = goosePlay
    const away = (g: { x: number; z: number }) => Math.hypot(g.x - holder.x, g.z - holder.z)
    let next = -1
    goosePlay.goslings.forEach((g, k) => {
      if (g?.state === 'waiting' && (next < 0 || away(g) < away(goosePlay.goslings[next]!))) next = k
    })
    // Found the moment the goose is in the pond's water, the last has all the way to the island still to lead him: no rest for his badge.
    const guiding = next < 0 && !!callBadge && goosePlay.goslings[goosePlay.guide]?.state === 'guiding'
    if (guiding) next = goosePlay.guide
    const g = goosePlay.goslings[next]
    const off = g ? away(g) : Infinity
    // Let out of his cage, he is found: no badge, no call, while its door opens and he walks out.
    const freed = goosePlay.scenes.some((s) => s.brazier === next && s.kind === 'cage' && s.open)
    if (!g || freed || (callRest > 0 && !guiding) || sinceIntro < CALL_AFTER_INTRO) {
      calling = -1
      callBadge?.update(null, 0, dt)
      return callHint.update(null, dt)
    }
    // Over his head as drawn, up a tree or down a well.
    goslings.headOf(next, callFrom)
    callFrom.y += CALL_HEIGHT
    callHeard.copy(callFrom)
    callFrom.project(camera)
    const box = renderer.domElement.getBoundingClientRect()
    const at = callAt(callFrom, box, callBadge ? BADGE_MARGIN * badgeFit() : CALL_MARGIN)
    if (callBadge) clearOfThumbs(at, callBadge.edgeReach)
    const close = Math.min(1, Math.max(0, (BADGE_SHRINKS_FROM - off) / (BADGE_SHRINKS_FROM - CALL_QUIET)))
    // Seen the goose, he peeps instead; his badge stays over him till the goose has him.
    if (off < EXCITED_FROM || guiding) {
      calling = -1
      callBadge?.update(at, badgeShown(at, next, off), dt, next, close)
      return callHint.update(null, dt)
    }
    if (next !== calling) {
      calling = next
      callUrgency = 0
    } else if (dt > 0) {
      const going = Math.min(1, Math.max(-1, (off - callAway) / dt / CALL_HURRY))
      callUrgency += (going - callUrgency) * (1 - Math.exp(-dt / CALL_SETTLE))
    }
    callAway = off
    const far = Math.min(1, Math.max(0, (off - CALL_QUIET) / (CALL_FAR - CALL_QUIET)))
    const size = CALL_NEAREST + (CALL_LOUDEST - CALL_NEAREST) * far
    if (!callBadge) return callHint.update({ ...at, size, far, urgency: callUrgency }, dt)
    callBadge.update(at, badgeShown(at, next, off), dt, next, close)
    callSeen = !at.out
    callHint.update({ x: at.x, y: at.y, size: BADGE_CALL, far, urgency: callUrgency }, dt)
  }

  /**
   * `?marker`: what to do, written over where it is done, at the screen's edge on its side out of view, only
   * where the badge does not already say it: near the well, over its winch; near the dead tree, over where the gosling is called
   * down, or with the goose's torch out, over its fire; at the cage, over the cage, to find its key, then with it to unlock it;
   * nothing near a ghost's gosling. Never over a fire for his torch out: the hold indicator over him says it once he is at one.
   * But for the start: 'pick it up!' over the burning branch from the moment it lands, the opening still playing, till he
   * is by it; or, with no branch, his torch never yet lit, START_HINT_AFTER s after the opening without his going to it,
   * 'light your torch' over the burning tree's foot, till he lights it.
   * Gone once he can work it, the hold indicator over him then.
   */
  const aheadHint = callBadge ? createHoldHint() : undefined
  /** How near its gosling he is for it, m; how high over the ground it is written, m. */
  const AHEAD_FROM = EXCITED_FROM + 1
  const AHEAD_HEIGHT = 0.9
  /** How high over the ground it is written over the burning branch, m: lower, for the branch lies flat. */
  const AHEAD_BRANCH_HEIGHT = 0.6
  /** How long after the opening, his torch never lit and he not at the burning tree's fire, the burning tree's hint waits, s. */
  const START_HINT_AFTER = 4
  const aheadAt = new Vector3()
  function aheadFrame() {
    aheadShown = false
    if (!aheadHint) return
    const { branch } = goosePlay
    const branchLying = branch !== undefined && !branch.carried && branch.landed
    // In the opening, the branch's alone, Space skipping it till it ends.
    if ((opening.running() && !branchLying) || ending.running() || goosePlay.atRefill || (goosePlay.atBranch && !opening.running()) || goosePlay.scenes.some((s) => s.near)) return aheadHint.update(null, 0)
    const { holder } = goosePlay
    const box = renderer.domElement.getBoundingClientRect()
    if (branch && branchLying) {
      aheadAt.set(branch.x, standAt(branch.x, branch.z) + AHEAD_BRANCH_HEIGHT, branch.z).project(camera)
      aheadShown = true
      const at = callAt(aheadAt, box, CALL_MARGIN)
      return aheadHint.update(at, 0, 'pick it up!', false, at.out ? Math.atan2(at.out.y, at.out.x) : Math.PI / 2)
    }
    if (!branch && burningTreeLight >= 0 && !torchFilledOnce() && sinceIntro >= START_HINT_AFTER) {
      const tree = goosePlay.level.lights[burningTreeLight]!
      aheadAt.set(tree.x, standAt(tree.x, tree.z) + AHEAD_HEIGHT, tree.z).project(camera)
      aheadShown = true
      return aheadHint.update(callAt(aheadAt, box, CALL_MARGIN), 0, 'light your torch', false)
    }
    const scene = goosePlay.scenes.find((s) => {
      const g = goosePlay.goslings[s.brazier]
      return g?.state === 'waiting' && Math.hypot(g.x - holder.x, g.z - holder.z) < AHEAD_FROM
    })
    const ahead = scene && aheadOf(scene)
    if (!ahead) return aheadHint.update(null, 0)
    const { x, z } = ahead.zone
    aheadAt.set(x, standAt(x, z) + AHEAD_HEIGHT, z).project(camera)
    aheadShown = true
    // An arrow under the words, down at the place in view, out toward it at the edge, as the badge's.
    const at = callAt(aheadAt, box, CALL_MARGIN)
    aheadHint.update(at, 0, ahead.word, false, at.out ? Math.atan2(at.out.y, at.out.x) : Math.PI / 2)
  }
  /**
   * What to do at `scene` now, and where, where the badge does not say it: the well's winch; the dead tree, from where
   * the gosling is called down, or its fire with the goose's torch out; the cage, its key to find or with it.
   */
  function aheadOf(scene: SceneState): { zone: Zone; word: string } | undefined {
    const play = goosePlay
    if (scene.kind === 'well') return { zone: play.zoneOf(scene), word: 'winch it up' }
    if (scene.kind === 'tree') {
      if (!Number.isNaN(scene.calledAt)) return undefined
      return play.run.torch.lit ? { zone: play.zoneOf(scene), word: 'call him down' } : { zone: play.fireZoneOf(scene), word: 'light your torch' }
    }
    if (scene.kind === 'cage' && !scene.open) return { zone: play.zoneOf(scene), word: scene.carried ? 'unlock it' : 'find the key' }
    return undefined
  }
  return { holdHintFrame, callHintFrame, aheadFrame }
}
