/**
 * The editor's model -> a solution-design/v1 interchange document.
 *
 * The route back: what the editor edits, returned to the flat text that gets
 * reviewed and versioned. Geometry and styling deliberately do not come along —
 * the document carries the topology and the semantics, the tool owns the
 * geometry; styling travels in the working file.
 *
 * What the source document carried comes back unchanged: the description,
 * adrLinks, the formatVersion, and lifecycle/isManaged only where the source
 * mentioned them explicitly or the value differs from the default. That is what
 * keeps an export without edits a clean diff.
 */
import type { DesignModel } from '.'
import { placedNodes } from './placement'
import { isBuiltInLogoKey } from './logoRegistry'
import type { HostModel, InterchangeDoc } from './fromInterchange'
import { bandsOf, nodeFigure } from './kinds'
import { KEY_RE, claimKey } from './keys'
import { flowsOf } from './relations'
import type { ElementKind, RelationType } from './types'
import { UPLOADED_KEY_PREFIX } from './logo'

/**
 * Which `iconKey` may go into the document as `iconType` (agreement 3).
 *
 * Three rules, in this order:
 * 1. An uploaded (`lib:`) key NEVER goes in. The document carries topology and
 *    semantics and is meant to be reviewed; a reference to a data URL in
 *    somebody's browser is neither. Uploaded marks travel in the working file.
 * 2. A built-in key may: that is the closed vocabulary, and the package decides
 *    what is in it (`isBuiltInLogoKey`) so the shell does not write that rule
 *    down a second time.
 * 3. An unknown key that the SOURCE DOCUMENT carried may also go in — otherwise
 *    exporting a document from another (or newer) tool would quietly throw its
 *    icons away. The same `explicitFields` agreement as for lifecycle and
 *    isManaged: what the source said comes back.
 */
function iconTypeFor(iconKey: string | undefined, saidExplicitly: boolean): string | undefined {
  if (!iconKey || iconKey.startsWith(UPLOADED_KEY_PREFIX)) return undefined
  return isBuiltInLogoKey(iconKey) || saidExplicitly ? iconKey : undefined
}

/**
 * A safety net for ids that are not proper keys (the aliasing step in the shell
 * normally already gives new elements a permanent slug on the first flush).
 */
function keyMap(model: DesignModel): Map<string, string> {
  const map = new Map<string, string>()
  const taken = new Set<string>()
  const all = [
    ...model.elements.map((e) => ({ id: e.id, name: e.name })),
    ...model.diagrams.map((d) => ({ id: d.id, name: d.name })),
  ]
  const clean = (x: { id: string }) => KEY_RE.test(x.id)
  all.filter(clean).forEach((x) => { taken.add(x.id); map.set(x.id, x.id) })
  all.filter((x) => !clean(x)).forEach((x) => map.set(x.id, claimKey(x.name, taken)))
  return map
}

function prune<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) =>
      v !== undefined && v !== null &&
      !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)),
  ) as T
}

/**
 * What an export could not carry, so the person asking for it is told.
 *
 * The interchange format is a contract with other tools and does not change
 * (ADR-0012 §11): it holds boxes that are drawn on a board and lines between
 * two applications. From ADR-0012 §4 and §5 a scope can hold more than that —
 * a journey, the capabilities under an area, the rows that say what supports
 * what — and an export of one is therefore a smaller document than the
 * project, for the first time in this tool's life.
 *
 * That is fine, and it is not fine to do it quietly. So it is neither a
 * refusal (the export is still the right document to hand another tool) nor a
 * silence: it is a value beside the document, counted by kind and by type, for
 * whoever asked to render. Empty lists mean nothing was left behind, which is
 * every landscape that has no business layer on it.
 */
export type InterchangeOmissions = {
  relations: { type: RelationType; count: number }[]
  elements: { kind: ElementKind; count: number }[]
}

export type InterchangeExport = { doc: InterchangeDoc; omitted: InterchangeOmissions }

/** Counts by a key, in the order the keys were first met — a stable sentence. */
function tally<T extends string>(values: readonly T[]): { key: T; count: number }[] {
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].map(([key, count]) => ({ key, count }))
}

