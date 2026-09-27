// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { DesignDiagram } from '../../model'
import { outlineBoards } from './boardOutline'

const landscape = (id: string, on: string[] = []): DesignDiagram =>
  ({ id, kind: 'layer7', name: id, members: on.map((member) => ({ id: member })), geometry: { nodes: [] } }) as DesignDiagram
const containers = (id: string, application?: string): DesignDiagram =>
  ({ id, kind: 'container', name: id, members: [], geometry: { nodes: [] }, applicationElementId: application }) as DesignDiagram
const sheet = (id: string): DesignDiagram => ({ id, kind: 'sheet', name: id, members: [], geometry: { nodes: [] } }) as DesignDiagram

const ids = (boards: readonly DesignDiagram[]) => boards.map((board) => board.id)

describe('outlineBoards', () => {
  it('puts a container diagram under the landscape its application is on, and nowhere else', () => {
    const { entries, loose } = outlineBoards([
      landscape('l7', ['ledger']),
      sheet('business'),
      containers('cd', 'ledger'),
    ])
    expect(entries.map((entry) => [entry.board.id, ids(entry.containers)])).toEqual([
      ['l7', ['cd']],
      ['business', []],
    ])
    expect(loose).toEqual([])
  })

  it('keeps the model’s order, of the boards and of the containers under one landscape', () => {
    const { entries } = outlineBoards([
      containers('cd-b', 'billing'),
      landscape('l7', ['ledger', 'billing']),
      containers('cd-a', 'ledger'),
      sheet('business'),
    ])
    expect(ids(entries.map((entry) => entry.board))).toEqual(['l7', 'business'])
    expect(ids(entries[0].containers)).toEqual(['cd-b', 'cd-a'])
  })

  it('lists a diagram once, under the first landscape its application is on', () => {
    const { entries } = outlineBoards([
      landscape('now', ['ledger']),
      landscape('next', ['ledger']),
      containers('cd', 'ledger'),
    ])
    expect(ids(entries[0].containers)).toEqual(['cd'])
    expect(entries[1].containers).toEqual([])
  })

  it('lists last a diagram whose application is on no landscape, or that names none', () => {
    const { entries, loose } = outlineBoards([
      containers('orphan', 'gone'),
      landscape('l7', ['ledger']),
      containers('nameless'),
      sheet('business'),
    ])
    expect(entries.every((entry) => entry.containers.length === 0)).toBe(true)
    expect(ids(loose)).toEqual(['orphan', 'nameless'])
  })

  /** A sheet lists no applications as members, and nothing is filed under a board that is not a landscape. */
  it('files nothing under a board that is not a landscape', () => {
    const map = { ...sheet('map'), kind: 'map', members: [{ id: 'ledger' }] } as DesignDiagram
    const { entries, loose } = outlineBoards([map, containers('cd', 'ledger')])
    expect(entries[0].containers).toEqual([])
    expect(ids(loose)).toEqual(['cd'])
  })
})
