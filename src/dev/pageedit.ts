// The edit mode (gooseedit.ts) on the page.
import type { PerspectiveCamera, WebGPURenderer, Scene } from 'three/webgpu'
import type { GooseScenes, EditPiece } from '../game/goosescenes'
import type { GoosePlay } from '../game/gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Settings } from '../settings'
import type { GooseCamera, GooseView } from '../game/gooseview'
import { createEditMode } from './gooseedit'
import { type Route, toSave } from '../world/plain'

/**
 * The game's edit mode, E on and off (gooseedit.ts): the play paused and the camera the free orbit while it is
 * on, both put back as they were after; the scenes' pieces, and each plain brazier and its waiting gosling, to pick,
 * move, turn, raise and size; saved as the route, the page loaded again on it. The pieces raised and sized as the
 * route keeps them, edit mode or not.
 */
export function createPageEdit({ camera, renderer, scene, gooseScenes, goosePlay, plainPieces, settings, setPaused, view }: {
  camera: PerspectiveCamera
  renderer: WebGPURenderer
  scene: Scene
  gooseScenes: GooseScenes
  goosePlay: GoosePlay<PlaySwarm>
  plainPieces: () => EditPiece[]
  settings: Settings
  setPaused: (on: boolean) => void
  view: GooseView
}) {
  let editWasPaused = false
  let editWasCamera: GooseCamera = 'fixed'
  const editMode = createEditMode({
    camera,
    dom: renderer.domElement,
    scene,
    pieces: () => [...gooseScenes.pieces(goosePlay), ...plainPieces()],
    entered() {
      editWasPaused = settings.paused
      setPaused(true)
      editWasCamera = view.kind
      view.setGooseCamera('orbit', false)
    },
    left() {
      setPaused(editWasPaused)
      view.setGooseCamera(editWasCamera, false)
    },
    cameraTakes(takes) {
      view.controls.enableZoom = takes
    },
    save: saveEditedRoute,
  })
  addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || event.target instanceof HTMLInputElement) return
    editMode.toggle()
  })
  /**
   * The route the edited pieces now make, written over src/world/gooseroute.json by the dev server,
   * and the page loaded again on it; or why not. Not with a debug placement on, which would be saved with it.
   */
  async function saveEditedRoute(pieces: EditPiece[]): Promise<string | undefined> {
    if (goosePlay.settings.treeAhead !== null || goosePlay.settings.wellAhead !== null) return 'not saved: a debug placement (?tree) is on'
    const { start, pond } = goosePlay.plain
    const braziers = structuredClone(goosePlay.plain.braziers)
    for (const piece of pieces) piece.save?.(braziers)
    // The road as the route laid it, by hand or not at all: the edit mode moves none of it.
    const { road } = goosePlay.plain
    const route: Route = { start: { ...start }, braziers, pond: { ...pond }, ...(road ? { road: structuredClone(road) } : {}) }
    // To the millimetre.
    const body = JSON.stringify(toSave(route), (_, v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))
    const response = await fetch('/goose-route', { method: 'POST', body }).catch(() => undefined)
    if (!response?.ok) return `not saved: ${response ? await response.text() : 'no dev server'}`
    location.reload()
    return undefined
  }
  return editMode
}
