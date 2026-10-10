// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing round-trips as text: the definition, the XML, the picture's
 * address and the links. An older scope is read without drawings.
 */
import { describe, expect, it } from 'vitest'
import { sealBytes, unsealBytes } from '../../../projects/sealedFile'
import { stableJson } from '../../../projects/text'
import type { ScopeSnapshot } from '../../../projects/scope'
import type { DesignDiagram } from '../../../model'
import {
  DRAWIO_SUFFIX, isFormatPath, SCOPE_FILE, scopeFiles, scopeFromFolder,
} from './folderFormat'
import { openDocumentBytes, workingFileBytes } from './workingFile'

const XML = '<mxfile><diagram name="Context"><mxCell id="a" link="element:billing"/></diagram></mxfile>'

const drawing: DesignDiagram = {
  id: 'ctx',
  kind: 'drawing',
  name: 'Context',
  elementId: 'billing',
  c4Level: 'context',
  members: [],
  drawing: {
    xml: XML,
    picture: 'sha256:abc',
    links: [{ shapeId: 'a', elementId: 'billing', area: { x: 10, y: 20, width: 80, height: 40 } }],
  },
}

const board: DesignDiagram = {
  id: 'l7', kind: 'layer7', name: 'Landscape', members: [], geometry: { nodes: [] },
}

function scope(): ScopeSnapshot {
  return {
    path: 'acme',
    model: { name: 'Acme', elements: [], relations: [], diagrams: [board, drawing] },
    activeDiagramId: 'ctx',
    logoLibrary: [],
  }
}

describe('a drawing in the folder', () => {
  it('treats a drawio file as a format path of that view', () => {
    expect(isFormatPath('diagrams/ctx.drawio')).toBe(true)
    expect(isFormatPath('diagrams/nested/ctx.drawio')).toBe(false)
  })

  it('round-trips the XML, the picture and the links, and writes no geometry file', () => {
    const files = scopeFiles(scope())
    const paths = files.map((file) => file.path)
    expect(paths).toContain(`diagrams/ctx${DRAWIO_SUFFIX}`)
    expect(paths).not.toContain('diagrams/ctx.geometry.json')
    expect(paths).toContain('diagrams/l7.geometry.json')
    const xml = files.find((file) => file.path === `diagrams/ctx${DRAWIO_SUFFIX}`)
    expect(xml && 'text' in xml && xml.text).toBe(XML)
    const back = scopeFromFolder(files, 'acme')
    expect(back?.model.diagrams.find((held) => held.id === 'ctx')).toEqual(drawing)
    expect(stableJson(scopeFromFolder(scopeFiles(back!), 'acme'))).toBe(stableJson(back))
  })

  it('reads a version-9 scope with no drawings', () => {
    const files = scopeFiles(scope()).map((file) => (
      file.path === SCOPE_FILE && 'text' in file
        ? { ...file, text: file.text.replace('"version": 10', '"version": 9') }
        : file
    ))
    const back = scopeFromFolder(files, 'acme')
    expect(back?.model.diagrams.map((held) => held.kind)).toEqual(['layer7'])
    expect(back?.unread).toBeUndefined()
  })

  it('round-trips through a working file and a sealed file', async () => {
    const held = scope()
    const zip = workingFileBytes([held])
    const opened = openDocumentBytes(zip, held)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.scope.model.diagrams.find((one) => one.id === 'ctx')).toEqual(drawing)
    const again = workingFileBytes([opened.scope])
    expect(again).toEqual(zip)

    const sealed = await sealBytes(zip, 'correct horse', { iterations: 1000 })
    const plain = await unsealBytes(sealed, 'correct horse')
    expect(plain).toBeDefined()
    const unsealed = openDocumentBytes(plain!, held)
    expect(unsealed.ok).toBe(true)
    if (!unsealed.ok) return
    const restored = unsealed.scope.model.diagrams.find((one) => one.id === 'ctx')
    expect(restored?.kind === 'drawing' && restored.drawing?.xml).toBe(XML)
    expect(restored?.kind === 'drawing' && restored.drawing).toEqual(drawing.drawing)
  })
})
