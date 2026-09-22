// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The question that replaced a side effect. What matters here is that it IS a
 * question — two answers, neither of them a default — because the thing it
 * guards used to happen without one, into every folder somebody made.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../i18n'
import { AdoptFolder } from './AdoptFolder'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

describe('AdoptFolder', () => {
  it('names the folder the answer is about', () => {
    renderShell(<AdoptFolder
      s={translator('en')} folderName="test2" onCopy={() => {}} onSkip={() => {}} />)

    expect(screen.getByTestId('adopt-folder').textContent).toContain('“test2”')
  })

  it('says that neither answer deletes anything', () => {
    // The sentence is the reason somebody can answer at all: both buttons are
    // safe, and the app keeps its copy either way.
    renderShell(<AdoptFolder
      s={translator('en')} folderName="test2" onCopy={() => {}} onSkip={() => {}} />)

    expect(screen.getByTestId('adopt-folder').textContent).toContain('Nothing is deleted either way')
  })

  it('carries each answer back on its own', () => {
    const onCopy = vi.fn()
    const onSkip = vi.fn()
    renderShell(<AdoptFolder
      s={translator('en')} folderName="test2" onCopy={onCopy} onSkip={onSkip} />)

    fireEvent.click(screen.getByTestId('adopt-skip'))
    expect(onSkip).toHaveBeenCalledOnce()
    expect(onCopy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('adopt-copy'))
    expect(onCopy).toHaveBeenCalledOnce()
  })

  it('asks in the language the app is in', () => {
    renderShell(<AdoptFolder
      s={translator('nl')} folderName="test2" onCopy={() => {}} onSkip={() => {}} />)

    expect(screen.getByTestId('adopt-folder').textContent)
      .toContain('Je werk meenemen naar deze map?')
  })
})
