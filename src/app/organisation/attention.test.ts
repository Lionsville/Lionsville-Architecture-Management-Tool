import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import type { Finding } from '../../projects/checks'
import { attentionItems } from './attention'
import type { RegisterRow } from './register'
import type { TechnologyRow } from './technologyRegister'

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
      ['finance', 'crm', 'Nothing in this organisation defines CRM'],
      ['retail', 'erp', 'ERP is also defined in finance'],
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
      'Message brokering is offered, but no platform delivers it \u2014 add the platform that realises it, or withdraw the service.',
      'Nobody has said whose Post office is',
    ])
    expect(items.map((item) => [item.scope, item.id])).toEqual([['platforms', 'brokering'], ['retail', 'post']])
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
