// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeFindings } from '../../app/testing/axe'
import { CanvasDock } from './CanvasDock'
import { ColourMenu } from './ColourMenu'
import { DayControl } from './DayControl'
import { keyValues, KeyStrip, OTHER_VALUE } from './KeyStrip'
import { ViewBar, ViewBarAct, ViewBarButton, ViewBarCheck, ViewBarHeading, ViewBarMenu, ViewBarPanel } from './ViewBar'

afterEach(cleanup)

const QUESTIONS = [{ id: 'life', label: 'lifecycle' }, { id: 'domain', label: 'domain' }]

describe('the view bar', () => {
  it('keeps one order whatever order it was handed, and draws what a kind has', () => {
    render(
      <ViewBar
        more={<ViewBarButton>More</ViewBarButton>}
        day={<ViewBarButton>Day</ViewBarButton>}
        reading={<ViewBarButton>Names</ViewBarButton>}
        find={<ViewBarButton>Find</ViewBarButton>}
        show={<ViewBarButton>Show</ViewBarButton>}
        add={<ViewBarButton>Add</ViewBarButton>}
        arrange={<ViewBarButton>Arrange</ViewBarButton>}
        colour={<ViewBarButton>Colour</ViewBarButton>}
        exportAs={<ViewBarButton>Export</ViewBarButton>}
      />,
    )
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(
      ['Names', 'Add', 'Arrange', 'Show', 'Colour', 'Day', 'Find', 'Export', 'More'],
    )
  })

  it('leaves out what is not there, for a reader or a kind without it', () => {
    render(<ViewBar show={<ViewBarButton>Show</ViewBarButton>} find={<ViewBarButton>Find</ViewBarButton>} />)
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Show', 'Find'])
  })

  it('opens a menu from a word, with its main control named for the guide', () => {
    const onSelect = vi.fn()
    render(<ViewBar show={<ViewBarMenu label="Show" items={[{ label: 'Grid', onSelect }]} data-guide="view.show" />} />)
    const word = screen.getByRole('button', { name: 'Show' })
    expect(word.getAttribute('data-guide')).toBe('view.show')
    fireEvent.click(word)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Grid' }))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('marks a word that is on', () => {
    const { container } = render(<ViewBarMenu label="Colour: lifecycle" on items={[]} />)
    expect(container.querySelector('[data-on]')).toBeTruthy()
  })
})

describe('the Colour menu', () => {
  it('says nothing but its name on None, and is not in the accent', () => {
    const { container } = render(<ColourMenu questions={QUESTIONS} value={undefined} onChange={() => {}} />)
    expect(screen.getByRole('button').textContent).toBe('Colour')
    expect(container.querySelector('[data-on]')).toBeNull()
  })

  it('says the question up in its label, in the accent', () => {
    const { container } = render(<ColourMenu questions={QUESTIONS} value="life" onChange={() => {}} />)
    expect(screen.getByRole('button').textContent).toBe('Colour: lifecycle')
    expect(container.querySelector('[data-on]')).toBeTruthy()
  })

  it('offers None first and then the questions, and goes back to None', () => {
    const onChange = vi.fn()
    render(<ColourMenu questions={QUESTIONS} value="life" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    const items = screen.getAllByRole('menuitemcheckbox')
    expect(items.map((item) => item.textContent?.trim())).toEqual(['None', 'lifecycle', 'domain'])
    expect(items[1].getAttribute('aria-checked')).toBe('true')
    fireEvent.click(items[2])
    expect(onChange).toHaveBeenLastCalledWith('domain')
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'None' }))
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})

