// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A service's report, on screen (ADR-0014 §2.8).
 *
 * The arithmetic is pinned in `model/serviceReport.test.ts`; what is pinned
 * here is what the page promises a reader — the service and whether it is
 * shared, who maintains it and what realises it with an honest word where
 * there is nothing, the table of who leans on it with the container and the
 * scope beside each, and which of them would be stranded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { ServiceReportPage } from './ReportPage'
import type { ServiceReportPageProps } from './ReportPage'
import { renderShell } from '../../app/testing/renderShell'
import { element } from '../../model/testFixtures'
import type { DesignModel, Relation } from '../../model'

afterEach(() => cleanup())

function model(over: Partial<DesignModel> = {}): DesignModel {
  return {
    name: 'Platforms',
    diagrams: [],
    elements: [
      element('containers', { kind: 'platformService', name: 'Container platform', shared: true }),
      element('brokering', { kind: 'platformService', name: 'Message brokering', lifecycleDates: { retired: '2027-06-30' } }),
      element('platform-team', { kind: 'actor', name: 'Platform team' }),
      element('openshift', { kind: 'platform', name: 'OpenShift' }),
      element('wms', { name: 'WMS' }), element('portal', { name: 'Portal' }),
      element('wms-api', { kind: 'component', parentId: 'wms', name: 'WMS API' }),
    ],
    relations: [
      { id: 'a1', type: 'assigned', sourceId: 'platform-team', targetId: 'containers' },
      { id: 'r1', type: 'realises', sourceId: 'openshift', targetId: 'containers' },
      { id: 'u1', type: 'uses', sourceId: 'wms-api', targetId: 'containers' },
      { id: 'u2', type: 'uses', sourceId: 'wms', targetId: 'brokering' },
      { id: 'u3', type: 'uses', sourceId: 'portal', targetId: 'brokering', validUntil: '2027-03-31' },
    ] as Relation[],
    ...over,
  }
}

function open(over: Partial<ServiceReportPageProps> = {}) {
  const onOpenDocumentation = vi.fn()
  renderShell(<ServiceReportPage open model={model()} serviceId="containers" onClose={() => {}} onOpenDocumentation={onOpenDocumentation} {...over} />)
  return { onOpenDocumentation }
}

describe('a service report', () => {
  it('reads as the platform report does: the question, then the sentence', () => {
    open()
    expect(screen.getByTestId('service-name').textContent).toMatch(/^If .* were withdrawn$/)
    expect(screen.getByTestId('service-summary').textContent).toMatch(/would be stranded/)
  })
  it('gives a row per application with its container, its scope and whether it is stranded', () => {
    open()
    const table = screen.getByTestId('service-consumers').textContent
    expect(table).toContain('Stranded')
    expect(table).toContain('This scope')
  })
  it('says so for a service this scope lacks', () => {
    open({ serviceId: 'nope' })
    expect(screen.getByText('This scope does not hold that service.')).toBeDefined()
  })
  it('finds nothing wrong, as axe reads it', async () => {
    open()
    expect(await axeFindings()).toEqual([])
  })
})
