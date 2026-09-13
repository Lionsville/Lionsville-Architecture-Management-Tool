// @vitest-environment jsdom
/**
 * One gesture for every seam: the size follows the pointer off where the
 * gesture started, stays inside its limits, answers the keyboard, and a
 * double-click puts it back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { SeamResizer } from './SeamResizer'
import type { SeamResizerProps } from './SeamResizer'

afterEach(() => cleanup())

// jsdom has no `PointerEvent`, so `fireEvent.pointerDown` would drop `button`
// and the client coordinates — the very things the seam reads. A MouseEvent
// under the pointer name carries them.
const pointer = (type: string, init: MouseEventInit) =>
  new MouseEvent(type, { button: 0, bubbles: true, cancelable: true, ...init })

function mount(over: Partial<SeamResizerProps> = {}) {
  const onChange = vi.fn()
  render(
    <ThemeProvider theme={createTheme()}>
      <SeamResizer
        orientation="vertical"
        region="after"
        value={340}
        min={260}
        max={720}
        defaultValue={340}
        onChange={onChange}
        label="Resize the fields"
        {...over}
      />
    </ThemeProvider>,
  )
  const seam = screen.getByRole('separator', { name: 'Resize the fields' }) as HTMLElement
  // jsdom has no pointer capture; the seam asks for it and reads it back.
  let captured = false
  seam.setPointerCapture = () => { captured = true }
  seam.hasPointerCapture = () => captured
  return { seam, onChange }
}

describe('SeamResizer', () => {
  it('grows a region after a vertical seam as the pointer moves left, off the start', () => {
    const { seam, onChange } = mount()
    fireEvent(seam, pointer('pointerdown', { clientX: 500 }))
    fireEvent(seam, pointer('pointermove', { clientX: 440 }))
    expect(onChange).toHaveBeenLastCalledWith(400)
    fireEvent(seam, pointer('pointermove', { clientX: 560 }))
    expect(onChange).toHaveBeenLastCalledWith(280)
  })

  it('grows a region before a horizontal seam as the pointer moves down', () => {
    const { seam, onChange } = mount({ orientation: 'horizontal', region: 'before', value: 320, min: 80, max: undefined })
    fireEvent(seam, pointer('pointerdown', { clientY: 100 }))
    fireEvent(seam, pointer('pointermove', { clientY: 150 }))
    expect(onChange).toHaveBeenLastCalledWith(370)
  })

  it('stays inside its limits, and ignores a pointer it never captured', () => {
    const { seam, onChange } = mount()
    fireEvent(seam, pointer('pointermove', { clientX: 0 }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent(seam, pointer('pointerdown', { clientX: 500 }))
    fireEvent(seam, pointer('pointermove', { clientX: -1000 }))
    expect(onChange).toHaveBeenLastCalledWith(720)
    fireEvent(seam, pointer('pointermove', { clientX: 1000 }))
    expect(onChange).toHaveBeenLastCalledWith(260)
  })

  it('answers the keyboard in the direction the region grows, and Home puts it back', () => {
    const { seam, onChange } = mount()
    fireEvent.keyDown(seam, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(348)
    fireEvent.keyDown(seam, { key: 'ArrowRight', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(308)
    fireEvent.keyDown(seam, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(340)
    fireEvent.doubleClick(seam)
    expect(onChange).toHaveBeenLastCalledWith(340)
  })
})
