// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { EN } from '../i18n/strings.en'
import type { Command } from '../model/commands'
import type { DesignElement } from '../model/types'
import type { ImageEntry } from '../model/imageName'
import { applySteps, emptyContent, recordsOfCommand, SCOPE_REFUSALS } from './scopeState'
import type { ScopeCommand, ScopeContent, ScopeStep } from './scopeState'

function element(id: string, name: string): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {} }
}

function content(): ScopeContent {
  return {
    ...emptyContent('Rail', { kind: 'domain' }),
    model: {
      name: 'Rail',
      elements: [element('crews', 'Crews')],
      relations: [],
      diagrams: [{ id: 'l7', kind: 'layer7', name: 'Landscape', members: [], geometry: { nodes: [] } }],
    },
  }
}

const picture: ImageEntry = {
  name: 'diagrams/context.png', mediaType: 'image/png', size: 3, width: 40, height: 30,
  contentAddress: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
}

let minted = 0
function steps(...commands: ScopeCommand[]): ScopeStep[] {
  return commands.map((command) => ({ stepId: `step-${++minted}`, command, at: Date.UTC(2026, 8, 29) }))
}

describe('a new scope', () => {
  it('holds a model with its name and nothing else', () => {
    expect(emptyContent('Globex', { kind: 'organisation' })).toEqual({
      kind: 'organisation', model: { name: 'Globex', elements: [], relations: [], diagrams: [] }, images: [],
    })
  })
})

describe('applying steps', () => {
  it('applies a model command as the reducer does, and leaves what went in untouched', () => {
    const before = content()
    const held = structuredClone(before)
    const result = applySteps(before, steps({ type: 'element.update', id: 'crews', patch: { name: 'Crew planning' } }))
    expect(result.ok && result.content.model.elements[0].name).toBe('Crew planning')
    expect(result.ok && result.changed).toBe(true)
    expect(before).toEqual(held)
  })

  it('says a run that changes nothing changed nothing, and answers what it was given', () => {
    const before = content()
    const result = applySteps(before, steps({ type: 'diagram.rename', id: 'l7', name: 'Landscape' }))
    expect(result).toEqual({ ok: true, content: before, changed: false, records: [{ kind: 'diagram', id: 'l7' }] })
  })

  it('applies all or none, and names the step that was refused', () => {
    const run = steps(
      { type: 'element.create', element: element('depot', 'Depot') },
      { type: 'element.update', id: 'nowhere', patch: { name: 'X' } },
    )
    expect(applySteps(content(), run)).toEqual({ ok: false, refused: 'command.gone', stepId: run[1].stepId })
  })

  it('names every record the run wrote, once each', () => {
    const result = applySteps(content(), steps(
      { type: 'element.update', id: 'crews', patch: { name: 'A' } },
      { type: 'element.update', id: 'crews', patch: { name: 'B' } },
      { type: 'image.add', image: picture },
      { type: 'scope.describe', patch: { client: 'Globex' } },
    ))
    expect(result.ok && result.records).toEqual([
      { kind: 'element', id: 'crews' }, { kind: 'image', id: 'diagrams/context.png' }, { kind: 'scope', id: '' },
    ])
  })

  it('names no record for a run that writes none', () => {
    const result = applySteps(content(), steps({ type: 'transaction', commands: [] }))
    expect(result.ok && result.records).toEqual([])
  })

  it('says a command may have written anything where the model cannot say what it writes', () => {
    expect(recordsOfCommand({ type: 'nobody.knows' } as unknown as Command)).toBeUndefined()
    expect(recordsOfCommand({ type: 'image.remove', name: 'a.png' })).toEqual([{ kind: 'image', id: 'a.png' }])
  })
})

describe('the image library, as steps', () => {
  it('adds an entry and takes it out again', () => {
    const added = applySteps(content(), steps({ type: 'image.add', image: picture }))
    expect(added.ok && added.content.images).toEqual([picture])
    if (!added.ok) return
    const removed = applySteps(added.content, steps({ type: 'image.remove', name: picture.name }))
    expect(removed.ok && removed.content.images).toEqual([])
  })

  it('refuses a second picture under a name the library holds, as a create on a taken id', () => {
    const added = applySteps(content(), steps({ type: 'image.add', image: picture }))
    if (!added.ok) throw new Error('not added')
    const again = applySteps(added.content, steps({ type: 'image.add', image: { ...picture, size: 9 } }))
    expect(again.ok ? undefined : again.refused).toBe('command.taken')
  })

  it('refuses to take out a picture the library does not hold', () => {
    const result = applySteps(content(), steps({ type: 'image.remove', name: 'absent.png' }))
    expect(result.ok ? undefined : result.refused).toBe('command.gone')
  })

  it('refuses a name no picture may have', () => {
    const result = applySteps(content(), steps({ type: 'image.add', image: { ...picture, name: '../escape.png' } }))
    expect(result.ok ? undefined : result.refused).toBe('shell.imageBadName')
  })
})

describe('what a scope says about itself, as steps', () => {
  it('sets and clears, as a patch does', () => {
    const set = applySteps(content(), steps({ type: 'scope.describe', patch: { client: 'Globex', links: [{ label: 'Wiki', url: 'https://example.org' }] } }))
    if (!set.ok) throw new Error('not set')
    expect(set.content.client).toBe('Globex')
    const cleared = applySteps(set.content, steps({ type: 'scope.describe', patch: { client: undefined, kind: 'team' } }))
    if (!cleared.ok) throw new Error('not cleared')
    expect(cleared.content).not.toHaveProperty('client')
    expect(cleared.content.kind).toBe('team')
    expect(cleared.content.links).toEqual([{ label: 'Wiki', url: 'https://example.org' }])
  })

  it('changes nothing when it says what is already said', () => {
    const result = applySteps(content(), steps({ type: 'scope.describe', patch: { kind: 'domain' } }))
    expect(result.ok && result.changed).toBe(false)
  })

  it('refuses a key it does not know, and a kind that is not a label', () => {
    for (const patch of [{ name: 'Other' }, { kind: 'kingdom' }, null]) {
      const result = applySteps(content(), steps({ type: 'scope.describe', patch } as unknown as ScopeCommand))
      expect(result.ok ? undefined : result.refused).toBe('command.notAField')
    }
  })
})

describe('the refusals', () => {
  it('are keys the shell has words for', () => {
    for (const key of SCOPE_REFUSALS) expect(EN).toHaveProperty([key])
  })
})
