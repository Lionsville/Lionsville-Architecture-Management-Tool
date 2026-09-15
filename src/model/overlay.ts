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
 * Two overlays, because there are two questions. **Platform** groups the cards
 * by what they run on, one colour each. **Technology lifecycle** ignores which
 * platform and asks how healthy it is: the worst phase among the platforms a
 * card stands on, so a card on something retiring goes amber whatever else it
 * is on.
 *
 * Presentation, and nothing else: the band an element falls in is derived on
 * every render from the rows, and which overlay is up is a setting on the view.
 */
import { hostingOf } from './hosting'
import { phaseAt } from './lifecycle'
import type { DesignDiagram, DesignElement, ElementId, Lifecycle, Relation } from './types'

/** What the landscape is coloured by; absent on the view means nothing. */
export type ColourBy = 'platform' | 'technologyLifecycle'

export const COLOUR_BY: readonly ColourBy[] = ['platform', 'technologyLifecycle']

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
  slot: number
  memberIds: ElementId[]
}

/** Worst first: what a card on several platforms takes. */
const WORST: readonly Lifecycle[] = ['retired', 'retiring', 'planned', 'live']

export function overlayBands(
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
  diagram: Pick<DesignDiagram, 'kind' | 'members'>,
  colourBy: ColourBy | undefined,
  today?: string,
): OverlayBand[] {
  if (colourBy === undefined || diagram.kind !== 'layer7') return []
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const drawn = diagram.members
    .map((member) => byId.get(member.id))
    .filter((element): element is DesignElement => element?.kind === 'application')

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
      // The first: a card on two platforms during a migration is drawn where
      // it mostly is, and the second is a fact the record says rather than a
      // second colour on one card.
      const platform = platforms[0]
      put(platform.id, platform.name, element.id, { name: platform.name })
      continue
    }
    const phases = platforms.map((platform) => (today ? phaseAt(platform, today) : platform.lifecycle))
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

/** Which band each card falls in, for a caller that draws rather than lists. */
export function overlayBandOf(bands: readonly OverlayBand[]): Map<ElementId, OverlayBand> {
  const out = new Map<ElementId, OverlayBand>()
  for (const band of bands) for (const id of band.memberIds) out.set(id, band)
  return out
}
