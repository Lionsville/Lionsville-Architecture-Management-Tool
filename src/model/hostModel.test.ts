/**
 * What the shell recognises on disk, and the one question it asks before
 * swapping one document for another.
 *
 * Applying a change is not here any more, and that is the point: it went to the
 * reducer with the batch (ADR-0002), and `reducer.test.ts` is where it is
 * proved.
 */
import { describe, expect, it } from 'vitest'
import type { DesignConnection, DesignElement, DiagramPlacement } from '.'
import type { HostModel } from './fromInterchange'
import {
  isInterchange, isWorkingFile, needsRemount, workingFileLogoLibrary,
  WORKING_FILE_TYPE, WORKING_FILE_VERSION,
} from './hostModel'

function element(id: string, name: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name, lifecycle: 'live', isManaged: true,
    aspects: {}, parameters: {}, ...over,
  }
}

function connection(id: string, sourceId: string, targetId: string): DesignConnection {
  return { id, sourceId, targetId, isBidirectional: false }
}

function place(elementId: string, x = 0, y = 0): DiagramPlacement {
  return { elementId, x, y }
}

/** A model with two diagrams, so "this diagram only" is visible. */
function model(over: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Acme Logistics',
    customerName: 'Acme Logistics',
    elements: [element('crews', 'Crews'), element('reisinfo', 'Reisinformatie')],
    connections: [connection('c#1', 'crews', 'reisinfo')],
    diagrams: [
      { id: 'l7', kind: 'layer7', name: 'Landschap', placements: [place('crews', 10, 20), place('reisinfo', 30, 40)] },
      { id: 'cd', kind: 'container', name: 'Crews · containers', placements: [place('crews', 5, 5)] },
    ],
    ...over,
  }
}

describe('isWorkingFile / isInterchange', () => {
  it('recognises a working file by its type tag and version', () => {
    expect(isWorkingFile({ type: WORKING_FILE_TYPE, version: 1, model: model() })).toBe(true)
    expect(isWorkingFile({ type: 'something-else' })).toBe(false)
    expect(isWorkingFile({})).toBe(false)
    expect(isWorkingFile(null)).toBe(false)
    // The tag alone is not a file: a bare string carries no model to read.
    expect(isWorkingFile(WORKING_FILE_TYPE)).toBe(false)
  })

  it('refuses a version it cannot read, rather than reading half of it', () => {
    // This shell always writes a version, so an unknown one is a file from a
    // LATER tool and not an older one. Half-reading it would silently drop
    // whatever that version added.
    expect(isWorkingFile({ type: WORKING_FILE_TYPE, version: 3, model: model() })).toBe(false)
    expect(isWorkingFile({ type: WORKING_FILE_TYPE, model: model() })).toBe(false)
    // Both versions this shell has written still open: v1 simply has no decisions.
    expect(isWorkingFile({ type: WORKING_FILE_TYPE, version: 1, model: model() })).toBe(true)
    expect(isWorkingFile({ type: WORKING_FILE_TYPE, version: 2, model: model() })).toBe(true)
  })

  it('refuses a file written by the tool this one replaces', () => {
    // Deliberate, and pinned here so it reads as a decision rather than as an
    // oversight: the working file was redefined rather than extended, and the
    // files the old shell wrote are not opened. Nobody had one worth keeping —
    // and paying for compatibility on every later change would have cost more
    // than the break did.
    expect(isWorkingFile({ type: 'solution-design-werkbestand', version: 1, model: model() })).toBe(false)
    expect(isWorkingFile({ type: 'solution-design-werkbestand', version: 2, model: model() })).toBe(false)
  })

  it('refuses a tag it does not know at all', () => {
    expect(isWorkingFile({ type: 'some-other-tool', version: 1, model: model() })).toBe(false)
  })

  it('recognises an interchange document by formatVersion + elements', () => {
    expect(isInterchange({ formatVersion: '1', elements: [] })).toBe(true)
    expect(isInterchange({ formatVersion: '1' })).toBe(false)
    expect(isInterchange({ elements: [] })).toBe(false)
    expect(isInterchange(null)).toBe(false)
  })

  it('does not mistake one for the other', () => {
    const workingFile = { type: WORKING_FILE_TYPE, version: 1, model: model() }
    expect(isInterchange(workingFile)).toBe(false)
    expect(isWorkingFile({ formatVersion: '1', elements: [] })).toBe(false)
  })
})

/**
 * The logo library inside a working file.
 *
 * Optional rather than required: a file written before anyone uploaded a mark
 * has no library at all, and an element whose `iconKey` points at a mark that is
 * not there falls back to its kind glyph — the package's own degradation rule,
 * not a special case invented here.
 */
describe('working file logo library', () => {
  const base = { type: WORKING_FILE_TYPE, version: WORKING_FILE_VERSION, model: model() } as const
  const library = [{ key: 'lib:own-mark', label: 'Own mark', url: 'data:image/png;base64,AAA' }]

  it('saves in the newest version this shell knows', () => {
    expect(WORKING_FILE_VERSION).toBe(2)
  })

  it('reads the library out of a file that carries one', () => {
    expect(workingFileLogoLibrary({ ...base, logoLibrary: library })).toEqual(library)
  })

  it('gives a file without one an empty library instead of undefined', () => {
    expect(workingFileLogoLibrary(base)).toEqual([])
  })

  it('tolerates a file whose library field is junk', () => {
    // Hand-edited files exist. An empty library loses the marks; a crash loses
    // the whole diagram.
    const junk = { ...base, logoLibrary: 'nope' as unknown as [] }
    expect(workingFileLogoLibrary(junk)).toEqual([])
  })
})

/**
 * A container diagram belongs to one application. If that application leaves the
 * model, what remains otherwise is a tab named after something that no longer
 * exists.
 */
describe('needsRemount', () => {
  it('remount als de plaat opnieuw gelegd moet worden', () => {
    // The package's settle pass runs once per id per editor instance.
    expect(needsRemount(model(), model(), true)).toBe(true)
  })

  it('no remount for the same diagrams without a re-layout', () => {
    expect(needsRemount(model(), model(), false)).toBe(false)
  })

  it('remounts when a diagram is added or removed', () => {
    const before = model()
    const after = { ...before, diagrams: before.diagrams.filter((d) => d.id !== 'cd') }
    expect(needsRemount(before, after, false)).toBe(true)
    expect(needsRemount(after, before, false)).toBe(true)
  })

  it('remounts when the ids differ, even with the same number of diagrams', () => {
    const before = model()
    const after = {
      ...before,
      diagrams: before.diagrams.map((d) => ({ ...d, id: `${d.id}-nieuw` })),
    }
    expect(needsRemount(before, after, false)).toBe(true)
  })

  it('looks at the set and not at the order', () => {
    const before = model()
    const after = { ...before, diagrams: [...before.diagrams].reverse() }
    expect(needsRemount(before, after, false)).toBe(false)
  })
})
