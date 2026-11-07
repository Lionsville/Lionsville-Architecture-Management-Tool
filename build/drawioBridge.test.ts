// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the bridge does to an editor, over stand-ins for draw.io's names: a press
 * the frame's sandbox would end in an error goes to the page or goes away. That
 * the names are draw.io's own is the pin's to keep, and was walked against the
 * pinned editor when these were written.
 */
import { describe, expect, it } from 'vitest'
import { DRAWIO_BRIDGE } from './drawioBridge.ts'

type Action = { funct: () => void; visible: boolean }

function editor() {
  const said: unknown[] = []
  const actions: Record<string, Action> = {
    print: { funct: () => { throw new Error('a window the frame may not open') }, visible: true },
    copyAsImage: { funct: () => {}, visible: true },
    copyAsSvg: { funct: () => {}, visible: true },
    copy: { funct: () => {}, visible: true },
  }
  class EditorUi {
    actions = { get: (name: string) => actions[name] }
    editor = undefined
    init() { return undefined }
  }
  Object.assign(EditorUi.prototype, { ctrlAltActions: { 88: 'copyAsImage', 84: 'runLastLayout' }, ctrlAltShiftActions: { 88: 'copyAsSvg', 70: 'bringForward' } })
  const window = { parent: { postMessage: (message: string) => { said.push(JSON.parse(message)) } }, addEventListener: () => {}, setTimeout: () => {} }
  new Function('EditorUi', 'mxVertexHandler', 'window', DRAWIO_BRIDGE)(EditorUi, class {}, window)
  const ui = new EditorUi()
  ui.init()
  return { actions, said, prototype: EditorUi.prototype as unknown as { ctrlAltActions: Record<number, string>; ctrlAltShiftActions: Record<number, string> } }
}

describe('the bridge', () => {
  it('asks the page to print, rather than opening a window the frame may not open', () => {
    const { actions, said } = editor()
    actions.print.funct()
    expect(said).toEqual([{ event: 'lvPrint' }])
  })

  it('takes copying as a picture off the keys and the menus, and leaves the rest', () => {
    const { actions, prototype } = editor()
    expect(prototype.ctrlAltActions).toEqual({ 84: 'runLastLayout' })
    expect(prototype.ctrlAltShiftActions).toEqual({ 70: 'bringForward' })
    expect(actions.copyAsImage.visible).toBe(false)
    expect(actions.copyAsSvg.visible).toBe(false)
    expect(actions.copy.visible).toBe(true)
  })
})
