/**
 * What each element kind is called, and what a node of one is DRAWN as.
 *
 * Two questions, and until ADR-0012 §4 they had one answer. `externalSystem`,
 * `inputChannel` and `managementTool` were kinds, and what they really said was
 * how the box looked and which band it sat in. The kinds are gone; the drawing
 * is not, so it is derived here — from what the thing is, where the view puts
 * it, and whether anybody in this organisation owns it.
 *
 * Only the key, never the sentence. `Translate` turns it into words at the call
 * site, in whatever language is on screen at that moment.
 */
import type { StringKey, Translate } from '../i18n/strings'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { DesignDiagram, DesignElement, ElementId, ElementKind, Layer7Zone } from './types'

/** Every kind, in the order ADR-0012 §4 names them. */
export const ELEMENT_KINDS: readonly ElementKind[] = [
  'actor', 'step', 'function', 'process', 'application', 'component',
]

export function isElementKind(held: unknown): held is ElementKind {
  return typeof held === 'string' && (ELEMENT_KINDS as readonly string[]).includes(held)
}

export const KIND_LABEL_KEYS: Record<ElementKind, StringKey> = {
  actor: 'kind.actor',
  step: 'kind.step',
  function: 'kind.function',
  process: 'kind.process',
  application: 'kind.application',
  component: 'kind.component',
}

/** An element kind's name, in the given language (English when none is given). */
export function kindLabel(kind: ElementKind, translate: Translate = DEFAULT_TRANSLATE): string {
  return translate(KIND_LABEL_KEYS[kind])
}

/**
 * How a node is drawn: the six boxes this tool has always had.
 *
 * Three of the names were element kinds until ADR-0012 §4 retired them, and
 * they survive HERE because the drawing was the true half of each: a chip in
 * the input-channel band still reads as a channel, and a card in the
 * external-systems band still reads as somebody else's. What changed is where
 * the answer comes from.
 */
export type NodeFigure =
  | 'application'
  | 'component'
  | 'actor'
  | 'externalSystem'
  | 'inputChannel'
  | 'managementTool'

export const NODE_FIGURES: readonly NodeFigure[] = [
  'application', 'component', 'actor', 'externalSystem', 'inputChannel', 'managementTool',
]

/**
 * What this element looks like on this view.
 *
 * The band wins over the fact, and deliberately: a card in the input-channel
 * band is a channel whoever owns it, and that is the reading a person drawing
 * the board is asking for. `outside` decides only where the view says nothing —
 * the open landscape, and a container diagram, which has no bands at all and is
 * where an outside system used to be a kind of its own. A `ref` decides
 * nothing here: which band a stand-in is drawn in is the board's to say.
 *
 * A business kind never reaches a canvas (`canPlaceKind`, `model/placement.ts`),
 * so the two that fall through here fall through to the card — the shape a
 * thing with a name and a description has always had.
 */
export function nodeFigure(
  element: Pick<DesignElement, 'kind' | 'outside' | 'ref'>,
  zone?: Layer7Zone,
): NodeFigure {
  if (element.kind === 'actor' || element.kind === 'component') return element.kind
  if (zone === 'inputChannels') return 'inputChannel'
  if (zone === 'management') return 'managementTool'
  if (zone === 'externalSystems') return 'externalSystem'
  // A stand-in draws as whatever band it sits in, and NOT as an external
  // system by virtue of its `ref`: the card of another domain's application
  // on an overview is the application's card, with where it is from as a
  // note (`StandInNote`), and a person who wants it read as outside this
  // landscape puts it in the external band. It once drew as external
  // wherever it sat, which made an overview of the organisation a wall of
  // "external" boxes for its own applications.
  return element.outside ? 'externalSystem' : 'application'
}

/**
 * What a figure's name MEANS, read back.
 *
 * The six names above are also the vocabulary the interchange document holds,
 * written when a figure and a kind were the same word: a name read out of one
 * becomes the kind it always was plus the fact that carried it, and
 * {@link nodeFigure} writes it back.
 *
 * Permanent, unlike the working format's own use of it — that one went at
 * format 4, and `projects/migrate3to4.ts` is the last reader of it — because
 * the interchange is a contract with other tools and does not change
 * (ADR-0012 §11).
 */
export const FIGURE_MEANS: Record<NodeFigure, { kind: ElementKind; outside?: true }> = {
  application: { kind: 'application' },
  component: { kind: 'component' },
  actor: { kind: 'actor' },
  externalSystem: { kind: 'application', outside: true },
  inputChannel: { kind: 'application' },
  managementTool: { kind: 'application' },
}

export function isNodeFigure(held: unknown): held is NodeFigure {
  return typeof held === 'string' && (NODE_FIGURES as readonly string[]).includes(held)
}

/**
 * The band each element sits in, from the first view that puts it in one.
 *
 * What the interchange export needs and should not work out for itself: a
 * card's band is half of what it is drawn as, and an element is written to the
 * document once however many boards it is on. Diagram order, so the answer is
 * the model's own and not a set's iteration order; only a band counts, because
 * an element in the open landscape has said nothing about what it is, which is
 * the whole point of retiring the two kinds.
 */
export function bandsOf(diagrams: readonly DesignDiagram[]): Map<ElementId, Layer7Zone> {
  const bands = new Map<ElementId, Layer7Zone>()
  for (const diagram of diagrams) {
    if (diagram.kind !== 'layer7') continue
    for (const member of diagram.members ?? []) {
      if (member.zone === undefined || member.zone === 'landscape') continue
      if (!bands.has(member.id)) bands.set(member.id, member.zone)
    }
  }
  return bands
}
