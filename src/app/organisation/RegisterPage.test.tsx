// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { translator } from '../../i18n'
import { axeFindings } from '../testing/axe'
import { renderShell } from '../testing/renderShell'
import type { TechnologyRow } from '../../projects/technologyRegister'
import type { RegisterRow } from './register'
import { RegisterPage } from './RegisterPage'
import type { RegisterPageProps } from './RegisterPage'

const s = translator('en')

afterEach(() => cleanup())

const app = (id: string, over: Partial<RegisterRow> = {}): RegisterRow => ({ id, name: id, master: 'retail', owner: { kind: 'none' }, drawnIn: [], findings: [], ...over })
const tech = (id: string, kind: TechnologyRow['kind'], over: Partial<TechnologyRow> = {}): TechnologyRow => ({
  id, kind, name: id, master: 'platform', declarations: [], drawnIn: [], findings: [], maintainers: [], consumers: { applications: 0, scopes: 0 }, realisedBy: [], realises: [], hosts: 0, ...over,
})

function page(over: Partial<RegisterPageProps> = {}) {
  const props: RegisterPageProps = {
    open: true, onClose: vi.fn(), rows: [app('Billing', { category: 'Money' }), app('Customs', { outside: true, party: 'Authority' })],
    technology: [tech('Messaging', 'platformService', { maintainers: [{ id: 't', name: 'Platform team' }] }), tech('OpenShift', 'platform', { platformArchetype: 'place', hosts: 3, realises: [{ id: 'c', name: 'Containers' }] })],
    instances: [{ key: 'check.applicationUnowned', about: 'Billing', scope: 'retail', text: 'Billing has no unit: nobody owns it.', finding: {} as never, id: 'one', attributes: {} }],
    scopes: 3, index: undefined, today: '2026-11-07', language: 'en', scopeName: (path) => path, onOpen: vi.fn(), onOpenPage: vi.fn(), onReport: vi.fn(), onSeeInChecks: vi.fn(), s, ...over,
  }
  renderShell(<RegisterPage {...props} />)
  return props
}

describe('the register', () => {
  it('is one page with three tabs, says what it covers, and has no button on a row', async () => {
    page()
    expect(screen.getByTestId('register-findings').textContent).toContain('2 applications, all kept in 1 of 3 scopes.')
    expect(screen.getByRole('tab', { name: /Applications/ }).getAttribute('aria-selected')).toBe('true')
    const billing = screen.getByRole('row', { name: /Billing/ })
    expect(billing.textContent).toContain('Money')
    expect(billing.textContent).toContain('Nobody')
    expect(within(billing).queryByRole('button')).toBeNull()
    expect(screen.getByRole('row', { name: /Customs/ }).textContent).toContain('Authority (outside)')
    expect(await axeFindings()).toEqual([])
  })

  it('opens the preview on a press, which says what opening does in words, and its findings', () => {
    const props = page()
    fireEvent.click(screen.getByRole('row', { name: /Billing/ }))
    const preview = screen.getByRole('dialog')
    expect(within(preview).getByText('Billing has no unit: nobody owns it.')).toBeTruthy()
    fireEvent.click(within(preview).getByRole('button', { name: 'Open on its board' }))
    expect(props.onOpen).toHaveBeenCalledWith('retail', 'Billing')
    fireEvent.click(within(preview).getByRole('button', { name: 'Record page' }))
    expect(props.onOpenPage).toHaveBeenCalledWith('retail', 'Billing')
    fireEvent.click(within(preview).getByRole('button', { name: 'See in Checks' }))
    expect(props.onSeeInChecks).toHaveBeenCalledOnce()
  })

  it('gives services and platforms their own columns, each of one meaning, and their report in the preview', () => {
    const props = page()
    fireEvent.click(screen.getByRole('tab', { name: /Services/ }))
    expect(screen.getByRole('columnheader', { name: 'Maintained by' })).toBeTruthy()
    expect(screen.getByRole('row', { name: /Messaging/ }).textContent).toContain('Platform team')
    fireEvent.click(screen.getByRole('row', { name: /Messaging/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Service report' }))
    expect(props.onReport).toHaveBeenCalledWith('service', 'platform', 'Messaging')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('tab', { name: /Platforms/ }))
    expect(screen.getByRole('columnheader', { name: 'What it is' })).toBeTruthy()
    expect(screen.getByRole('row', { name: /OpenShift/ }).textContent).toContain('Containers')
  })

  it('counts who uses a service in words that agree with the number', () => {
    page({ technology: [tech('Messaging', 'platformService', { consumers: { applications: 1, scopes: 1 } })], request: { tab: 'services', select: 'Messaging', nonce: 1 } })
    expect(within(screen.getByRole('dialog')).getByText('1 application · 1 scope')).toBeTruthy()
  })

  it('lands on a tab and a record a way in asked for', () => {
    page({ request: { tab: 'services', select: 'Messaging', nonce: 1 } })
    expect(screen.getByRole('tab', { name: /Services/, hidden: true }).getAttribute('aria-selected')).toBe('true')
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Messaging' })).toBeTruthy()
  })

  it('says what is true and offers a first step where nothing is there, with no toolbar over it', () => {
    const onHome = vi.fn()
    page({ rows: [], technology: [], instances: [], onHome })
    expect(screen.getByText('No applications yet')).toBeTruthy()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByRole('searchbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Go to the organisation tree' }))
    expect(onHome).toHaveBeenCalledOnce()
  })

  it('says a find that matched nothing, with a way to clear it', () => {
    page()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.getByText(/Nothing matches/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(screen.getByRole('row', { name: /Billing/ })).toBeTruthy()
  })
})
