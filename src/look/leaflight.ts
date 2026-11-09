// A leaf's light. A leaf card is thin: a lamp's light, a fire's or the goose's, gets through it, and lights the side seen
// as well as the side it falls on. The moon's lights its own side alone, which is what shapes a crown. The fires stand
// a metre up, under the crowns and the leaves falling from them, and the camera looks down: a crown's top faces up and
// away from them, a falling leaf is seen face up, and each lit from its own side alone, the leaves seen kept their mid
// colour by the fires while only the low cards, the crown's shadow colour, took their light (2026-11-08).
//
// And as much of its own colour as `leafGlow` has, the same for every leaf, whatever light falls on it: none, lit by the
// lights alone; justASimpleTree's leaves show their colours as their own light, which the night's dim light lost.
import { MeshLambertNodeMaterial, PhongLightingModel, type LightingModelDirectInput, type Node, type NodeMaterial } from 'three/webgpu'
import { BRDF_Lambert, diffuseColor, normalView, renderGroup, uniform } from 'three/tsl'
import { leaveOutOfBloom } from './post'

/** How much of its own colour every leaf shows unlit, 0 none: the look's `leaves.glow`. */
export const leafGlow = uniform(0).setGroup(renderGroup)

/** How much the lights light every leaf, 1 as they light the rest: the look's `leaves.light`. */
export const leafLight = uniform(1).setGroup(renderGroup)

/** Show `colour`, a leaf material's own, as much as `leafGlow` has, whatever the light: its own light, but no light for the bloom to halo. */
export function glowAsLeaf(material: NodeMaterial, colour: Node<'vec3'>): void {
  // Typed on the standard node material but not on the toon or Lambert one; three's node material reads it on all.
  ;(material as unknown as { emissiveNode: Node }).emissiveNode = colour.mul(leafGlow)
  leaveOutOfBloom(material)
}

/** How square the light from `lightDirection` falls on a leaf, -1 to 1: a lamp's, from either side of the card. */
export function leafFacing({ lightDirection, lightNode }: Pick<LightingModelDirectInput, 'lightDirection' | 'lightNode'>): Node<'float'> {
  const facing = normalView.dot(lightDirection as unknown as Node<'vec3'>)
  return (lightNode as { light?: { isDirectionalLight?: boolean } }).light?.isDirectionalLight ? facing : facing.abs()
}

/** Three's Lambert, lit as a leaf (`leafFacing`). */
class LeafLambertLightingModel extends PhongLightingModel {
  constructor() {
    super(false)
  }

  override direct(input: LightingModelDirectInput): void {
    const irradiance = leafFacing(input).clamp().mul((input.lightColor as unknown as Node<'vec3'>).mul(leafLight))
    const diffuse = BRDF_Lambert({ diffuseColor: diffuseColor.rgb }) as unknown as Node<'vec3'>
    ;(input.reflectedLight.directDiffuse as unknown as Node<'vec3'>).addAssign(irradiance.mul(diffuse))
  }
}

/** Three's Lambert material for leaves: the falling ones. */
export class LeafLambertMaterial extends MeshLambertNodeMaterial {
  static override get type(): string {
    return 'LeafLambertMaterial'
  }

  override setupLightingModel(): LeafLambertLightingModel {
    return new LeafLambertLightingModel()
  }
}
