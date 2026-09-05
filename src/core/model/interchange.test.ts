/**
 * The interchange document in, and out again.
 *
 * The promise proved here is the one in the README: what the source document
 * carried comes back unchanged on export — description, adrLinks, and which
 * elements mentioned their lifecycle explicitly — "although the first export may
 * normalise field order within an element once."
 *
 * That field order is therefore precisely the one permitted difference, and it
 * is pinned here rather than papered over: the comparison of the shipped
 * document runs on sorted keys, and a separate test shows the difference is
 * order alone and that a second round shifts nothing further.
 */
import { describe, expect, it } from 'vitest'
import doc from '../../examples/acme-logistics.json'
import { fromInterchange } from './fromInterchange'
import type { InterchangeDoc } from './fromInterchange'
import { toInterchange } from './toInterchange'

const GROUP_NAME = 'Acme Logistics'
const source = doc as unknown as InterchangeDoc

/** Deep copy with each object's keys sorted alphabetically. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object).sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    )
  }
  return value
}

const roundTrip = (input: InterchangeDoc) => toInterchange(fromInterchange(input, GROUP_NAME))

describe('fromInterchange → toInterchange on the shipped example', () => {
  it('comes back deep-equal (compared on sorted keys)', () => {
    expect(sortKeys(roundTrip(source))).toEqual(sortKeys(source))
  })

  it('differs from the source in field ORDER only — the one documented exception', () => {
    const out = roundTrip(source)
    // Same text once the keys are sorted…
    expect(JSON.stringify(sortKeys(out))).toBe(JSON.stringify(sortKeys(source)))
    // …and not the same text with the keys as written, because `toInterchange`
    // emits one fixed field order per element (description before lifecycle).
    expect(JSON.stringify(out)).not.toBe(JSON.stringify(source))
    const before = Object.keys(source.elements[0])
    const after = Object.keys(out.elements[0])
    expect([...after].sort()).toEqual([...before].sort())
    expect(after).toEqual(['key', 'kind', 'name', 'category', 'description', 'lifecycle', 'isManaged', 'iconType', 'aspects'])
  })

  it('normalises that order once and then holds still', () => {
    const first = roundTrip(source)
    const second = roundTrip(first)

    // byte-identical from the second export onwards: no drifting diffs
    expect(JSON.stringify(second, null, 2)).toBe(JSON.stringify(first, null, 2))
  })

  it('carries the document-level fields over untouched', () => {
    const out = roundTrip(source)

    expect(out.formatVersion).toBe(source.formatVersion)
    expect(out.design).toEqual(source.design)
    expect(out.elements).toHaveLength(source.elements.length)
    expect(out.connections).toHaveLength((source.connections ?? []).length)
    expect(out.diagrams).toHaveLength(source.diagrams.length)
  })

  it('gives keyless connections no key back', () => {
    const out = roundTrip(source)

    expect((source.connections ?? []).every((c) => !('key' in c))).toBe(true)
    expect(out.connections?.every((c) => !('key' in c))).toBe(true)
  })

  it('drops nothing from the model side either: every element is placed as before', () => {
    const model = fromInterchange(source, GROUP_NAME)

    expect(model.customerName).toBe(GROUP_NAME)
    expect(model.diagrams.every((d) => d.needsLayout)).toBe(true)
    // the document carries no geometry, so every placement starts at the origin
    expect(model.diagrams.every((d) => d.placements.every((p) => p.x === 0 && p.y === 0))).toBe(true)
  })
})

describe('fromInterchange → toInterchange on a synthetic document', () => {
  const synthetic: InterchangeDoc = {
    formatVersion: '1',
    design: { name: 'Klein', description: 'Een klein document.' },
    elements: [
      // lifecycle and isManaged explicitly at their default values: they must
      // come back, because the source said them out loud
      {
        key: 'app', kind: 'application', name: 'App', category: 'Kern',
        lifecycle: 'live', isManaged: true,
        aspects: { monitoring: { status: 'partial' }, 'self-healing': { status: 'none', note: 'Nachtelijke batch.' } },
      },
      // a component hanging off it: parentKey must survive
      { key: 'onderdeel', kind: 'component', parentKey: 'app', name: 'Onderdeel', technology: 'Java' },
      // non-default values without an explicit mention in the source: they are
      // carried because the VALUE differs from the default, not the mention
      { key: 'extern', kind: 'externalSystem', name: 'Extern', lifecycle: 'planned', isManaged: false },
      // nothing said at all: the export must stay silent too
      { key: 'stil', kind: 'actor', name: 'Stil' },
    ],
    connections: [
      { sourceKey: 'app', targetKey: 'extern', label: 'levert', protocol: 'REST', isBidirectional: true },
      { sourceKey: 'onderdeel', targetKey: 'app' },
    ],
    diagrams: [
      {
        key: 'l7', kind: 'layer7', name: 'Landschap',
        aspectConfig: [{ key: 'monitoring', label: 'Monitoring' }],
        places: [
          { elementKey: 'app', zone: 'landscape', domainGroup: 'Kern' },
          { elementKey: 'extern', zone: 'externalSystems' },
          { elementKey: 'stil', zone: 'actors' },
        ],
      },
      {
        key: 'cd', kind: 'container', name: 'App · containers', applicationKey: 'app',
        places: [{ elementKey: 'app' }, { elementKey: 'onderdeel' }],
      },
    ],
    adrLinks: [{ key: 'adr-1', title: 'Waarom REST' }],
  }

  it('round-trips deep-equal (sorted keys)', () => {
    expect(sortKeys(roundTrip(synthetic))).toEqual(sortKeys(synthetic))
  })

  it('keeps parentKey on the component', () => {
    const out = roundTrip(synthetic)

    expect(out.elements.find((e) => e.key === 'onderdeel')).toMatchObject({
      kind: 'component', parentKey: 'app', technology: 'Java',
    })
  })

  it('keeps aspects, notes and all', () => {
    const out = roundTrip(synthetic)

    expect(out.elements.find((e) => e.key === 'app').aspects).toEqual({
      monitoring: { status: 'partial' },
      'self-healing': { status: 'none', note: 'Nachtelijke batch.' },
    })
  })

  it('writes lifecycle/isManaged back where the source said them, and only there', () => {
    const out = roundTrip(synthetic)
    const byKey = (key: string) => out.elements.find((e) => e.key === key)

    // said explicitly at the default value → said again
    expect(byKey('app')).toMatchObject({ lifecycle: 'live', isManaged: true })
    // said explicitly at a non-default value → said again
    expect(byKey('extern')).toMatchObject({ lifecycle: 'planned', isManaged: false })
    // not said, and the model default applies → still not said
    expect('lifecycle' in byKey('stil')).toBe(false)
    expect('isManaged' in byKey('stil')).toBe(false)
    expect('lifecycle' in byKey('onderdeel')).toBe(false)
    expect('isManaged' in byKey('onderdeel')).toBe(false)
  })

  it('speaks up when the value drifts from the default, even unasked', () => {
    // 'stil' never mentioned its lifecycle; change it in the model and the
    // export must carry it — otherwise the edit would silently vanish
    const model = fromInterchange(synthetic, GROUP_NAME)
    model.elements = model.elements.map((e) =>
      e.id === 'stil' ? { ...e, lifecycle: 'retiring' as const, isManaged: false } : e)

    const out = toInterchange(model)

    expect(out.elements.find((e) => e.key === 'stil')).toMatchObject({
      lifecycle: 'retiring', isManaged: false,
    })
  })

  it('keeps zone and domainGroup on layer7 places and off container places', () => {
    const out = roundTrip(synthetic)
    const l7 = out.diagrams.find((d) => d.key === 'l7')
    const cd = out.diagrams.find((d) => d.key === 'cd')

    expect(l7.places).toEqual([
      { elementKey: 'app', zone: 'landscape', domainGroup: 'Kern' },
      { elementKey: 'extern', zone: 'externalSystems' },
      { elementKey: 'stil', zone: 'actors' },
    ])
    expect(cd.places).toEqual([{ elementKey: 'app' }, { elementKey: 'onderdeel' }])
    expect(cd.applicationKey).toBe('app')
  })

  it('keeps aspectConfig, adrLinks and isBidirectional', () => {
    const out = roundTrip(synthetic)
    const connections = out.connections ?? []

    expect(out.diagrams.find((d) => d.key === 'l7').aspectConfig)
      .toEqual([{ key: 'monitoring', label: 'Monitoring' }])
    expect(out.adrLinks).toEqual([{ key: 'adr-1', title: 'Waarom REST' }])
    expect(connections[0]).toMatchObject({ isBidirectional: true, label: 'levert', protocol: 'REST' })
    // a one-way connection stays silent about it (false is the default)
    expect('isBidirectional' in connections[1]).toBe(false)
  })
})

/**
 * `iconType` (roadmap agreement 3): an element's icon travels into the document,
 * as a closed vocabulary of the built-in keys.
 *
 * Three rules, and the third is the interesting one: an uploaded (`lib:`) key
 * never goes in, a built-in one always does, and a key this tool does not
 * recognise comes back because the source document carried it. Without that last
 * rule, exporting a document from another or newer tool would quietly throw its
 * icons away.
 */
