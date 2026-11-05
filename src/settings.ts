// What the page tunes and reads: the swarm's settings, the scene's look and how the goose feels. The panel edits them,
// but they are the game's: a page with no panel reads them the same.
import type { FeatherLook } from './characters/feathers'
import type { GooseLook } from './characters/goose'
import type { KeyTaken } from './game/goosescenes'
import type { FlameLook } from './light/flame'
import type { AOLook, BloomLook, DofLook, GrainLook, HatchLook, OutlineLook, PaletteLook, ScreenLook, VignetteLook } from './look/post'
import type { PaintLook, ShellLook } from './look/shell'
import type { ToonLook } from './look/toon'
import type { LevelsLook, Part, StaggerLook, TrailLook, Variant } from './swarm/rats'
import type { FloorLook } from './world/ground'

/** What the panel edits. The page reads it, and is told when a group of it changes. */
export interface Settings {
  rats: number
  /** The slowest and fastest rat, m/s, running in for the light. */
  minSpeed: number
  maxSpeed: number
  /** And with its back to the light, whatever turned it, by how squarely it is turned. */
  fleeMinSpeed: number
  fleeMaxSpeed: number
  /** How big a rat is: 1 at its usual size, a body about 0.25 m long. It scales the collision disc with it. */
  size: number
  /** How many times the slowest rat's size the fastest is: 1 all one size. The mean rat stays at `size`, and so does the collision disc. */
  sizeBySpeed: number
  /** How much room a rat keeps round it, on top of its size: 1 as drawn, 2 a disc twice as wide, so half as many fit the same ground. */
  spacing: number
  /** The torch lit, as far as the debug switch goes: out, it is out whatever its fuel. */
  on: boolean
  /** The debug keys: Q and E turn the torch's reach up and down, F puts it out and relights it. Off, they do nothing. */
  debug: boolean
  shadows: boolean
  /** How fast every rat's Run plays: 1 the clip as authored, a 0.5 m bound every half second. */
  runAnimation: number
  /** How fast the goose walks, m/s. */
  goosePace: number
  /** Paused: the swarm, the run and the light's walk all hold; the camera still moves. */
  paused: boolean
  /** Rats left behind in the fog are brought round ahead of a walking light, in the fog still: the crowd it walks into never thins. */
  bringRound: boolean
  /** How far off a rat out of the camera's view is still near enough not to be brought round, m, the fog nearer where it is on: the game's. */
  roundPast?: number
  /** The character drawn, with the torch it carries: its flame, embers and smoke. Off, the light alone stays, burning where the flame would. */
  character: boolean
}

/**
 * How the scene looks, every control in the panel's look folders. Colours are
 * hex numbers; angles are degrees; distances metres.
 */
export interface Look {
  /**
   * The warm light the holder carries: its reach is where it fades to nothing
   * at full strength, and shrinks with the strength as the light's hard radius
   * does; its falloff how fast it gets there, its lag how many seconds it
   * eases after the holder; and whether it burns in the torch's flame, or
   * hangs where a holder's hand would carry it.
   */
  lamp: { color: number; intensity: number; reach: number; falloff: number; lag: number; inFlame: boolean }
  /**
   * The one light from far away: where it sits from the light it follows, in
   * metres, which sets the way it shines; and how soft its shadows' edges are.
   */
  sun: {
    color: number
    intensity: number
    x: number
    y: number
    z: number
    shadows: boolean
    softness: number
    /** How dark its shadows fall: 0 none, 1 none of the sun's light gets in. */
    darkness: number
    /** The colour of the sun's light that gets into its shadows, as far as `darkness` keeps it out: black, none, as three draws a shadow. */
    shadowColor: number
  }
  /** The cold fill: a colour from above, another from below. */
  fill: { sky: number; ground: number; intensity: number }
  /**
   * The fog round the light, on or off, which the sky shares: clear up to `near` metres
   * from the light, solid from `far`, and between them as thick as `density`
   * makes it (1 a plain ramp, more thick soon past near); its edge frayed by
   * wisps of noise `scale` metres wide that push it in and out by up to `wisp`
   * metres and blow along the ground at `drift` m/s. Where the page gives it a `horizon`, the fog and the sky
   * turn to that colour where the look runs level, the fog's own `band` degrees above or below.
   */
  fog: { enabled: boolean; color: number; horizon?: number; band?: number; near: number; far: number; density: number; wisp: number; scale: number; drift: number; lit?: number; litColor?: number; litSpread?: number }
  /**
   * The rats' colours: one for each part the model has, in the model's own to
   * start, and a tint over them all; the variants, each a tint over its share
   * of the rats, the eyes left out; their shell's sheen and highlight; and
   * their toon steps.
   */
  rats: { color: number; parts: Part[]; variants: Variant[]; glow: number; toon: ToonLook; paint: PaintLook; levels: LevelsLook; stagger: StaggerLook } & ShellLook
  /** The flagstone floor: how light, how saturated, how big a tile is in metres, how deep its relief; its shell; its painted normals; its toon steps. */
  floor: FloorLook & { shell: ShellLook; paint: PaintLook; toon: ToonLook }
  /** The ambient occlusion over the frame. */
  ao: AOLook
  /** The inked outlines over the frame. */
  outline: OutlineLook
  /** The posterized palette the frame ends in. */
  palette: PaletteLook
  /** Hatching in the frame's shade. */
  hatch: HatchLook
  /** Paper under the frame and grain over it. */
  grain: GrainLook
  /** The vignette closing the corners. */
  vignette: VignetteLook
  /** The finished frame's saturation. */
  screen: ScreenLook
  /** The depth of field, the tabletop's shallow focus. */
  dof: DofLook
  bloom: BloomLook
  /** The goose at the light. */
  goose: GooseLook
  /** The flame on top of it. */
  flame: FlameLook
  /** The trails the glowing eyes leave. */
  trails: TrailLook
  /** The stop-motion effect: the rats' run and their places held between beats, the camera and the world smooth. */
  stopMotion: StopMotionLook
}

