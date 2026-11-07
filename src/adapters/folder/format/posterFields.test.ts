// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a sheet's poster keeps, through a folder and a working file (ADR-0048).
 * The fields move with format 17, the one move version 4 makes: a file that says
 * none of them reads as it did, whatever number it carries, and is not rewritten
 * into saying them.
 */
import { describe, expect, it } from 'vitest'
import { fromArrays, toArrays } from '../../../model/normalised'
import { apply } from '../../../model/reducer'
import type { DesignDiagram, DesignElement } from '../../../model/types'
import { bareScope } from '../../../projects/scope'
import type { ScopeSnapshot } from '../../../projects/scope'
import { SCOPE_FILE, SCOPE_FORMAT_VERSION, scopeFiles, scopeFromFolder } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { openDocumentBytes, workingFileBytes } from './workingFile'

const element = (id: string, over: Partial<DesignElement>): DesignElement => ({
  id, name: id, kind: 'function', lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})

const placed: DesignDiagram = {
  id: 'sheet', kind: 'sheet', name: 'Business', members: [], paper: 'wide', journeyId: 'journey', labels: ['tile'],
  poster: { tile: 's', bandRows: 2, foot: 'Draft', items: [{ id: 'n1', kind: 'note', text: 'Said here' }, { id: 'p1', kind: 'picture', image: 'sha256:abc', alt: 'The depot' }] },
  geometry: {
    nodes: [{ id: 'area', x: 188, y: 120, width: 400, height: 90 }, { id: 'journey', x: 188, y: 0, width: 1672, height: 112 }],
    groups: [{ id: 'rail', x: 0, y: 0, width: 176, height: 900 }],
    cells: [{ id: 'tile', col: 1, row: 0, span: 2 }],
    items: [{ id: 'n1', x: 1, y: 2, width: 90, height: 60 }, { id: 'p1', x: 3, y: 4, width: 90, height: 60 }],
  },
}

function snapshot(diagram: DesignDiagram): ScopeSnapshot {
  const scope = bareScope('', 'Scope')
  scope.model.elements.push(element('area', {}), element('tile', { parentId: 'area' }), element('journey', { kind: 'step', icon: 'truck' }))
  scope.model.diagrams.push(diagram)
  return scope
}

const sheetIn = (scope: ScopeSnapshot | undefined) => scope?.model.diagrams.find((one) => one.id === 'sheet')

describe('a sheet\'s poster', () => {
  it('reads back as written through a folder', () => {
    const back = scopeFromFolder(scopeFiles(snapshot(placed)), '')
    expect(sheetIn(back)).toEqual(placed)
    expect(back?.model.elements.find((one) => one.id === 'journey')?.icon).toBe('truck')
  })

  it('splits as a board does: places in the geometry file, what it says in the definition', () => {
    const files = scopeFiles(snapshot(placed))
    const text = (path: string) => { const file = files.find((one) => one.path === path); return file && 'text' in file ? JSON.parse(file.text) as Record<string, unknown> : {} }
    expect(Object.keys(text('diagrams/sheet.geometry.json'))).toEqual(expect.arrayContaining(['nodes', 'groups', 'cells', 'items']))
    expect(text('diagrams/sheet.json')).toMatchObject({ paper: 'wide', labels: ['tile'], poster: { tile: 's' } })
    expect(text('diagrams/sheet.json')).not.toHaveProperty('cells')
  })

  it('reads back as written through the working file', () => {
    const held = snapshot(placed)
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    expect(opened.ok && sheetIn(opened.scope)).toEqual(placed)
  })

  it('survives being indexed and written again, whatever order its rows came in', () => {
    const shuffled = { ...placed, geometry: { ...placed.geometry!, nodes: [...placed.geometry!.nodes].reverse(), items: [...placed.geometry!.items!].reverse() } }
    const scope = snapshot(shuffled)
    expect(toArrays(fromArrays(scope.model)).diagrams.find((one) => one.id === 'sheet')).toEqual(placed)
  })
})

describe('a file that says none of it', () => {
  const plain: DesignDiagram = { id: 'sheet', kind: 'sheet', name: 'Business', members: [], geometry: { nodes: [] } }

  function atVersion(files: readonly FolderFile[], version: number): FolderFile[] {
    return files.map((file) => (file.path === SCOPE_FILE && 'text' in file
      ? { ...file, text: file.text.replace(`"version": ${SCOPE_FORMAT_VERSION}`, `"version": ${version}`) }
      : file))
  }

  it('reads as it did at the number before and at this one, and gains no field by being read and written', () => {
    for (const version of [SCOPE_FORMAT_VERSION - 1, SCOPE_FORMAT_VERSION]) {
      const back = scopeFromFolder(atVersion(scopeFiles(snapshot(plain)), version), '')
      expect(sheetIn(back)).toEqual(plain)
      const again = scopeFiles(back!).find((file) => file.path === 'diagrams/sheet.geometry.json')
      expect(again && 'text' in again && JSON.parse(again.text)).toEqual({ nodes: [] })
    }
  })

  it('a sheet with no geometry file at all is computed, and opening one writes nothing', () => {
    const files = scopeFiles(snapshot(plain)).filter((file) => file.path !== 'diagrams/sheet.geometry.json')
    const back = scopeFromFolder(files, '')
    expect(sheetIn(back)?.geometry?.nodes).toEqual([])
  })

  it('a first place on such a sheet takes one step, and its inverse gives the file back', () => {
    const model = fromArrays(snapshot(plain).model)
    const step = apply(model, { type: 'node.set', diagramId: 'sheet', nodes: [{ id: 'area', x: 1, y: 1 }] })
    if (!step.ok) throw new Error(step.reason)
    const undone = apply(step.model, step.inverse)
    expect(undone.ok && toArrays(undone.model).diagrams.find((one) => one.id === 'sheet')).toEqual(plain)
  })
})