describe('iconType', () => {
  const withIcons: InterchangeDoc = {
    formatVersion: '1',
    design: { name: 'Iconen' },
    elements: [
      { key: 'kern', kind: 'application', name: 'Kern', iconType: 'database' },
      { key: 'sap', kind: 'application', name: 'SAP', iconType: 'vendor-sap' },
      { key: 'toekomst', kind: 'application', name: 'Toekomst', iconType: 'iets-nieuws' },
      { key: 'kaal', kind: 'application', name: 'Kaal' },
    ],
    connections: [],
    diagrams: [
      {
        key: 'l7', kind: 'layer7', name: 'Landschap',
        places: [{ elementKey: 'kern', zone: 'landscape' }],
      },
    ],
  }

  it('round-trips a document that uses it', () => {
    expect(sortKeys(roundTrip(withIcons))).toEqual(sortKeys(withIcons))
  })

  it('reads it onto the element as iconKey', () => {
    const model = fromInterchange(withIcons, GROUP_NAME)
    const byKey = (key: string) => model.elements.find((e) => e.id === key)

    expect(byKey('kern')?.iconKey).toBe('database')
    expect(byKey('sap')?.iconKey).toBe('vendor-sap')
    // Unknown keys are TOLERATED, not dropped: the node falls back to its kind
    // glyph and the key survives the round trip.
    expect(byKey('toekomst')?.iconKey).toBe('iets-nieuws')
    expect(byKey('kaal')?.iconKey).toBeUndefined()
  })

  it('stays silent for an element with no icon', () => {
    const out = roundTrip(withIcons)
    expect('iconType' in out.elements.find((e) => e.key === 'kaal')).toBe(false)
  })

  it('writes a built-in key the editor just set, unasked', () => {
    const model = fromInterchange(withIcons, GROUP_NAME)
    model.elements = model.elements.map((e) =>
      e.id === 'kaal' ? { ...e, iconKey: 'rail-train' } : e)

    const out = toInterchange(model)

    expect(out.elements.find((e) => e.key === 'kaal')).toMatchObject({ iconType: 'rail-train' })
  })

  it('never writes an uploaded (lib:) key — that one lives in the working file', () => {
    // A data URL in someone's browser is neither topology nor semantics, and a
    // reviewer of this document could not resolve it anyway.
    const model = fromInterchange(withIcons, GROUP_NAME)
    model.elements = model.elements.map((e) =>
      e.id === 'kern' ? { ...e, iconKey: 'lib:eigen-merk' } : e)

    const out = toInterchange(model)

    expect('iconType' in out.elements.find((e) => e.key === 'kern')).toBe(false)
  })

  it('drops an unknown key the source never carried', () => {
    // Nothing in the editor can produce one, so if it appears it is corruption
    // rather than a document from another tool — and the source is the only
    // evidence that would justify writing it back.
    const model = fromInterchange(withIcons, GROUP_NAME)
    model.elements = model.elements.map((e) =>
      e.id === 'kaal' ? { ...e, iconKey: 'verzonnen' } : e)

    const out = toInterchange(model)

    expect('iconType' in out.elements.find((e) => e.key === 'kaal')).toBe(false)
  })

  it('returns the shipped example\'s icons unchanged', () => {
    // The example uses built-in marks throughout, which makes it the round-trip
    // case worth having: every `iconType` it carries is in the closed
    // vocabulary, so all of them must come back, on the same elements, spelled
    // the same way. An example without icons could not tell a working writer
    // from one that drops the field.
    const out = roundTrip(source)
    const icons = (doc: InterchangeDoc) =>
      doc.elements.filter((e) => 'iconType' in e).map((e) => `${e.key}=${e.iconType}`).sort()

    expect(icons(out)).toEqual(icons(source))
    expect(icons(out).length).toBeGreaterThan(20)
  })
})
