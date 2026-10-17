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
import { derivedPlatformAspect, ASPECT_STATUSES } from './aspects'
import type { AspectStatus, DesignDiagram, DesignElement, ElementId, Lifecycle, Relation } from './types'

/**
 * What the landscape is coloured by; absent on the view means nothing. Two
 * name an element or a column — the one platform or offering asked about,
 * `one:<id>` (ADR-0020), and an operational aspect's column, `aspect:<key>` —
 * so the view keeps one string as it always has.
 *
 * The five value overlays (3.7.0) ask the record rather than the rows: the
 * card's own phase on the day, its category, who answers for it, its vendor
 * and its technology. *Which of these does nobody own*, *which are still on
 * the old vendor* are the questions a landscape review opens with, and they
 * are answered by looking, as the platform question is.
 */
export type ColourBy =
  | 'platform' | 'technologyLifecycle'
  | 'lifecycle' | 'category' | 'owner' | 'vendor' | 'technology'
  | `one:${string}` | `aspect:${string}`

/** The overlays that name no element and no column, in the order a menu lists them. */
export const COLOUR_BY: readonly ColourBy[] = [
  'platform', 'technologyLifecycle', 'lifecycle', 'category', 'owner', 'vendor', 'technology',
]

/** The overlays that read the record, not the rows: `aspect:<key>` is one more. */
export const VALUE_COLOUR_BY: readonly ColourBy[] = ['lifecycle', 'category', 'owner', 'vendor', 'technology']

/** The overlay for one operational aspect's column. */
export function colourByAspect(key: string): ColourBy {
  return `aspect:${key}`
}

/** The aspect column an `aspect:` overlay asks about; nothing for the others. */
export function aspectColouredBy(by: ColourBy | undefined): string | undefined {
  return by !== undefined && by.startsWith('aspect:') ? by.slice('aspect:'.length) : undefined
}

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
  return COLOUR_BY.includes(value as ColourBy)
    || (value.startsWith('one:') && value.length > 'one:'.length)
    || (value.startsWith('aspect:') && value.length > 'aspect:'.length)
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
  /**
   * The platform's id, a lifecycle phase, an aspect status, a value
   * (`value:<text>`), `none` (on nothing) or `unset` (the record says nothing).
   */
  key: string
  /** A platform's or a value's name; absent on the phase, status, `none` and `unset` bands, which the caller names. */
  name?: string
  /** For the lifecycle overlays: which phase this band is. */
  phase?: Lifecycle
  /** For an aspect overlay: which status this band is; `unset` where the record has no entry. */
  status?: AspectStatus | 'unset'
  /** For the one-thing overlay: the cards that do not stand on it, faded rather than washed. */
  faded?: true
  slot: number
  memberIds: ElementId[]
}

