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

| | Keyboard | Gamepad |
| --- | --- | --- |
| Walk | WASD or the arrow keys | the left stick or the d-pad |
| Interact | Space, pressed or held | the bottom face button |
| Pause | Escape | Start |
| Mute | M | |

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

The route is saved in `src/gooseroute.json`, which the game plays. Under
`pnpm dev`, E on the game's page edits it in 3D: the play paused, a click picks a piece, a drag moves it,
the wheel turns it, and Save writes the route.

## Credits and licence

The code is MIT (see `LICENSE`). Code ported from other projects, and the
models that are not the game's own, keep their own terms:
`THIRD_PARTY_NOTICES.md` lists them, and `public/licence.txt` credits the rat.
