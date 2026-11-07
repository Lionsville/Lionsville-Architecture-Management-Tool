// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Button, IconButton } from './Button'
import { Tooltip } from './Tooltip'

afterEach(cleanup)

/** The rules a pressed button is drawn by, off its own stylesheet: jsdom paints nothing. */
const STYLES = readFileSync(join(process.cwd(), 'src/widgets/kit/Button.css'), 'utf8')

describe('a pressed Button', () => {
  it('sets its ground and its ink together, after every variant, in each of its states', () => {
    const pressed = STYLES.indexOf("[aria-pressed='true']")
    for (const variant of ['primary', 'quiet', 'danger']) expect(STYLES.lastIndexOf(`[data-variant='${variant}']`)).toBeLessThan(pressed)
    const rule = /\.kit-button\[aria-pressed='true'\],\s*\.kit-button\[aria-pressed='true'\]:hover,\s*\.kit-button\[aria-pressed='true'\]:active \{([^}]*)\}/.exec(STYLES)
    expect(rule?.[1]).toContain('background: var(--selected-soft)')
    expect(rule?.[1]).toContain('color: var(--ink)')
  })

  it('still reads as refused where it is refused: that rule comes after', () => {
    expect(STYLES.indexOf('.kit-button[data-refused]')).toBeGreaterThan(STYLES.lastIndexOf("[aria-pressed='true']"))
  })
})

describe('Button', () => {
  it('draws the four variants, each a button named by its word', async () => {
    renderShell(<>
      <Button variant="primary">Accept</Button>
      <Button>Send back</Button>
      <Button variant="quiet">Later</Button>
      <Button variant="danger">Remove</Button>
    </>)
    expect(screen.getByRole('button', { name: 'Accept' }).dataset.variant).toBe('primary')
    expect(screen.getByRole('button', { name: 'Send back' }).dataset.variant).toBe('plain')
    expect(screen.getByRole('button', { name: 'Remove' }).dataset.variant).toBe('danger')
    expect(await axeFindings()).toEqual([])
  })

  it('never submits a form by accident, and carries a guide name', () => {
    renderShell(<Button data-guide="accept">Accept</Button>)
    const button = screen.getByRole('button', { name: 'Accept' })
    expect(button.getAttribute('type')).toBe('button')
    expect(button.dataset.guide).toBe('accept')
  })

  it('keeps a refused button in the tab order, says why, and does nothing when pressed', async () => {
    const pressed = vi.fn()
    renderShell(<Button reason="2 things hold it" reasonAt="beside" onClick={pressed}>Accept</Button>)
    const button = screen.getByRole('button', { name: 'Accept' })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(button).toHaveProperty('tabIndex', 0)
    expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe('2 things hold it')
    fireEvent.click(button)
    expect(pressed).not.toHaveBeenCalled()
    expect(await axeFindings()).toEqual([])
  })

  it('says a refusal in the tooltip by default, keeping the button its own name', async () => {
    renderShell(<Button reason="2 things hold it">Accept</Button>)
    const button = screen.getByRole('button', { name: 'Accept' })
    fireEvent.mouseOver(button)
    expect((await screen.findByRole('tooltip')).textContent).toBe('2 things hold it')
    expect(screen.getByRole('button', { name: 'Accept' })).toBe(button)
  })

  it('takes no second press while working, and will not submit', () => {
    const pressed = vi.fn()
    renderShell(<Button working type="submit" onClick={pressed}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.getAttribute('type')).toBe('button')
    fireEvent.click(button)
    expect(pressed).not.toHaveBeenCalled()
  })

  it('presses by click, and is disabled natively when asked with no reason', () => {
    const pressed = vi.fn()
    renderShell(<>
      <Button onClick={pressed}>Go</Button>
      <Button disabled>Create</Button>
    </>)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(pressed).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Create' }).hasAttribute('disabled')).toBe(true)
  })
})

describe('IconButton', () => {
  it('is named by its label, with the label as its tooltip', async () => {
    renderShell(<IconButton label="Close" pressed={false}><span aria-hidden>x</span></IconButton>)
    const button = screen.getByRole('button', { name: 'Close' })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    fireEvent.mouseOver(button)
    expect((await screen.findByRole('tooltip')).textContent).toBe('Close')
    expect(await axeFindings()).toEqual([])
  })

  it('says its tip in one tooltip where it has more to say, and keeps its label as its name', async () => {
    renderShell(<IconButton label="Undo" tip="Undo (⌘Z)"><span aria-hidden>x</span></IconButton>)
    const button = screen.getByRole('button', { name: 'Undo' })
    fireEvent.mouseOver(button)
    const tips = await screen.findAllByRole('tooltip')
    expect(tips.map((tip) => tip.textContent)).toEqual(['Undo (⌘Z)'])
  })

  it('stays quiet when it is off, rather than drawn as if pressed', () => {
    expect(STYLES).toMatch(/\.kit-button\[data-variant='quiet'\]:disabled \{ background: transparent; border-color: transparent; \}/)
  })

  it('says why it is refused beside its name, and does nothing', async () => {
    const pressed = vi.fn()
    renderShell(<IconButton label="Delete" reason="Three views draw it" onClick={pressed}><span aria-hidden>x</span></IconButton>)
    const button = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(button)
    expect(pressed).not.toHaveBeenCalled()
    fireEvent.mouseOver(button)
    expect((await screen.findByRole('tooltip')).textContent).toBe('Delete: Three views draw it')
  })
})

describe('Tooltip', () => {
  it('describes a control and leaves its name alone, and draws nothing for nothing', async () => {
    renderShell(<>
      <Tooltip title="Saves a copy"><button type="button">Save</button></Tooltip>
      <Tooltip title=""><button type="button">Plain</button></Tooltip>
      <Tooltip title={undefined}><button type="button">Bare</button></Tooltip>
    </>)
    const save = screen.getByRole('button', { name: 'Save' })
    fireEvent.mouseOver(save)
    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).toBe('Saves a copy')
    expect(save.getAttribute('aria-describedby')).toBe(tip.id)
    expect(screen.getByRole('button', { name: 'Plain' }).hasAttribute('aria-label')).toBe(false)
    expect(screen.getByRole('button', { name: 'Bare' }).hasAttribute('title')).toBe(false)
  })
})
