// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import { isCheckKey } from '../../model/checkCatalogue'
import type { Finding } from '../../projects/checks'
import { attentionItems, findingKind } from './attention'
import type { RegisterRow } from './register'
import type { TechnologyRow } from '../../projects/technologyRegister'

/**
 * The block under the cards: the findings the cards and the rows used to
 * count, as sentences, each naming a scope and a record to open. Nothing is
 * worked out here that the shell had not already read.
 */
const s = translator('en')
const scopeName = (path: string) => (path === '' ? 'the organisation' : path.split('/').pop()!)

const finding = (over: Partial<Finding> & Pick<Finding, 'key' | 'scope' | 'id' | 'name'>): Finding => over

const service = (over: Partial<TechnologyRow> & Pick<TechnologyRow, 'id' | 'name'>): TechnologyRow => ({
  kind: 'platformService', master: 'platforms', declarations: [], drawnIn: [], findings: [],
  maintainers: [], consumers: { applications: 0, scopes: 0 }, realisedBy: [], realises: [], hosts: 0,
  ...over,
})

const application = (over: Partial<RegisterRow> & Pick<RegisterRow, 'id' | 'name'>): RegisterRow => ({
  drawnIn: [], findings: [], ...over,
})

describe('attentionItems', () => {
  it('opens a shape on a drawing by its drawing, not as an element', () => {
    const findings = new Map<string, Finding[]>([
      ['retail', [finding({ key: 'check.drawingLinkMissing', scope: 'retail', id: 'ctx:b', view: 'ctx', name: 'Context', fields: ['gone'], detail: 'gone' })]],
    ])
    expect(attentionItems(findings, [], [], '', s, scopeName)).toMatchObject([{ scope: 'retail', id: 'ctx:b', view: 'ctx' }])
  })

  it('opens a finding about the operating model on its page, with the item picked, not as an element', () => {
    const findings = new Map<string, Finding[]>([
      ['', [
        finding({ key: 'check.unitTypeNowhere', scope: '', id: 'ut-guild', name: 'Guild' }),
        finding({ key: 'check.accountability', scope: '', id: 'rs-release', name: 'Release' }),
        finding({ key: 'check.dangling', scope: '', id: 'crm', name: 'CRM' }),
      ]],
    ])
    const items = attentionItems(findings, [], [], '', s, scopeName)
    expect(items.map((item) => [item.id, item.page])).toEqual([['crm', undefined], ['ut-guild', 'operating'], ['rs-release', 'operating']])
  })

  it('says the operating model\'s own findings off the organisation\'s document, once each', () => {
    const operating = {
      unitTypes: [{ id: 'ut-guild', name: 'Guild', within: [], slots: [] }],
      roles: [], responsibilities: [{ id: 'rs-release', name: 'Release' }],
    }
    // The same finding handed in by the tree as well is said once.
    const findings = new Map<string, Finding[]>([['', [finding({ key: 'check.unitTypeNowhere', scope: '', id: 'ut-guild', name: 'Guild' })]]])
    const items = attentionItems(findings, [], [], '', s, scopeName, [], operating)
    expect(items.map((item) => [item.key, item.id, item.page])).toEqual([
      ['check.unitTypeNowhere', 'ut-guild', 'operating'], ['check.accountability', 'rs-release', 'operating'],
    ])
    expect(items[1].text).toContain('Release')
    // A domain's home says nothing of the organisation's.
    expect(attentionItems(undefined, [], [], 'retail', s, scopeName, [], operating)).toEqual([])
  })

  it('says each finding as a sentence, skips information, and sorts by scope', () => {
    const findings = new Map<string, Finding[]>([
      ['retail', [
        finding({ key: 'check.conflict', scope: 'retail', id: 'erp', name: 'ERP', scopes: ['finance'] }),
        finding({ key: 'check.notDrawn', scope: 'retail', id: 'wms', name: 'WMS', information: true }),
      ]],
      ['finance', [finding({ key: 'check.dangling', scope: 'finance', id: 'crm', name: 'CRM' })]],
    ])
    const items = attentionItems(findings, [], [], '', s, scopeName)
    expect(items.map((item) => [item.scope, item.id, item.text])).toEqual([
      ['finance', 'crm', 'CRM stands in for something nothing in the organisation defines — define it here, or delete the stand-in'],
      ['retail', 'erp', 'ERP is defined both here and in finance — keep one definition and make the other a stand-in with Link…'],
    ])
  })

  it('adds an application nobody has said whose it is, and a service nothing delivers', () => {
    const register = [
      application({ id: 'post', name: 'Post office', master: 'retail', outside: true }),
      application({ id: 'wms', name: 'WMS', master: 'retail' }),
    ]
    const technology = [
      service({ id: 'brokering', name: 'Message brokering' }),
      service({ id: 'containers', name: 'Container platform', realisedBy: [{ id: 'openshift', name: 'OpenShift' }] }),
    ]
    const items = attentionItems(undefined, register, technology, '', s, scopeName)
    expect(items.map((item) => item.text)).toEqual([
      'Message brokering is offered, but no platform delivers it \u2014 add the platform that delivers it, or withdraw the service.',
      'Post office is outside the organisation and nobody has said whose it is — name the party on its page',
    ])
    expect(items.map((item) => [item.scope, item.id])).toEqual([['platforms', 'brokering'], ['retail', 'post']])
    // The kind each row carries on screen: the key without its table.
    expect(items.map((item) => item.kind)).toEqual(['unrealised', 'unattributed'])
    // Each a check of the catalogue's, which a list groups them by.
    expect(items.map((item) => item.key)).toEqual(['check.unrealised', 'check.unattributed'])
    for (const item of items) expect(isCheckKey(item.key), item.key).toBe(true)
  })

  it('names each finding by its kind, the key without the table it is said from', () => {
    expect(findingKind('check.conflict')).toBe('conflict')
    expect(findingKind('check.danglingEnd')).toBe('danglingEnd')
    expect(findingKind('techRegister.unrealised')).toBe('unrealised')
    const findings = new Map<string, Finding[]>([
      ['retail', [finding({ key: 'check.conflict', scope: 'retail', id: 'erp', name: 'ERP', scopes: ['finance'] })]],
    ])
    expect(attentionItems(findings, [], [], '', s, scopeName).map((item) => item.kind)).toEqual(['conflict'])
  })

  it('speaks only for the scope whose home it is, and says one thing once', () => {
    const findings = new Map<string, Finding[]>([
      ['retail/warehouse', [finding({ key: 'check.drift', scope: 'retail/warehouse', id: 'wms', name: 'WMS', scopes: ['retail'] })]],
      ['finance', [
        finding({ key: 'check.dangling', scope: 'finance', id: 'crm', name: 'CRM' }),
        finding({ key: 'check.dangling', scope: 'finance', id: 'crm', name: 'CRM' }),
      ]],
    ])
    expect(attentionItems(findings, [], [], 'retail', s, scopeName).map((item) => item.id)).toEqual(['wms'])
    expect(attentionItems(findings, [], [], '', s, scopeName).map((item) => item.id)).toEqual(['crm', 'wms'])
  })
})