/** What a value overlay reads off a record, and how it is named. */
export interface OverlayNames {
  /** Who answers for it, in words: the register's name for a picked person, the text as typed. */
  owner?(ref: NonNullable<DesignElement['owner']>): string
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
  names: OverlayNames = {},
): OverlayBand[] {
  if (colourBy === undefined || diagram.kind !== 'layer7') return []
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const drawn = diagram.members
    .map((member) => byId.get(member.id))
    .filter((element): element is DesignElement => element?.kind === 'application')

  // The record's own answer (3.7.0): a phase, a status or a value per card.
  const aspect = aspectColouredBy(colourBy)
  if (aspect !== undefined) return aspectBands(drawn, aspect, model)
  if (VALUE_COLOUR_BY.includes(colourBy)) return valueBands(drawn, colourBy, today, names)

  // The reverse question (ADR-0020): who stands on this one thing. The one
  // band first, and the rest faded — a second band only where there is a rest.
  const one = oneColouredBy(colourBy)
  if (one !== undefined) {
    const on: ElementId[] = []
    const off: ElementId[] = []
    for (const element of drawn) (standsOn(model, element.id, one, tree, today) ? on : off).push(element.id)
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
    // Where it runs on the board's day: an application that moved stands on
    // the new platform, not on the one it left (`hostingOf`).
    const platforms = hostingOf(model, element.id, today).platformIds
      .map((id) => byId.get(id))
      .filter((held): held is DesignElement => held !== undefined)
    if (platforms.length === 0) { put('none', '\uffff', element.id); continue }
    if (colourBy === 'platform') {
      // The root, and the first: a card on two platforms during a migration
      // is drawn where it mostly is, and the second is a fact the record says
      // rather than a second colour on one card.
      const root = byId.get(rootPlatformsOf(model, element.id, tree, today)[0]) ?? platforms[0]
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

/** The phases in the order a legend lists them, as `aspectLegend` does. */
const PHASES: readonly Lifecycle[] = ['planned', 'live', 'retiring', 'retired']

/**
 * One band per answer the record gives. A phase band keeps the phase's
 * colour, so the overlay and the badge agree; a text band — a category, an
 * owner, a vendor — is ordered by name, for the reason the platform bands
 * are; and a card whose record says nothing goes last, in `unset`, which is
 * the absence of an answer and not one more value.
 */
function valueBands(
  drawn: readonly DesignElement[],
  colourBy: ColourBy,
  today: string | undefined,
  names: OverlayNames,
): OverlayBand[] {
  const bands = new Map<string, { name?: string; phase?: Lifecycle; order: string; memberIds: ElementId[] }>()
  const put = (key: string, order: string, memberId: ElementId, rest: { name?: string; phase?: Lifecycle } = {}) => {
    const held = bands.get(key)
    if (held) { held.memberIds.push(memberId); return }
    bands.set(key, { ...rest, order, memberIds: [memberId] })
  }
  for (const element of drawn) {
    if (colourBy === 'lifecycle') {
      const phase = today ? phaseAt(element, today) : element.lifecycle
      put(phase, String(PHASES.indexOf(phase)), element.id, { phase })
      continue
    }
    const value = valueOf(element, colourBy, names)
    if (value === undefined) { put('unset', '\uffff', element.id); continue }
    put(`value:${value}`, value.toLocaleLowerCase(), element.id, { name: value })
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

/** What a record says under a value overlay, trimmed; nothing where it says nothing. */
function valueOf(element: DesignElement, colourBy: ColourBy, names: OverlayNames): string | undefined {
  const text = (held: string | undefined) => {
    const trimmed = held?.trim()
    return trimmed ? trimmed : undefined
  }
  switch (colourBy) {
    case 'category': return text(element.category)
    case 'vendor': return text(element.vendor)
    case 'technology': return text(element.technology)
    case 'owner': {
      const owner = element.owner
      if (owner === undefined) return undefined
      if (names.owner) return text(names.owner(owner))
      return text(typeof owner === 'string' ? owner : owner.person)
    }
    default: return undefined
  }
}

/**
 * One band per status of one aspect column, in the model's order, then the
 * cards with no entry. The platform column reads the rows' opinion where
 * nobody typed one (ADR-0013), as the badge does, so the two cannot disagree.
 */
function aspectBands(
  drawn: readonly DesignElement[],
  key: string,
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
): OverlayBand[] {
  const members = new Map<AspectStatus | 'unset', ElementId[]>()
  for (const element of drawn) {
    const status = element.aspects?.[key]?.status
      ?? (key === 'platform' ? derivedPlatformAspect(element, model)?.status : undefined)
      ?? 'unset'
    const held = members.get(status)
    if (held) held.push(element.id)
    else members.set(status, [element.id])
  }
  return [...ASPECT_STATUSES, 'unset' as const]
    .filter((status) => members.has(status))
    .map((status, slot) => ({ key: status, status, slot, memberIds: members.get(status) ?? [] }))
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
  today?: string,
): boolean {
  const hosted = hostingOf(model, applicationId, today).platformIds
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
