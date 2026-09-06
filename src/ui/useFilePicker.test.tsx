// @vitest-environment jsdom
/**
 * The hidden file field, and the one line that is the reason it is a hook.
 *
 * Clearing `value` after a choice was forgotten once, and then a file you had
 * just opened could not be opened again — which reads as "the button does
 * nothing", and is impossible to guess from the outside.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { useFilePicker } from './useFilePicker'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

function mount(onPick = vi.fn()) {
  function Host() {
    const picker = useFilePicker({ accept: '.lvarch', onPick, testId: 'field' })
    return <><button onClick={picker.open}>Open…</button>{picker.input}</>
  }
  renderShell(<Host />)
  return { onPick, field: () => screen.getByTestId('field') as HTMLInputElement }
}

const choose = (field: HTMLInputElement, name: string) => {
  Object.defineProperty(field, 'files', { value: [new File(['x'], name)], configurable: true })
  fireEvent.change(field)
}

describe('useFilePicker', () => {
  it('gives a field nobody can see, accepting what it was told to', () => {
    const { field } = mount()
    expect(field().hidden).toBe(true)
    expect(field().accept).toBe('.lvarch')
  })

  it('opens the dialog from somewhere else entirely', () => {
    const { field } = mount()
    const click = vi.spyOn(field(), 'click')
    fireEvent.click(screen.getByText('Open…'))
    expect(click).toHaveBeenCalledOnce()
  })

  it('hands the chosen file on', () => {
    const { onPick, field } = mount()
    choose(field(), 'landscape.lvarch')
    expect(onPick).toHaveBeenCalledOnce()
    expect((onPick.mock.calls[0][0] as File).name).toBe('landscape.lvarch')
  })

  it('clears itself, so the same file can be chosen twice', () => {
    const { onPick, field } = mount()
    choose(field(), 'landscape.lvarch')
    expect(field().value).toBe('')
    choose(field(), 'landscape.lvarch')
    expect(onPick).toHaveBeenCalledTimes(2)
  })

  it('does nothing when the dialog was cancelled', () => {
    const { onPick, field } = mount()
    fireEvent.change(field())
    expect(onPick).not.toHaveBeenCalled()
  })
})
