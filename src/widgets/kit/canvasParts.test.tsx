// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeFindings } from '../../app/testing/axe'
import { Card } from './Card'
import { arrowAt, labelWords, Line, howWords, LineLabel } from './Line'
import { Zone } from './Zone'

afterEach(cleanup)

const css = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')

describe('a card', () => {
  it('leads with a mark where it is handed one', () => {
    const { container } = render(<Card name="X" lead={<i>logo</i>} />)
    expect(container.querySelector('.kit-card__lead')?.textContent).toBe('logo')
  })

  it('says its name, what it is and what it does', () => {
    const { container } = render(<Card name="Warehouse Management" sub="WMS · Application" about="Stock, slots and picking." />)
    expect(container.querySelector('.kit-card__name')?.textContent).toBe('Warehouse Management')
    expect(screen.getByText('WMS · Application')).toBeTruthy()
    expect(screen.getByText('Stock, slots and picking.')).toBeTruthy()
  })

  it('breaks its name between words only: each word a box of its own, the spaces between them', () => {
    const { container } = render(<Card name="Warehouse  lead" />)
    const words = [...container.querySelectorAll('.kit-name__word')].map((word) => word.textContent)
    expect(words).toEqual(['Warehouse', 'lead'])
    expect(container.querySelector('.kit-name')?.textContent).toBe('Warehouse  lead')
    const sheet = css('./Card.css')
    expect(sheet).not.toMatch(/\.kit-card__name \{[^}]*(overflow-wrap: anywhere|hyphens: auto)/)
    expect(sheet).toContain('.kit-name { overflow-wrap: normal; word-break: normal; hyphens: manual; }')
  })

  it('may part a word after a slash, the slash kept with the word before it', () => {
    const { container } = render(<Card name="Intake/Review desk /" />)
    const words = [...container.querySelectorAll('.kit-name__word')].map((word) => word.textContent)
    expect(words).toEqual(['Intake/', 'Review', 'desk', '/'])
    expect(container.querySelector('.kit-name')?.textContent).toBe('Intake/Review desk /')
  })

  it('says each state as an attribute, for its CSS to draw', () => {
    const { container } = render(<Card name="X" selected neighbour dimmed planned />)
    const card = container.firstElementChild as HTMLElement
    expect(card.dataset).toMatchObject({ selected: 'true', neighbour: 'true', dimmed: 'true', planned: 'true' })
  })

  it('is at rest with no states on it', () => {
    const { container } = render(<Card name="X" />)
    const card = container.firstElementChild as HTMLElement
    expect(card.dataset.selected).toBeUndefined()
    expect(card.dataset.rail).toBeUndefined()
  })

  it('draws a hand-set accent as a rail, and keeps the style it was given', () => {
    const { container } = render(<Card name="X" rail="#123456" style={{ width: 10 }} />)
    const card = container.firstElementChild as HTMLElement
    expect(card.dataset.rail).toBe('true')
    expect(card.style.getPropertyValue('--kit-card-rail')).toBe('#123456')
    expect(card.style.width).toBe('10px')
  })

  it('says a change by an agent until it is reviewed', () => {
    render(<Card name="X" agentChanged />)
    expect(screen.getByRole('img', { name: 'Changed by an agent, not yet reviewed' })).toBeTruthy()
  })

  it('passes on what a canvas hangs on it', () => {
    const onClick = vi.fn()
    render(<Card name="X" data-testid="card" className="mine" onClick={onClick} marks={<i>marks</i>} hoverWord="Has a diagram" nub={<b>nub</b>} />)
    const card = screen.getByTestId('card')
    expect(card.className).toBe('kit-card mine')
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getByText('marks')).toBeTruthy()
    expect(screen.getByText('Has a diagram')).toBeTruthy()
    expect(screen.getByText('nub')).toBeTruthy()
  })

  it('holds the name’s size on screen and lets the distance say what goes, in its CSS', () => {
    const sheet = css('./Card.css')
    expect(sheet).toContain('font-size: calc(var(--t-canvas-name) / var(--canvas-zoom, 1))')
    expect(sheet).toContain("[data-distance='far'] .kit-card__sub { display: none; }")
    expect(sheet).toContain("[data-distance='near'] .kit-card__about { display: block; }")
    expect(sheet).toContain('-webkit-line-clamp: 3')
    expect(sheet).toContain("[data-distance='far'] .kit-card__name { -webkit-line-clamp: 2; }")
    // Dimming changes the ink; opacity on a name would take it below what can be read.
    expect(sheet).not.toMatch(/data-dimmed[^}]*opacity/)
  })
})

