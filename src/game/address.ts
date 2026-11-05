// What the address and the device ask of the page. The URL sets the start: `?webgl` draws through WebGPURenderer's WebGL 2
// backend, `?batch` draws the rats as the page-culled batch on WebGPU too, for measuring against the GPU's cull,
// `?cpustep` steps the swarm in the worker on WebGPU too, for measuring against the GPU's step, `?timestamps` reads the
// GPU's step time into the readouts, `?rats=8192` starts with that many rats, `?shadows` with the lamp's shadows on.
// `?film` is for recording: no panel, no readouts, no cursor. `#_debug` is the developer's page, with the panels, the
// readouts, the debug keys, the other cameras and the edit mode. The fog round the light is on again since 2026-10-11;
// `?fog=0` takes it away.
//
// The look steps down where a device cannot keep up (quality.ts): `?step=N` starts on step N, and `?adapt=0`, or any of
// the measuring switches (`?ao=0`, `?dof=0`, `?dpr=N`, `?post=0`), holds it where it starts.
export const url = new URLSearchParams(location.search)
/**
 * The developer's page, `#_debug` on the address: the panels, the readouts, the debug keys, the other cameras and the
 * edit mode. Without it the page is the game as played. Written or taken off the address, the page loads again on it.
 */
export const debugOn = location.hash === '#_debug'
addEventListener('hashchange', () => {
  if ((location.hash === '#_debug') !== debugOn) location.reload()
})
/** Whether the player's system asks for less motion: no thrown camera, and the strike's flash a fifth as bright. */
export const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
/** Whether the pointer is a finger: a phone, or a tablet. */
export const phone = matchMedia('(pointer: coarse)').matches
/** The touch stick and button (#198): on a phone, or with `?touch` to try them elsewhere. */
export const touchOn = phone || url.has('touch')
/** No panel but on the developer's page, nor there with `?nopanel` or on a phone: the whole screen is the game and the thumbs. */
export const noPanel = !debugOn || url.has('nopanel') || phone
/**
 * A feature, on by default in the goose game since 2026-10-30 (the tilt, the graveyard, the marker, the cheap bloom),
 * `?key=0` turning it off.
 */
export const featureOn = (key: string) => url.get(key) !== '0'
/** Under `?bench`, the phone's bench (phonebench.ts). */
export const benchOn = url.has('bench')
/** Under `?post=0`, no effect after the scene, for measuring. */
export const post0 = url.get('post') === '0'
// Filming: a take shows the scene alone. No panel, no readouts, and no cursor
// anywhere on the page, since the keys do everything a take needs.
export const filming = url.has('film')
// The page's stylesheet hides the cursor everywhere under this class, over anything the orbit controls set on the canvas.
if (filming) document.documentElement.classList.add('film')
