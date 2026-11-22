// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The generated API, held: every tool has one method or a sentence for why
 * it has none, no two tools share a method, and the whole of it — every
 * signature — is in a file beside this one, so a change to a tool's schema
 * shows in a diff as the change to a script's API that it is.
 */
import { describe, expect, it } from 'vitest'
import { TOOLS } from '../tools'
import { ABSENT, NOT_IN_SCRIPTS, apiOf, areasOf, methodName, scriptMethod } from './api'
import { sharedDeclarations, signatureOf, SHARED_SHAPES } from './signature'

const api = apiOf()

describe('the vocabulary as a script sees it', () => {
  it('gives every tool one method, or says why it has none', () => {
    for (const tool of TOOLS) {
      const at = scriptMethod(tool.name)
      if (at === undefined) expect(ABSENT[tool.name], tool.name).toMatch(/\.$/)
      else expect(methodName(at), tool.name).toMatch(/^([A-Za-z]+\.)?[A-Za-z]+$/)
    }
    expect(Object.keys(ABSENT).sort()).toEqual(['batch', 'undo'])
    const names = api.map((one) => one.name)
    expect(new Set(names).size).toBe(names.length)
    expect(api).toHaveLength(TOOLS.length - Object.keys(ABSENT).length)
  })

  it('renames no tool: a method is its tool\'s verb on its noun\'s area, but for the exceptions said', () => {
    const moved = api.filter((one) => !one.tool.name.endsWith(`.${one.method}`) && one.tool.name !== one.method).map((one) => `${one.tool.name} → ${one.name}`)
    expect(moved).toEqual([
      'merge.plan → preview.merge',
      'move.plan → preview.move',
      'platform.report → reports.platform',
      'service.report → reports.service',
      'connect → connections.add',
      'connections.update → connections.updateMany',
      'connections.remove → connections.removeMany',
      'principleGroups.set → principles.setGroups',
    ])
    expect(api.find((one) => one.tool.name === 'search')).toMatchObject({ area: '', name: 'search' })
    expect(api.filter((one) => one.area === 'canvas').map((one) => one.method).sort())
      .toEqual(['align', 'distribute', 'focus', 'group', 'moveBy', 'placeNextTo', 'ungroup'])
    // Neighbours: one of a kind and its list are on one area.
    expect(api.filter((one) => one.area === 'people').map((one) => one.method).sort()).toEqual(['add', 'leave', 'list', 'takeBackLeaving'])
    expect(api.find((one) => one.tool.name === 'plan.move')?.name).toBe('plans.move')
  })

  it('names every tool a script may not call, each with a sentence that says where to go', () => {
    for (const [tool, sentence] of Object.entries(NOT_IN_SCRIPTS)) {
      expect(TOOLS.some((one) => one.name === tool), tool).toBe(true)
      expect(sentence, tool).toMatch(/use the plain tool, or call\.$|Use the plain tool, or call\.$/)
    }
    // Whatever draws, moves the app or is of the drive tier is one of them: none can be tried on a copy.
    for (const one of api) {
      const needsAScreen = (one.tool.tier === 'see' && one.tool.onASheet === undefined && !['element.draw', 'element.undraw', 'group', 'ungroup'].includes(one.tool.name))
        || one.tool.tier === 'drive'
      if (needsAScreen) expect(one.notInScript, one.tool.name).toBeDefined()
    }
    expect(api.find((one) => one.name === 'observations.move')?.notInScript).toContain('two scopes')
    expect(api.find((one) => one.name === 'elements.list')?.notInScript).toBeUndefined()
  })

  it('leaves out of a host\'s API what the host does not have', () => {
    const noScreen = apiOf((tool) => tool.tier !== 'see' && tool.tier !== 'drive')
    expect(noScreen.some((one) => one.area === 'canvas' || one.area === 'app')).toBe(false)
    expect(areasOf(noScreen)).toContain('elements')
  })

  it('is, whole, what the file beside this test says', async () => {
    const lines = [
      ...sharedDeclarations(),
      '',
      ...areasOf(api).flatMap((area) => [
        `// lv${area ? `.${area}` : ''}`,
        ...api.filter((one) => one.area === area).map((one) => `${signatureOf(one.method, one.tool.inputSchema)}${one.notInScript !== undefined ? ' // not in a script' : ''}  // ${one.tool.name}`),
        '',
      ]),
    ]
    await expect(`${lines.join('\n')}`).toMatchFileSnapshot('./api.snapshot.txt')
  })
})

describe('a signature', () => {
  const schema = (name: string) => TOOLS.find((tool) => tool.name === name)!.inputSchema

  it('is written from the schema: unions, optionals, rows, and a page by name', () => {
    expect(signatureOf('list', schema('elements.list'))).toMatch(/^list\(args\?: \{ kind\?: "actor" \| .* \} & ListArgs\): Promise<unknown>$/)
    expect(signatureOf('current', schema('project.current'))).toBe('current(): Promise<unknown>')
    expect(signatureOf('describe', schema('element.describe'))).toBe('describe(args: { id: string }): Promise<unknown>')
    expect(signatureOf('list', schema('scopes.list'))).toBe('list(args?: ListArgs): Promise<unknown>')
  })

  it('never says scope or ifRevision, and names the shapes many tools share', () => {
    for (const one of api) expect(signatureOf(one.method, one.tool.inputSchema), one.name).not.toMatch(/ifRevision/)
    // The scope every tool takes is `lv.in`'s; a scope a tool spells for itself — a filter, a destination — stays.
    expect(signatureOf('list', schema('elements.list'))).not.toContain('scope')
    expect(signatureOf('add', schema('element.add'))).not.toMatch(/[{;] scope\?: string/)
    expect(signatureOf('list', schema('checks.list'))).toContain('scope?: string')
    expect(signatureOf('record', schema('observation.record'))).toContain('by: PersonRef')
    expect(signatureOf('record', schema('observation.record'))).toContain('principles?: PrinciplesCited')
    expect(signatureOf('relate', schema('principle.relate'))).toContain('to: PrincipleRef')
    expect(Object.keys(SHARED_SHAPES)).toEqual(['PersonRef', 'PrincipleRef', 'PrinciplesCited', 'ListArgs'])
  })

  it('costs a fraction of the schemas it is written from', () => {
    const signatures = api.map((one) => signatureOf(one.method, one.tool.inputSchema)).join('\n').length
    const schemas = JSON.stringify(api.map((one) => one.tool.inputSchema)).length
    expect(signatures).toBeLessThan(30_000)
    expect(signatures * 4).toBeLessThan(schemas)
  })
})
