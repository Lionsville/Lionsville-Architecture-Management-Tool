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

export type InterchangeDoc = {
  formatVersion: string
  design: { name: string; description?: string }
  elements: any[]
  connections?: any[]
  diagrams: any[]
  adrLinks?: any[]
}

export interface HostExtras {
  formatVersion?: unknown
  description?: string
  adrLinks?: unknown[]
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
    const placements: DiagramPlacement[] = (d.places ?? []).map((p: any) => ({
      elementId: p.elementKey,
      zone: p.zone as Layer7Zone | undefined,
      domainGroup: p.domainGroup,
      x: 0,
      y: 0,
    }))
    return {
      id: d.key,
      kind: d.kind,
      name: d.name,
      author: d.author,
      applicationElementId: d.applicationKey,
      placements,
      aspectConfig: d.aspectConfig,
      needsLayout: true,
    }
  })

  return {
    // A document without a name is a broken document, but an empty title bar is
    // a worse answer than a placeholder. English, like every other literal this
    // layer produces: core has no language, and the shell's default is English.
    name: doc.design?.name ?? 'Untitled',
    customerName,
    diagrams,
    elements,
    connections,
    formatVersion: doc.formatVersion,
    description: doc.design?.description,
    adrLinks: doc.adrLinks,
    explicitFields,
  }
}
