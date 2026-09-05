/**
 * solution-design/v1 interchange document -> the editor's model.
 *
 * The document carries topology and semantics and no geometry, exactly as the
 * format prescribes. Every placement starts at (0,0) with needsLayout set; the
 * editor lays the drawing out itself on opening.
 *
 * What the model does not need but the document does carry — the document
 * description, adrLinks, the original formatVersion, and which elements
 * mentioned lifecycle/isManaged explicitly — travels along as HostExtras, so the
 * export can hand it back without phantom changes in the diff.
 */
import type {
  DesignModel, DesignElement, DesignConnection, DesignDiagram, DiagramPlacement, Layer7Zone,
} from '@lionsville/solution-design'
import type { Adr } from '../adr'

/**
 * The document's own shapes, deliberately not the model's: everything is
 * addressed by `key` rather than by id, no geometry is carried, and whatever
 * the model defaults is optional here.
 *
 * Writing them down is what makes the mapping below checked rather than merely
 * believed. Field types are taken from the model by indexed access instead of
 * being restated, so a closed vocabulary that gains a member — a new lifecycle
 * stage, a new element kind — cannot drift apart from the model's own.
 */
type InterchangeElement = {
  key: string
  kind: DesignElement['kind']
  parentKey?: string
  name: string
  category?: string
  vendor?: string
  technology?: string
  description?: string
  lifecycle?: DesignElement['lifecycle']
  isManaged?: boolean
  aspects?: DesignElement['aspects']
  /** Unknown, not string: an unrecognised key is kept and handed back (see below). */
  iconType?: unknown
}

type InterchangeConnection = {
  key?: string
  sourceKey: string
  targetKey: string
  label?: string
  protocol?: string
  isBidirectional?: boolean
}

type InterchangePlace = {
  elementKey: string
  zone?: Layer7Zone
  domainGroup?: string
}

type InterchangeDiagram = {
  key: string
  kind: DesignDiagram['kind']
  name: string
  author?: string
  client?: string
  documentDate?: string
  showTitleBlock?: boolean
  applicationKey?: string
  places?: InterchangePlace[]
  aspectConfig?: DesignDiagram['aspectConfig']
  showAspects?: boolean
}

export type InterchangeDoc = {
  formatVersion: string
  design: {
    name: string
    description?: string
    /** What a diagram in this project shows as its author unless it says otherwise. */
    author?: string
    /** What a NEW landscape in this project starts its maturity columns as. */
    aspectConfig?: DesignDiagram['aspectConfig']
  }
  elements: InterchangeElement[]
  connections?: InterchangeConnection[]
  diagrams: InterchangeDiagram[]
  adrLinks?: unknown[]
}

export interface HostExtras {
  formatVersion?: unknown
  description?: string
  /**
   * Project-wide defaults, both of them answers to "and what about the next
   * diagram?".
   *
   * `defaultAuthor` is who the export names when a diagram has not been given
   * an author of its own; `defaultAspectConfig` is the column set a newly
   * created landscape starts with. Neither is ever read in place of a
   * diagram's own answer — they seed and they fall back, they do not override.
   */
  defaultAuthor?: string
  defaultAspectConfig?: DesignDiagram['aspectConfig']
  adrLinks?: unknown[]
  /**
   * The project's decision records — the landscape level's and every
   * application's, told apart by `applicationId`. They travel in the working
   * file and nowhere else: the interchange format is a contract with other
   * tools, and its `adrLinks` are references to records kept elsewhere, which
   * is a different thing from the records themselves.
   */
  decisions?: Adr[]
  /** Per element key: which fields the source document carried explicitly. */
  explicitFields?: Record<string, { lifecycle?: boolean; isManaged?: boolean; iconType?: boolean }>
}

export type HostModel = DesignModel & HostExtras

export function fromInterchange(doc: InterchangeDoc, customerName: string): HostModel {
  const explicitFields: NonNullable<HostExtras['explicitFields']> = {}

  const elements: DesignElement[] = (doc.elements ?? []).map((e) => {
    explicitFields[e.key] = {
      lifecycle: 'lifecycle' in e, isManaged: 'isManaged' in e, iconType: 'iconType' in e,
    }
    return {
      id: e.key,
      kind: e.kind,
      parentApplicationId: e.parentKey,
      name: e.name,
      category: e.category,
      vendor: e.vendor,
      technology: e.technology,
      description: e.description,
      lifecycle: e.lifecycle ?? 'live',
      isManaged: e.isManaged ?? true,
      aspects: e.aspects ?? {},
      parameters: {},
      // `iconType` (agreement 3): a closed vocabulary of the built-in keys. A
      // key this tool does not recognise is kept anyway, so it comes back on
      // export and a newer or different tool has not lost it — the element
      // meanwhile falls back to its kind glyph, exactly as the package promises.
      // Uploaded (`lib:`) keys never appear here, by agreement.
      iconKey: typeof e.iconType === 'string' && e.iconType ? e.iconType : undefined,
    }
  })

  // A connection without a key of its own gets an id that is not a valid
  // interchange key (c#…), so the export knows it should not write a key back.
  const connections: DesignConnection[] = (doc.connections ?? []).map((c, i) => ({
    id: c.key ?? `c#${i + 1}`,
    sourceId: c.sourceKey,
    targetId: c.targetKey,
    label: c.label,
    protocol: c.protocol,
    isBidirectional: c.isBidirectional ?? false,
  }))

  const diagrams: DesignDiagram[] = (doc.diagrams ?? []).map((d) => {
    const placements: DiagramPlacement[] = (d.places ?? []).map((p) => ({
      elementId: p.elementKey,
      zone: p.zone,
      domainGroup: p.domainGroup,
      x: 0,
      y: 0,
    }))
    return {
      id: d.key,
      kind: d.kind,
      name: d.name,
      author: d.author,
      client: d.client,
      documentDate: d.documentDate,
      showTitleBlock: d.showTitleBlock,
      applicationElementId: d.applicationKey,
      placements,
      aspectConfig: d.aspectConfig,
      showAspects: d.showAspects,
      needsLayout: true,
    }
  })

  return {
    // A document without a name is a broken document, but an empty title bar is
    // a worse answer than a placeholder. English, like every other literal this
    // layer produces: core has no language, and the shell's default is English.
    name: doc.design?.name ?? 'Untitled',
    customerName,
    defaultAuthor: doc.design?.author,
    defaultAspectConfig: doc.design?.aspectConfig,
    diagrams,
    elements,
    connections,
    formatVersion: doc.formatVersion,
    description: doc.design?.description,
    adrLinks: doc.adrLinks,
    explicitFields,
  }
}
