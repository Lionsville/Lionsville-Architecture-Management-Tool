// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A document the OS hands over: sent where a window listens, held and given a window where none does. */
import { describe, expect, it } from 'vitest'
import { openedDocuments } from './openedDocuments'

function app(state: { listening: boolean; ready: boolean; window: boolean }) {
  const sent: string[] = []
  let made = 0
  const documents = openedDocuments({
    listening: () => state.listening, ready: () => state.ready, windowOpen: () => state.window,
    makeWindow: () => { made += 1; state.window = true }, send: (path) => sent.push(path),
  })
  return { documents, sent, made: () => made }
}

describe('a document the OS hands over', () => {
  it('is sent at once where a window listens', () => {
    const { documents, sent, made } = app({ listening: true, ready: true, window: true })
    documents.arrived('/work/landscape.lvarch')
    expect(sent).toEqual(['/work/landscape.lvarch'])
    expect(made()).toBe(0)
  })

  it('gets a window where every one was closed, and waits until it listens', () => {
    const state = { listening: false, ready: true, window: false }
    const { documents, sent, made } = app(state)
    documents.arrived('/work/landscape.lvarch')
    expect(made()).toBe(1)
    expect(sent).toEqual([])
    state.listening = true
    documents.heard()
    expect(sent).toEqual(['/work/landscape.lvarch'])
  })

  it('makes no window before the app is ready, where the one the start makes will listen', () => {
    const { documents, made } = app({ listening: false, ready: false, window: false })
    documents.arrived('/work/landscape.lvarch')
    expect(made()).toBe(0)
  })

  it('makes one window for several, and sends them in the order they came', () => {
    const state = { listening: false, ready: true, window: false }
    const { documents, sent, made } = app(state)
    documents.arrived('/work/one.lvarch')
    documents.arrived('/work/two.lvarch')
    expect(made()).toBe(1)
    state.listening = true
    documents.heard()
    documents.heard()
    expect(sent).toEqual(['/work/one.lvarch', '/work/two.lvarch'])
  })
})