describe('the key strip', () => {
  const eight = Array.from({ length: 8 }, (_, index) => ({ id: `v${index}`, label: `Value ${index}`, count: 8 - index, swatch: 'lens-1' as const }))

  it('gathers past six into Other, largest kept, with the count of what it gathered', () => {
    const shown = keyValues(eight, 'Other')
    expect(shown).toHaveLength(6)
    expect(shown.slice(0, 5).map((value) => value.id)).toEqual(['v0', 'v1', 'v2', 'v3', 'v4'])
    expect(shown[5]).toEqual({ id: OTHER_VALUE, label: 'Other', count: 3 + 2 + 1 })
    expect(keyValues(eight.slice(0, 6), 'Other')).toHaveLength(6)
  })

  it('presses a value, and lets go when it is pressed again', () => {
    const onPress = vi.fn()
    const { rerender } = render(<KeyStrip values={eight.slice(0, 2)} onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: /Value 0/ }))
    expect(onPress).toHaveBeenLastCalledWith('v0')
    rerender(<KeyStrip values={eight.slice(0, 2)} pressed="v0" onPress={onPress} />)
    const pressed = screen.getByRole('button', { name: /Value 0/ })
    expect(pressed.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(pressed)
    expect(onPress).toHaveBeenLastCalledWith(undefined)
  })

  it('offers to keep it only to whoever may, and is plain words without a press', () => {
    const onKeep = vi.fn()
    const { rerender } = render(<KeyStrip values={eight.slice(0, 1)} onKeep={onKeep} />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep with the view' }))
    expect(onKeep).toHaveBeenCalledOnce()
    rerender(<KeyStrip values={eight.slice(0, 1)} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Value 0')).toBeTruthy()
  })

  it('folds into a Key button on a canvas, which opens it in place and folds it again', () => {
    const { container } = render(<KeyStrip foldable values={eight.slice(0, 1)} />)
    const fold = screen.getByRole('button', { name: 'Key' })
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(fold)
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.kit-key')?.hasAttribute('data-unfolded')).toBe(true)
    fireEvent.click(fold)
    expect(container.querySelector('.kit-key')?.hasAttribute('data-unfolded')).toBe(false)
  })
})

describe('the Day control', () => {
  const groups = [{ heading: 'From plan TR-0001', days: [{ day: '2027-03-01', label: 'New prices live' }] }]

  it('says nothing on today', () => {
    const { container } = render(<DayControl day={undefined} onChange={() => {}} />)
    expect(screen.getByRole('button').textContent).toBe('Day')
    expect(container.querySelector('[data-on]')).toBeNull()
  })

  it('says a look in its label, in the accent', () => {
    const { container } = render(<DayControl day="2027-09-01" onChange={() => {}} />)
    expect(screen.getByRole('button').textContent).toBe('Day: 1 Sept 2027')
    expect(container.querySelector('[data-on]')).toBeTruthy()
  })

  it('offers today, the days worth looking at by where they come from, and a chosen day', () => {
    const onChange = vi.fn()
    render(<DayControl day="2027-09-01" groups={groups} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('From plan TR-0001')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'New prices live · 1 Mar 2027' }))
    expect(onChange).toHaveBeenLastCalledWith('2027-03-01')
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Today' }))
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('asks for a day, and shows it only when there is one', () => {
    const onChange = vi.fn()
    render(<DayControl day={undefined} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Choose a day…' }))
    const show = screen.getByRole('button', { name: 'Show this day' }) as HTMLButtonElement
    expect(show.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('The day to look at'), { target: { value: '2028-02-29' } })
    fireEvent.click(show)
    expect(onChange).toHaveBeenLastCalledWith('2028-02-29')
  })

  it('says a day outside the data', () => {
    render(<DayControl day="2040-01-01" outsideData onChange={() => {}} />)
    expect(screen.getByRole('note').textContent).toBe('Nothing here has a date on this day')
  })
})

describe('the canvas dock', () => {
  const dock = (over = {}) => {
    const hands = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onFit: vi.fn(), onHome: vi.fn() }
    render(<CanvasDock zoom={0.72} {...hands} {...over} />)
    return hands
  }

  it('says the zoom, and every press does what it says', () => {
    const hands = dock()
    expect(screen.getByTestId('zoom-value').textContent).toBe('72%')
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(hands.onZoomIn).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(hands.onZoomOut).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }))
    expect(hands.onFit).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '100%' }))
    expect(hands.onHome).toHaveBeenCalledOnce()
  })

  it('draws Grid and Map where a canvas has them, on by a press state', () => {
    const onToggle = vi.fn()
    dock({ grid: { on: true, onToggle }, map: { on: false, onToggle: () => {} } })
    expect(screen.getByRole('button', { name: 'Grid' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Minimap' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('leaves them out where it has not', () => {
    dock()
    expect(screen.queryByRole('button', { name: 'Grid' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Minimap' })).toBeNull()
  })

  it('says the limits without dropping the focus', () => {
    dock({ zoom: 0.6 })
    const out = screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement
    expect(out.disabled).toBe(false)
    expect(out.dataset.limit).toBeDefined()
    expect(screen.getByRole('button', { name: 'Zoom in' }).dataset.limit).toBeUndefined()
  })
})

describe('a panel on the bar', () => {
  it('opens from its word, an act can close it, and a setting leaves it up', () => {
    const act = vi.fn()
    const checked = vi.fn()
    render(
      <ViewBarPanel label="Arrange">
        {(close) => (
          <>
            <ViewBarHeading>Spacing</ViewBarHeading>
            <ViewBarCheck label="Pins" checked={false} onChange={checked} />
            <ViewBarAct label="Tidy" says="Moves cards" onClick={() => { close(); act() }} />
          </>
        )}
      </ViewBarPanel>,
    )
    expect(screen.queryByRole('dialog', { name: 'Arrange' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Arrange' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pins' }))
    expect(checked).toHaveBeenCalledWith(true)
    expect(screen.getByRole('dialog', { name: 'Arrange' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /^Tidy/ }))
    expect(act).toHaveBeenCalledTimes(1)
  })

  it('is the Cancel while a pass runs, and says so where there is nothing to cancel', () => {
    const cancel = vi.fn()
    const { rerender } = render(<ViewBarPanel label="Arrange" busy={{ label: 'Cancel', onPress: cancel }}>{() => null}</ViewBarPanel>)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(cancel).toHaveBeenCalledTimes(1)
    rerender(<ViewBarPanel label="Arrange" busy={{ label: 'Working' }}>{() => null}</ViewBarPanel>)
    expect((screen.getByRole('button', { name: 'Working' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('what a canvas added to the parts', () => {
  it('lists questions under their headings, with a long list one level down', () => {
    const onChange = vi.fn()
    render(
      <ColourMenu
        questions={[{ id: 'a', label: 'Alpha', group: 'Letters' }]}
        more={{ label: 'One thing', questions: [{ id: 'one', label: 'Cluster' }] }}
        value={undefined}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Colour/ }))
    expect(screen.getByText('Letters')).toBeDefined()
    fireEvent.click(screen.getByRole('menuitem', { name: 'One thing' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Cluster' }))
    expect(onChange).toHaveBeenCalledWith('one')
  })

  it('says a question up that is not among those listed', () => {
    render(<ColourMenu questions={[]} value="x" upLabel="Cluster" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Cluster/ })).toBeDefined()
  })

  it('titles a key, draws what it was handed for a swatch, leaves out a count it has none of, and can take it down', () => {
    const press = vi.fn()
    render(<KeyStrip title="Coloured by phase" values={[{ id: 'a', label: 'Live', shown: <i>1</i> }]} onClose={{ label: 'Off', press }} />)
    expect(screen.getByRole('group', { name: 'Coloured by phase' })).toBeDefined()
    expect(screen.getByText('Live').parentElement?.textContent).toBe('1Live')
    fireEvent.click(screen.getByRole('button', { name: 'Off' }))
    expect(press).toHaveBeenCalledTimes(1)
  })

  it('opens what goes with the grid, and says what the canvas has to say', () => {
    const snap = vi.fn()
    render(
      <CanvasDock
        zoom={1} onZoomIn={vi.fn()} onZoomOut={vi.fn()} onFit={vi.fn()} onHome={vi.fn()}
        gridItems={[{ label: 'Snap', checked: false, onSelect: snap }]}
        note="The router declined"
      />,
    )
    expect(screen.getByRole('note').textContent).toBe('The router declined')
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Snap' }))
    expect(snap).toHaveBeenCalledTimes(1)
  })
})

describe('to a screen reader', () => {
  it('has nothing for axe to find', async () => {
    render(
      <main>
        <ViewBar
          colour={<ColourMenu questions={QUESTIONS} value="life" onChange={() => {}} />}
          day={<DayControl day="2027-01-01" onChange={() => {}} />}
        />
        <KeyStrip values={[{ id: 'a', label: 'Monitoring', count: 8, swatch: 'lens-1' }]} onPress={() => {}} onKeep={() => {}} />
        <CanvasDock zoom={1} onZoomIn={() => {}} onZoomOut={() => {}} onFit={() => {}} onHome={() => {}} grid={{ on: false, onToggle: () => {} }} />
      </main>,
    )
    expect(await axeFindings()).toEqual([])
  })
})
