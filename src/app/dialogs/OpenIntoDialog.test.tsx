// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../testing/axe'
import { translator } from '../../i18n'
import { renderShell } from '../testing/renderShell'
import { OpenIntoDialog } from './OpenIntoDialog'

afterEach(() => cleanup())

const s = translator('en')

describe('OpenIntoDialog, as axe reads it', () => {
  it('finds nothing', async () => {
    renderShell(<OpenIntoDialog
      open file="theirs.lvarch" here="Acme Logistics" canGoElsewhere
      onCancel={() => {}} onHere={() => {}} onElsewhere={() => {}} s={s}
    />)
    expect(await axeFindings()).toEqual([])
  })
})

describe('OpenIntoDialog', () => {
  it('names the file, warns what replacing writes over, and offers both ways', () => {
    const onHere = vi.fn()
    const onElsewhere = vi.fn()
    renderShell(<OpenIntoDialog
      open file="theirs.lvarch" here="Acme Logistics" canGoElsewhere
      onCancel={() => {}} onHere={onHere} onElsewhere={onElsewhere} s={s}
    />)
    expect(screen.getByRole('heading', { name: 'Where should “theirs.lvarch” go?' })).toBeDefined()
    expect(screen.getByText(/Writes over Acme Logistics\. No history is kept here yet/)).toBeDefined()
    fireEvent.click(screen.getByTestId('open-into-elsewhere'))
    expect(onElsewhere).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('open-into-choose-here'))
    fireEvent.click(screen.getByTestId('open-into-here'))
    expect(onHere).toHaveBeenCalled()
  })

  it('says a snapshot is taken where a history is kept, and names what is in the file', () => {
    renderShell(<OpenIntoDialog
      open file="x.lvarch" here="Acme" canGoElsewhere={false} keepsHistory holdsName="Northline" holds="5 scopes, 9 views"
      onCancel={() => {}} onHere={() => {}} onElsewhere={() => {}} s={s}
    />)
    expect(screen.getByText(/A snapshot is taken first/)).toBeDefined()
    expect(screen.getByText('In the file: Northline')).toBeDefined()
    expect(screen.getByTestId('open-into-here').textContent).toBe('Replace “Acme” here')
  })

  it('offers only "here" where no folder can be chosen, and still warns', () => {
    renderShell(<OpenIntoDialog
      open file="x.lvarch" here="Acme" canGoElsewhere={false}
      onCancel={() => {}} onHere={() => {}} onElsewhere={() => {}} s={s}
    />)
    expect(screen.queryByTestId('open-into-elsewhere')).toBeNull()
    expect(screen.getByText('Acme will be gone.')).toBeDefined()
    expect(screen.getByTestId('open-into-here').textContent).toBe('Replace and lose what is here')
  })
})
