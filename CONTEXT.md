# A Goose Tale

A game in three.js on WebGPU, its rats animated with [three-vat](https://github.com/MikeFernandez-Pro/three-vat). Words the library owns, a **band** or a **crowd**, are in [its glossary](https://github.com/MikeFernandez-Pro/three-vat/blob/main/CONTEXT.md).

## Language

**A Goose Tale**:
The game: a gander, a father, the **torch** in his beak, crosses a **plain** one way in the night, from brazier to brazier, gathering his **goslings** as he goes, to the pond, where their mother waits on its island. The rats bite away his **life** and his goslings': a gosling's run out, the little one is gone for good; his run out, he wakes at the fire he last filled his **torch** at. It starts with the **opening** and ends at the pond. Called Last Light until 2026-11-01, while it was one light holding off a swarm.
_Avoid_: goose game (it is the whole game now), Last Light (its old name), arena run, escort mission

**Swarm**:
What the rats do in **A Goose Tale**: every rat running straight at the goose, the **torch** in his beak, stopped only by the light's edge, which it will not step over, and by the bodies ahead of it. Nothing routes a rat and nothing tells it to circle: stopped, it slides toward the less crowded side, and the milling comes out of the crowding. The rats pressing at the edge are the **front**. The light moves no rat. A rat goes round it, and gets out of the way of where it is walking. A light faster than the rats overtakes them, and they run out of it themselves. A swarm is steered; the crowd it is drawn as is not — the word names what the rats do, never the instances that show them.
_Avoid_: horde, flock, crowd (that is the instances), ring (there is none: ADR-0046)

**Front**:
The rats pressing at the light's edge, each as close as its own nerve dares. The light burns: a rat holds the edge a second or two, flinches back through the mass, and comes again, and fear spreads to the rats beside it, so the front recoils in clumps and is never a line. Its rats face the light; the mass behind them faces every way. With the light out, the front closes on the goose.
_Avoid_: ring, band (that is a clip's rows), circle, line

**Gait**:
What a rat's feet play, Run, Walk or Idle, read from how fast it really moves and never from what it is after. A rat shoved along never shows Idle, and a rat standing never runs.
_Avoid_: mood, state

**Light**:
In **A Goose Tale**, anything that holds rats off: a rat will not step into any lit light's **lit area**, and every light works the same way. The **torch** is one; the **plain** places the rest, each a **flame** or a **ghost**. A light the plain places stays where it is put, but for a ghost, which walks a path of its own; the torch walks where it is carried, and only the torch is what the rats run at.
_Avoid_: lamp (that is the three.js light that draws one), glow

**Lit area**:
The ground a **light** reaches: a full circle, since no **wall** stops light. The swarm keeps rats out of it and the drawing lights it, from one table, so what looks lit is what the rats avoid (ADR-0054, which worked it out against walls that stopped light).
_Avoid_: pool (that is the lamp's light), radius, reach (that is how far it would go with no wall)

**Wall**:
A straight run of the **road**'s broken walls, from one point on the ground to another, that no rat crosses and whose stones keep the goose and his **goslings** off; light passes it. A rat that sees the goose clearly runs straight at him; one a wall stands between takes the shortest way round the walls (ADR-0056). With more walls than the swarm reads, it is handed only the nearest to the goose, picked again as he walks.
_Avoid_: obstacle, collider, hall (that is the test branch's arena)

**Noticing distance**:
How far off a rat notices the goose, along its way round the **walls** (ADR-0056). Further, it does not run at him, and seethes where it is: the rats own the dark across the **plain** and do not cross it to the light.
_Avoid_: aggro range, spread (an old, removed setting)

**Torch**:
The goose's light, carried in his beak wherever he walks: a branch of the **burning tree**, its broken end alight, picked up burning where it fell at the end of the **opening**, his first act with **Interact**. Before, he carries nothing, and no fire lights anything for him. It burns its **fuel**, and goes out when the fuel is gone; he keeps it, and a **flame** lights it again.
_Avoid_: lamp, lantern, the light (there are several), stick

**Fuel**:
What the **torch** has left, from full to empty, burnt at a steady rate. The torch's reach holds full for most of it and shrinks to nothing over the last part, so running low is seen before it comes. Only a **flame** gives it back.
_Avoid_: oil, health, timer

**Flame**:
A **light** that is an open fire, a brazier or the fire at the **burning tree**'s foot: holding **Interact** with the **torch** in its dip fills the torch over a set time; let go early, it stops filling. A light that is not a flame, a **ghost**, holds rats off just the same and fills nothing.
_Avoid_: fire, brazier (that is one kind), refuel point

**Key**:
The cage **scene**'s key, lying on a skull out in the dark: picked up with **Interact**, standing on it, inside the swarm too, the **torch** pushing the rats off it; carried to the cage and **Interact** pressed there, it opens the cage.
_Avoid_: item, pickup

**Interact**:
What the player presses or holds to have the goose act where he stands, whatever they play with: the space bar, a gamepad's button, or the round button at a touch screen's bottom right. A press acts once, picking up the **torch** or the **key**; a hold works on for as long as it lasts, at a **flame** or in a **scene**, and let go early it stops.
_Avoid_: interact key (a **key** is the cage's), action, use

**Play step**:
**A Goose Tale**'s play, one frame at a time, with no drawing: the frame's input read, the run stepped, the goose walking in it, the rats set down, and the swarm moved on. The page builds one, feeds it the keys and draws what it reports; tests walk it on the keys. The tests let it step the CPU swarm; the page steps its own swarm as it draws, and the play reads its rats' places back (ADR-0055).
_Avoid_: game loop, controller, engine

**Plain**:
**A Goose Tale**'s ground, laid by hand: where the goose starts at its south end, a route of braziers heading north, wandering sideways, and the pond a little past the last. Its only **walls** are the **road**'s. Its ground rolls in low swells, flat round its start, its fires, its scenes and the pond; the play stays on the flat x and z, and only the drawing stands things on the swells.
_Avoid_: map, level (the woods' word, gone with them)

**Road**:
The old road up the **plain**, its braziers standing along it as its beacons: stone slabs, whole by each fire, thinning out in the dark between to the odd slab sunk in the dirt, running on back past where he starts and ending at the pond. Laid by hand, through points of its own; or else from the fires, passing each a little to one side, at a **scene** on the side away from its body. It says which way to go; the **call** and the **badge** say where a **gosling** is.
_Avoid_: path, track, trail

**Gosling**:
One of the goose's young: waiting in a brazier's light, or in his **circle**.
_Avoid_: chick, follower

**Life**:
How much more biting the goose, or a **gosling** of his **circle**, can take, from full to none: each rat at him takes some, and with none at him for a while it comes back. No bar shows it: his is the screen's colour, greying as it goes, black and white at none, and a gosling's is not shown. His at none, he wakes at the fire he last held the key at to fill his **torch**, his life and torch full, his circle round him, whole, the rats placed again. A gosling's at none, the little one is gone for good. A gosling waiting is never bitten.
_Avoid_: health, HP, fuel (that is the torch's)

**Circle**:
The **goslings** found, each following his place in an arc close round the goose's back on his own legs, at his own top pace, a little over the goose's walk: walking, he keeps them in his light; running, he leaves them behind. The arc is a little over half a circle at its widest, its ends just ahead of his sides; more goslings than fit take a second arc further out. A shrinking flame draws the arcs in. Not a line behind him.
_Avoid_: flock, train, followers

**Call**:
The nearest **gosling** still waiting, honking for the goose now and then, as a bird does, never on a beat: each honk a word popping up over the gosling, or, out of view, at the screen's edge on the gosling's side, so it says which way to go. The further off the goose is, the louder the honk; as he walks away the calls come sooner, and as he comes they calm.
_Avoid_: ping, hint, shout

**Badge**:
The calling **gosling**'s icon, there the whole time he calls, not just as he honks: the gosling in a ring, an arrow beside it. Out of view it sits at the screen's edge on the gosling's side, the arrow pointing out to him; in view it hangs over his head, bobbing, the arrow pointing down, until the goose has him; with none left waiting, the last gosling keeps his as he leads the goose home, until the **ending**. Each honk of the **call** jolts it a little.
_Avoid_: marker (the trial's flag), waypoint, objective

**Ghost**:
In the graveyard **scene**, the ghost of a goose that never came home, a sheet over it, and a **light** that walks a path of its own, set beforehand and closed on itself, round and round, holding rats off as any light does. Somewhere its path crosses the next ghost's, and there, as the two pass, their **lit areas** meet and he can go from one to the other: the only way on, with no other light there. A ghost walks slower than he does, so keeping in its light is holding back, not keeping up. It pays him no heed: it never follows him, waits for him or turns to him. It is no **flame**: it fills no torch.
_Avoid_: ghost light (the ghost is the light, as the **torch** is), spirit, wisp, phantom

**Scene**:
A brazier's place on the **plain** made a set piece of its own, its **gosling** given by its rule, worked with **Interact** instead of waiting in the light. The first brazier's place is the well: the gosling winched up in its bucket while **Interact** is held, the bucket dropping if let go early. The second's is the dead tree: its gosling up it, called down with the **torch** lit while **Interact** is held. The tree never burns; a brazier burns near it, its light stopping short of the trunk, so the rats keep the ground round the tree. The third's is the cage: its gosling in it, in the brazier's light, its **key** on a skull out in the dark. The fourth's is the graveyard: graves all round, no light but its **ghosts**', its gosling waiting at the fire past it.
_Avoid_: event, puzzle, encounter, zone (spoken of as "zone 1", the well, and "zone 2", the dead tree; in the code a zone is where **Interact** works)

**Opening**:
How **A Goose Tale** starts, every run, watched, never played, a hold skipping it, through the game's own camera: he walks calmly up the **road** in the dark, his **goslings** round his back, no rat about; lightning strikes the foot of a tree in leaf beside them, stopping them dead in fright, and the fire climbs it to its crown; the goslings bolt up the **plain**, each his own way, all but the one that freezes at the light's edge, his HONK! after them; then the screen shakes and the rats rush in from out of view on every side, and press round them at the edge of the tree's light, until a burning branch snaps off its crown and falls just past that edge, among them, and they scatter from its fire. It ends with the branch lying there burning, for him to pick up. It says why he is alone: each **scene**'s gosling ended up there running from that strike.
_Avoid_: intro, cutscene, cinematic

**Ending**:
How **A Goose Tale** ends, every run, watched, never played: once he swims near the pond's island, home, it takes him to its shore. The mother leaves her nest and runs out of the tent's door straight at him; his **goslings** swim in after him, climb out and shake themselves dry; as the two of them meet, hearts go up over them, and the island's goslings run round them for joy, then every gosling, his and hers, steps in close round the pair and hops for joy. The dawn comes up, the rats draining off out of its light, and the night fades out to the game's title, then a key to play again.
_Avoid_: outro, cutscene, cinematic

**Burning tree**:
The tree the **opening**'s lightning sets alight, on the spawn's brazier in place of a fire: one of the plain's dead trees in leaf, as tall as they are, flames up its trunk and in each cluster of its leaves, and one at its foot where he fills the **torch**; the branch that becomes his torch snaps off its crown. It burns the whole game. Not the dead tree of the **scene**, which never burns.
_Avoid_: spawn fire, fire pit
