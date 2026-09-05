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
import type { DesignModel } from '@lionsville/solution-design'
import { isBuiltInLogoKey, isTempId } from '@lionsville/solution-design'
import type { HostModel, InterchangeDoc } from './fromInterchange'
import { KEY_RE, claimKey } from './keys'
import { UPLOADED_KEY_PREFIX } from '../logo'

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
  const clean = (x: { id: string }) => !isTempId(x.id) && KEY_RE.test(x.id)
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

export function toInterchange(model: HostModel): InterchangeDoc {
  const keys = keyMap(model)
  const k = (id: string | undefined) => (id == null ? undefined : keys.get(id) ?? id)
  const explicit = model.explicitFields ?? {}

  return prune({
    formatVersion: typeof model.formatVersion === 'string' ? model.formatVersion : '1',
    design: prune({ name: model.name, description: model.description }),
    elements: model.elements.map((e) => {
      const ex = explicit[e.id] ?? {}
      return prune({
        key: k(e.id),
        kind: e.kind,
        parentKey: k(e.parentApplicationId),
        name: e.name,
        category: e.category,
        vendor: e.vendor,
        technology: e.technology,
        description: e.description,
        lifecycle: ex.lifecycle || e.lifecycle !== 'live' ? e.lifecycle : undefined,
        isManaged: ex.isManaged || e.isManaged !== true ? e.isManaged : undefined,
        iconType: iconTypeFor(e.iconKey, ex.iconType ?? false),
        aspects: Object.keys(e.aspects ?? {}).length ? e.aspects : undefined,
      })
    }),
    connections: model.connections.map((c) => prune({
      key: KEY_RE.test(c.id) ? c.id : undefined,
      sourceKey: k(c.sourceId),
      targetKey: k(c.targetId),
      label: c.label,
      protocol: c.protocol,
      isBidirectional: c.isBidirectional || undefined,
    })),
    diagrams: model.diagrams.map((d) => prune({
      key: k(d.id),
      kind: d.kind,
      name: d.name,
      author: d.author,
      applicationKey: k(d.applicationElementId),
      aspectConfig: d.aspectConfig?.length ? d.aspectConfig : undefined,
      places: d.placements.map((p) => prune({
        elementKey: k(p.elementId),
        zone: d.kind === 'layer7' ? p.zone : undefined,
        domainGroup: d.kind === 'layer7' ? p.domainGroup : undefined,
      })),
    })),
    adrLinks: (model.adrLinks as InterchangeDoc['adrLinks'])?.length ? model.adrLinks : undefined,
  }) as InterchangeDoc
}
