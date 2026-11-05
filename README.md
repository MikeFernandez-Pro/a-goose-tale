# A Goose Tale

A gander, the torch in his beak, crosses a plain in the night from brazier to
brazier, gathering his goslings as he goes, to the pond where their mother
waits. The dark between the fires is full of rats, and they keep out of his
light.

**[Play it in your browser](https://agoosetale.com)**

Built with [three.js](https://threejs.org) on `WebGPURenderer` (`?webgl` draws
through its WebGL 2 backend instead), with the swarm animated by
[three-vat](https://github.com/MikeFernandez-Pro/three-vat): every rat runs as
vertex animation textures on the GPU, with no skeleton or mixer on the CPU.

## Controls

| | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Walk | WASD or the arrow keys | the left stick or the d-pad | a thumb on the screen's left half |
| Interact | Space, pressed or held | the bottom face button | the round button |
| Pause | Escape | Start | the top right button |
| Mute | M | | the pause screen's Sound key |

## Run it locally

```bash
pnpm install
pnpm dev        # bakes the rat, then serves the game on http://localhost:4321
pnpm phone      # the same, over https on the network, so a phone gets WebGPU
pnpm test       # the swarm and the play, headless in Node
pnpm typecheck
pnpm build      # bakes the rat, then dist/, as deployed
```

`pnpm bake` writes the baked rat, `public/models/rat.vat.glb`, from
`models/rat.glb` with the `three-vat bake` command. `dev` and `build` run it
first, so the baked file is never committed.

The route is saved in `src/world/gooseroute.json`, which the game plays. Under
`pnpm dev`, E on the game's page edits it in 3D: the play paused, a click picks a piece, a drag moves it,
the wheel turns it, and Save writes the route.

## Where things live

`src/main.ts` is the page: it makes the game's parts and runs each frame. `src/settings.ts` holds
what it tunes and reads. The rest of `src/` goes by what each file is in the game, with each
test beside its source:

| Folder | What is in it |
| --- | --- |
| `swarm/` | the rats: where they run, the way round the walls, the lit areas they keep out of, their workers and their drawing |
| `game/` | the play with no drawing, the scenes, the opening and the ending, the camera, what he feels and what the address asks |
| `characters/` | the gander, the goslings, the island geese and the ghosts |
| `world/` | the plain and the route it follows, the road, the pond, the graveyard, the trees and the weather |
| `light/` | the lights, the flame, its embers and smoke, and the shadows fires cast |
| `look/` | the renderer, the sky and the fog, the shading, the frame after the scene, the themes, the quality steps and the model loader |
| `sound/` | the sounds, the music, their mixes and what the game is heard doing |
| `ui/` | the controls, the hints, the badge, the words the opening shows, and the loading, pause and error screens |
| `dev/` | the panels, the route editor and the benches, loaded only when asked for |

In `tools/`, `vite/` holds the dev server's and the build's plugins, `generators/` the scripts
that made models and textures, and `sfx/` the sounds' build.

## Credits and licence

The code is MIT (see `LICENSE`). Code ported from other projects, and the
models that are not the game's own, keep their own terms:
`THIRD_PARTY_NOTICES.md` lists them, and `public/licence.txt` credits the rat.