/**
 * The kinds this format has no box for: the business layer (ADR-0012 §4).
 *
 * Written out rather than derived from what a canvas draws, because they are
 * different questions with the same answer today — the format's vocabulary is
 * frozen by the contract, and what a canvas may draw is this tool's own rule
 * and may yet grow.
 */
const NOT_IN_THE_FORMAT: readonly ElementKind[] = ['step', 'function', 'process']

export function toInterchange(model: HostModel): InterchangeExport {
  const keys = keyMap(model)
  const k = (id: string | undefined) => (id == null ? undefined : keys.get(id) ?? id)
  const explicit = model.explicitFields ?? {}
  // What a box is drawn as is what this format calls its kind, and the band is
  // half of that answer (ADR-0012 §4) — so the boards are read once, here.
  const bands = bandsOf(model.diagrams)
  const carried = model.elements.filter((e) => !NOT_IN_THE_FORMAT.includes(e.kind))

  const doc = prune({
    formatVersion: typeof model.formatVersion === 'string' ? model.formatVersion : '1',
    design: prune({
      name: model.name,
      description: model.description,
      author: model.defaultAuthor,
      aspectConfig: model.defaultAspectConfig,
    }),
    elements: carried.map((e) => {
      const ex = explicit[e.id] ?? {}
      return prune({
        key: k(e.id),
        kind: nodeFigure(e, bands.get(e.id)),
        parentKey: k(e.parentId),
        name: e.name,
        category: e.category,
        vendor: e.vendor,
        technology: e.technology,
        description: e.description,
        lifecycle: ex.lifecycle || e.lifecycle !== 'live' ? e.lifecycle : undefined,
        // No `explicitFields` entry for these three: they have no default to be
        // silent about, so present means written and absent means absent, and a
        // document that had none comes back with none (ADR-0009).
        lifecycleDates: e.lifecycleDates,
        successorKey: k(e.successorId),
        owner: e.owner,
        isManaged: ex.isManaged || e.isManaged !== true ? e.isManaged : undefined,
        iconType: iconTypeFor(e.iconKey, ex.iconType ?? false),
        aspects: Object.keys(e.aspects ?? {}).length ? e.aspects : undefined,
      })
    }),
    // Flows only. The interchange format is a contract with other tools and
    // has one kind of line; a relation of any other type is this tool's own
    // and stays behind (ADR-0012 §11).
    connections: flowsOf(model.relations).map((c) => prune({
      key: KEY_RE.test(c.id) ? c.id : undefined,
      sourceKey: k(c.sourceId),
      targetKey: k(c.targetId),
      label: c.label,
      protocol: c.protocol,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      isBidirectional: c.isBidirectional || undefined,
    })),
    diagrams: model.diagrams.map((d) => prune({
      key: k(d.id),
      kind: d.kind,
      name: d.name,
      author: d.author,
      client: d.client,
      documentDate: d.documentDate,
      asOf: d.asOf,
      showTitleBlock: d.showTitleBlock,
      applicationKey: k(d.applicationElementId),
      // Written whole, empty included: an empty column set is somebody saying
      // "none of these", and dropping it would hand the reader back the
      // default five.
      aspectConfig: d.aspectConfig,
      showAspects: d.showAspects,
      // A place goes out under its group's NAME, which is what the exchange
      // format has always carried and what another tool can read; the id is
      // this model's (ADR-0012 §6).
      places: placedNodes(d).map((p) => prune({
        elementKey: k(p.id),
        zone: d.kind === 'layer7' ? p.zone : undefined,
        domainGroup: d.kind === 'layer7' && p.group !== undefined
          ? (d.groups ?? []).find((group) => group.id === p.group)?.name ?? p.group
          : undefined,
      })),
    })),
    adrLinks: (model.adrLinks as InterchangeDoc['adrLinks'])?.length ? model.adrLinks : undefined,
  }) as InterchangeDoc

  return {
    doc,
    omitted: {
      relations: tally(model.relations.filter((r) => r.type !== 'flow').map((r) => r.type))
        .map(({ key, count }) => ({ type: key, count })),
      elements: tally(model.elements.filter((e) => NOT_IN_THE_FORMAT.includes(e.kind)).map((e) => e.kind))
        .map(({ key, count }) => ({ kind: key, count })),
    },
  }
}