describe('a card\'s small text', () => {
  it('is in the second ink, so it reads at its size on a painted pixel', () => {
    expect(css('./Card.css')).toMatch(/\.kit-card__word \{\s*color: var\(--ink-2\)/)
  })
})

describe('a zone', () => {
  it('names a region, and is named by it', () => {
    render(<Zone name="Warehouse" aside="4"><p>inside</p></Zone>)
    expect(screen.getByRole('region', { name: 'Warehouse' })).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('inside')).toBeTruthy()
  })

  it('draws a boundary as a kind of its own', () => {
    render(<Zone name="Warehouse Management" kind="boundary" aside="[Application]" />)
    expect(screen.getByRole('region').dataset.kind).toBe('boundary')
  })

  it('folds, says which way, and hides what it holds', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<Zone name="Billing" fold={{ folded: false, onToggle }}><p>inside</p></Zone>)
    fireEvent.click(screen.getByRole('button', { name: 'Fold Billing' }))
    expect(onToggle).toHaveBeenCalledOnce()
    rerender(<Zone name="Billing" fold={{ folded: true, onToggle }}><p>inside</p></Zone>)
    expect(screen.getByRole('button', { name: 'Unfold Billing' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('inside')).toBeNull()
  })

  it('holds its name’s size on screen', () => {
    expect(css('./Zone.css')).toContain('font-size: calc(var(--t-canvas-name) / var(--canvas-zoom, 1))')
  })

  it('is told from the ground by an edge held on screen and a name in the first ink', () => {
    const drawn = css('./Zone.css')
    expect(drawn).toContain('solid var(--zone-edge)')
    expect(drawn).toContain('border-width: round(up, calc(1px / var(--canvas-zoom, 1)), 1px)')
    expect(drawn).toContain('@media (max-resolution: 1.99dppx)')
    expect(drawn).toContain('.kit-zone__name { color: var(--ink)')
  })

  it('takes its name as something to press, still named by it', () => {
    render(<Zone name="Billing" nameAs={<button type="button">Billing</button>} />)
    expect(screen.getByRole('region', { name: 'Billing' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Billing' })).toBeTruthy()
  })
})

describe('a line', () => {
  it('keeps its width whatever the zoom, and its head too', () => {
    const { container } = render(<svg><Line d="M0 0 L10 0" arrow={arrowAt({ x: 0, y: 0 }, { x: 10, y: 0 })} /></svg>)
    for (const path of container.querySelectorAll('.kit-line__path, .kit-line__hit')) {
      expect(path.getAttribute('vector-effect')).toBe('non-scaling-stroke')
    }
    expect(css('./Line.css')).toContain('.kit-line__head { fill: var(--kit-line-ink); transform: scale(calc(1 / var(--canvas-zoom, 1))); }')
    expect(container.querySelector('.kit-line__head')).toBeTruthy()
  })

  it('says its meaning in the dash', () => {
    const dash = (pattern: 'solid' | 'functional' | 'implied' | 'planned') => {
      const { container, unmount } = render(<svg><Line d="M0 0" pattern={pattern} /></svg>)
      const said = container.querySelector('.kit-line__path')?.getAttribute('stroke-dasharray')
      unmount()
      return said
    }
    expect(dash('solid')).toBeNull()
    expect(dash('functional')).toBe('4 3')
    expect(dash('implied')).toBe('1 3')
    expect(dash('planned')).toBe('7 4')
  })

  it('has four inks and three states, and no head without a direction', () => {
    const { container } = render(<svg><Line d="M0 0" ink="exception" state="picked" /></svg>)
    const line = container.querySelector('.kit-line') as SVGGElement
    expect(line.dataset).toMatchObject({ ink: 'exception', state: 'picked' })
    expect(container.querySelector('.kit-line__head')).toBeNull()
  })

  it('points its head along the route', () => {
    expect(arrowAt({ x: 0, y: 0 }, { x: 0, y: 5 })).toEqual({ x: 0, y: 5, angle: 90 })
    expect(arrowAt({ x: 5, y: 0 }, { x: 0, y: 0 }).angle).toBe(180)
  })
})

describe('a label', () => {
  it('keeps to its budget, at a word, and the title holds the rest', () => {
    const long = 'Opens an exception when a stop runs late and hands the whole route back to the planner'
    const said = labelWords(long)
    expect(said.length).toBeLessThanOrEqual(56)
    expect(said.endsWith('…')).toBe(true)
    expect(long.startsWith(said.slice(0, -1))).toBe(true)
    expect(labelWords('scans')).toBe('scans')
    expect(labelWords('x'.repeat(80)).length).toBe(56)
    render(<LineLabel words={long} />)
    expect(screen.getByText(said).closest('.kit-linelabel')?.getAttribute('title')).toBe(long)
  })

  it('says how in a second line, and an exception in a word', () => {
    render(<LineLabel words="scans" how="HTTPS" exception="Exception" />)
    expect(screen.getByText('[HTTPS]')).toBeTruthy()
    expect(screen.getByText(/Exception/)).toBeTruthy()
  })

  it('keeps what was written about how, on one line, however long or unsure', () => {
    render(<LineLabel words="asks" how="???" />)
    expect(screen.getByText('[???]')).toBeTruthy()
    expect(howWords('a spreadsheet somebody emails around')).toBe('[a spreadsheet som…]')
  })

  it('carries a number for the Lines list, which a canvas with no room swaps its words for', () => {
    const { container } = render(<LineLabel words="scans" number={5} />)
    expect(screen.getByLabelText('Line 5').textContent).toBe('5')
    expect((container.firstElementChild as HTMLElement).dataset.numbered).toBe('true')
    expect(css('./Line.css')).toContain("[data-labels='numbers'] .kit-linelabel[data-numbered]:not([data-picked]) .kit-linelabel__number { display: inline; }")
  })
})

describe('to a screen reader', () => {
  it('has nothing for axe to find', async () => {
    render(
      <main>
        <Zone name="Billing" fold={{ folded: false, onToggle: () => {} }}>
          <Card name="Tariff Engine" sub="Application" agentChanged />
        </Zone>
        <LineLabel words="scans" how="[HTTPS]" />
      </main>,
    )
    expect(await axeFindings()).toEqual([])
  })
})