/** What the stop motion folder edits. */
export interface StopMotionLook {
  enabled: boolean
  /** Beats a second: 12 is animation on twos, 8 on threes. */
  fps: number
  /** Whether the run clip steps on the beat. */
  run: boolean
  /** Whether the rats' places and facings step on the beat. */
  swarm: boolean
  /** Whether the lamp, its pool and the fog ring step on the beat; the swarm still reads the light where it really is. */
  light: boolean
  /** Whether the camera's follow of the light steps on the beat; the mouse still moves it every frame. */
  camera: boolean
  /** Between beats: each beat a photograph of its own, nothing identical to the last. Each on its switch, with its amount. */
  shadeWobble: boolean
  /** How far the toon steps move, as a share of the gradient. */
  shadeAmount: number
  lightFlicker: boolean
  /** How far the lights' intensities vary, as a share. */
  lightAmount: number
  strokeJitter: boolean
  /** How far the painted strokes move, in tiles of strokes. */
  strokeAmount: number
  frameJitter: boolean
  /** How far the whole frame moves, px. */
  frameAmount: number
  /** Whether the paper's fibres move on the beat. */
  paperOnBeat: boolean
  /** Whether some beats hold half as long again, and how many of them. */
  uneven: boolean
  unevenShare: number
  /** Whether each rat holds on a beat of its own phase, so the mass does not snap all at once. */
  stagger: boolean
  /** The boil: the rats' surface re-touched every beat, by how much, m, over bumps how many to the metre. */
  boil: boolean
  boilAmount: number
  boilScale: number
  /** Whether a held time lands on a baked pose of the run, never a blend of two. */
  snap: boolean
}

/**
 * How the game's father feels to play: how long his walk takes to all but reach the keys' pace, or a stop, s;
 * and a rat's bite on him: what it sounds as, at most one heard and seen a `gap` s however many bite him at once, all
 * at the hardest: his flinch, squashed down `squash` of his height, springing back over `lasts` s; his body flashing
 * `flash` of `flashColour`, fading over `flashLasts` s, and the frame's edges closing in `edge` of `edgeColour` with
 * it, more as his life runs low; the camera knocked the way the bite came, `knock` m, snapping back past where it was
 * over `knockLasts` s; and feathers puffing off him (`feathers`).
 */
export interface GooseFeel {
  inertia: number
  bite: { sound: 'hiss' | 'honk'; gap: number; lasts: number; squash: number; flash: number; flashColour: number; flashLasts: number; edge: number; edgeColour: number; knock: number; knockLasts: number }
  feathers: { look: FeatherLook; changed(): void }
  /**
   * The cage's key taken up: its flight into his wing, its pop and glint there (goosescenes.ts), if the scenes are
   * drawn; and the caged gosling's peep at it, `peep` loud, `peepAfter` s on, none at 0.
   */
  key: { taken: KeyTaken | undefined; peep: number; peepAfter: number }
  /**
   * The camera leaning toward the nearest gosling still waiting: from `from` m off, all of it by `near` m, `pull` of the
   * way to it, `most` m at most, eased over `ease` s; held back as his torch runs low, `low` on.
   */
  lean: { from: number; near: number; pull: number; most: number; ease: number; low: boolean }
  /** How fast his death plays as he falls, 1 as made (J plays it through where he stands, to see it whole); the dark's timing follows it, `changed`. */
  death: { speed: number; changed(): void }
  /**
   * His torch, felt: running low, past `low` of its fuel, its flame `gutter` more flickering, the
   * lamp dipping as deep as `dips`, the crackle `thin` quieter, all at their most as it goes out; the crackle `rise`
   * faster as a fire fills it. Catching full: the lamp `flare` brighter and the light `reach` further, settling over
   * `flareLasts` s; the flame `pop` taller, springing back over `popLasts` s; `sparks` sparks at `sparkSpeed` m/s; and the
   * camera nudged `knock` m back, settling over `knockLasts` s. A catch topped up from all but full, softer.
   */
  torch: { low: number; gutter: number; dips: number; thin: number; rise: number; flare: number; reach: number; flareLasts: number; pop: number; popLasts: number; sparks: number; sparkSpeed: number; knock: number; knockLasts: number }
  /** A found gosling's rats rumbling in: the camera shaken `shake` m at its hardest, dying away over `lasts` s. */
  rumble: { shake: number; lasts: number }
}
