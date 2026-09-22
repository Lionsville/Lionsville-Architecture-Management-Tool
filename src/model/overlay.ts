// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Colouring the landscape by what its applications stand on (ADR-0013, redone).
 *
 * LeanIX\'s picture, and the cheapest useful one in the whole step: no new
 * geometry, no lines, no rows — the cards are already there and the rows
 * already say what they stand on, so the only thing added is which of them
 * share an answer. *Which of these run on the cluster we are retiring* is the
 * question every technology migration opens with, and on a landscape of forty
 * cards it is answered by looking rather than by reading.
 *
 * Three overlays, because there are three questions. **Platform** groups the
 * cards by what they run on, one colour each. **Technology lifecycle** ignores
 * which platform and asks how healthy it is: the worst phase among the
 * platforms a card stands on, so a card on something retiring goes amber
 * whatever else it is on. **One platform or offering** (ADR-0020) asks the
 * reverse question — not *what does this card stand on* but *who stands on
 * this*: every application that uses it, is hosted on it or leverages it
 * through a service it uses is coloured, and the rest fade.
 *
 * Presentation, and nothing else: the band an element falls in is derived on
 * every render from the rows, and which overlay is up is a setting on the view.
 */
import { ancestorPlatforms, hostingOf, rootPlatformsOf } from './hosting'
import type { PlatformTree } from './hosting'
import { leverageOf } from './leverage'
import { phaseAt } from './lifecycle'
import type { DesignDiagram, DesignElement, ElementId, Lifecycle, Relation } from './types'

/**
 * What the landscape is coloured by; absent on the view means nothing. The
 * third names the one platform or offering asked about, `one:<id>`, so the
 * view keeps one string as it always has.
 */
export type ColourBy = 'platform' | 'technologyLifecycle' | `one:${string}`

/** The two overlays that name no element. */
export const COLOUR_BY: readonly ColourBy[] = ['platform', 'technologyLifecycle']

/** The overlay for one platform or offering (ADR-0020). */
export function colourByOne(id: ElementId): ColourBy {
  return `one:${id}`
}

/** The platform or offering a `one:` overlay asks about; nothing for the other two, or none. */
export function oneColouredBy(by: ColourBy | undefined): ElementId | undefined {
  return by !== undefined && by.startsWith('one:') ? by.slice('one:'.length) : undefined
}

/** Whether a string a file or a tool call carries is an overlay. */
export function isColourBy(value: string): value is ColourBy {
  return COLOUR_BY.includes(value as ColourBy) || (value.startsWith('one:') && value.length > 'one:'.length)
}

/**
 * One band of the overlay: a set of cards that share an answer, and what to
 * call it.
 *
 * `slot` is the palette place, stable for the life of the board because the
 * bands are ordered by name — a card that changes nothing must not change
 * colour because another card was added above it.
 */
export type OverlayBand = {
  /** The platform\'s id, a lifecycle phase, or `none`. */
  key: string
  /** A platform\'s name; absent on the phase bands and on `none`, which the caller names. */
  name?: string
  /** For the lifecycle overlay: which phase this band is. */
  phase?: Lifecycle
  /** For the one-thing overlay: the cards that do not stand on it, faded rather than washed. */
  faded?: true
  slot: number
  memberIds: ElementId[]
}

/** Worst first: what a card on several platforms takes. */
const WORST: readonly Lifecycle[] = ['retired', 'retiring', 'planned', 'live']

/**
 * The bands, over the platform tree (ADR-0014 §2.7): a card is coloured by
 * the outermost platform the organisation runs — the cluster, not the
 * namespace — and takes the worst phase of every platform in the chain its
 * containers sit in, so a card in a namespace goes amber when the cluster is
 * retiring. `tree` is what the scope that defines a platform says, where
 * this scope holds only a stand-in.
 */
export function overlayBands(
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
  diagram: Pick<DesignDiagram, 'kind' | 'members'>,
  colourBy: ColourBy | undefined,
  today?: string,
  tree: PlatformTree = {},
): OverlayBand[] {
  if (colourBy === undefined || diagram.kind !== 'layer7') return []
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const drawn = diagram.members
    .map((member) => byId.get(member.id))
    .filter((element): element is DesignElement => element?.kind === 'application')

  // The reverse question (ADR-0020): who stands on this one thing. The one
  // band first, and the rest faded — a second band only where there is a rest.
  const one = oneColouredBy(colourBy)
  if (one !== undefined) {
    const on: ElementId[] = []
    const off: ElementId[] = []
    for (const element of drawn) (standsOn(model, element.id, one, tree) ? on : off).push(element.id)
    return [
      { key: one, name: byId.get(one)?.name ?? one, slot: 0, memberIds: on },
      ...(off.length > 0 ? [{ key: 'none', slot: 1, faded: true as const, memberIds: off }] : []),
    ]
  }

  const bands = new Map<string, { name?: string; phase?: Lifecycle; order: string; memberIds: ElementId[] }>()
  const put = (key: string, order: string, memberId: ElementId, rest: { name?: string; phase?: Lifecycle } = {}) => {
    const held = bands.get(key)
    if (held) { held.memberIds.push(memberId); return }
    bands.set(key, { ...rest, order, memberIds: [memberId] })
  }

  for (const element of drawn) {
    const platforms = hostingOf(model, element.id).platformIds
      .map((id) => byId.get(id))
      .filter((held): held is DesignElement => held !== undefined)
    if (platforms.length === 0) { put('none', '\uffff', element.id); continue }
    if (colourBy === 'platform') {
      // The root, and the first: a card on two platforms during a migration
      // is drawn where it mostly is, and the second is a fact the record says
      // rather than a second colour on one card.
      const root = byId.get(rootPlatformsOf(model, element.id, tree)[0]) ?? platforms[0]
      put(root.id, root.name, element.id, { name: root.name })
      continue
    }
    const chain = platforms.flatMap((platform) => [platform, ...ancestorPlatforms(model.elements, platform.id, tree)])
    const phases = chain.map((platform) => (today ? phaseAt(platform, today) : platform.lifecycle))
    const worst = WORST.find((phase) => phases.includes(phase)) ?? 'live'
    put(worst, String(WORST.indexOf(worst)), element.id, { phase: worst })
  }

  return [...bands.entries()]
    .sort(([, a], [, b]) => a.order.localeCompare(b.order))
    .map(([key, band], slot) => ({
      key,
      ...(band.name !== undefined ? { name: band.name } : {}),
      ...(band.phase !== undefined ? { phase: band.phase } : {}),
      slot,
      memberIds: band.memberIds,
    }))
}

/**
 * Whether an application stands on one platform or offering: it uses the
 * offering (itself or through its containers, or implied by its hosting),
 * it is hosted on the platform or on anything filed under it, it binds to
 * the platform, or it leverages the platform through a service it uses.
 */
function standsOn(
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
  applicationId: ElementId,
  id: ElementId,
  tree: PlatformTree,
): boolean {
  const hosted = hostingOf(model, applicationId).platformIds
  if (hosted.some((platform) => platform === id || ancestorPlatforms(model.elements, platform, tree).some((above) => above.id === id))) return true
  const leverage = leverageOf(model, applicationId, { tree })
  return leverage.platformIds.includes(id)
    || leverage.services.some((service) => service.id === id || service.platformIds.includes(id))
}

/** Which band each card falls in, for a caller that draws rather than lists. */
export function overlayBandOf(bands: readonly OverlayBand[]): Map<ElementId, OverlayBand> {
  const out = new Map<ElementId, OverlayBand>()
  for (const band of bands) for (const id of band.memberIds) out.set(id, band)
  return out
}
