// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A link made from one end and kept at the other (ADR-0036, amended 11
 * October 2026): the scope that keeps it takes the change as its own step,
 * through the source's repositories, under its own rights.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import type { DesignElement } from '../../model'
import { placeWhole, readScope } from '../../projects/scopeAccess'
import { emptyContent } from '../../projects/scopeState'
import { refusalKey, useWriteIn, writeIn } from './writeIn'

afterEach(() => cleanup())

const fulfilment: DesignElement = {
  id: 'fulfilment', kind: 'actor', name: 'Fulfilment', unitTypeId: 'ut-cluster', lifecycle: 'live', isManaged: false, aspects: {},
}

async function warehouse() {
  const repositories = memoryRepositories()
  const empty = emptyContent('Warehouse')
  await placeWhole(repositories.scopes, '', emptyContent('Acme'))
  await placeWhole(repositories.scopes, 'warehouse', { ...empty, model: { ...empty.model, elements: [fulfilment] } })
  return repositories.scopes
}

const serveShipping = () => [{ type: 'element.update' as const, id: 'fulfilment', patch: { scopes: ['warehouse', 'shipping'] } }]

describe('a change written in the scope that keeps it', () => {
  it('lands as that scope\'s step, and the scope reads it', async () => {
    const scopes = await warehouse()
    expect(await writeIn({ scopes, writable: () => true }, 'warehouse', serveShipping)).toEqual({ ok: true })
    const held = await readScope(scopes, 'warehouse')
    expect(held?.model.elements.find((one) => one.id === 'fulfilment')?.scopes).toEqual(['warehouse', 'shipping'])
  })

  it('is refused where the person may only read that scope, and nothing is written', async () => {
    const scopes = await warehouse()
    const written = await writeIn({ scopes, writable: (path) => path !== 'warehouse' }, 'warehouse', serveShipping)
    expect(written).toEqual({ ok: false, reason: 'shell.scopeReadOnly' })
    expect(refusalKey(written)).toBe('shell.scopeReadOnly')
    expect((await readScope(scopes, 'warehouse'))?.model.elements[0].scopes).toBeUndefined()
  })

  it('says nothing changed where there was nothing to change, and that a scope is gone', async () => {
    const scopes = await warehouse()
    const unchanged = await writeIn({ scopes, writable: () => true }, 'warehouse', () => undefined)
    expect(unchanged).toEqual({ ok: false, reason: 'unchanged' })
    expect(refusalKey(unchanged)).toBeUndefined()
    const gone = await writeIn({ scopes, writable: () => true }, 'nowhere', serveShipping)
    expect(gone).toEqual({ ok: false, reason: 'gone' })
    expect(refusalKey(gone)).toBe('shell.scopeGone')
    expect(refusalKey({ ok: false, reason: 'readOnly' })).toBe('shell.scopeReadOnly')
    expect(refusalKey({ ok: false, reason: 'command.gone' })).toBe('command.gone')
    expect(refusalKey({ ok: false, reason: 'something else' })).toBe('pick.notWritten')
    expect(refusalKey({ ok: true })).toBeUndefined()
  })

  it('as a hook, asks the session first and reads the tree again once it lands', async () => {
    const scopes = await warehouse()
    const onTreeChanged = vi.fn()
    const { result, rerender } = renderHook(({ may }: { may: boolean }) => useWriteIn({
      scopes, writable: () => true, mayChange: () => may, onTreeChanged,
    }), { initialProps: { may: false } })
    expect(await result.current('warehouse', serveShipping)).toEqual({ ok: false, reason: 'readOnly' })
    expect(onTreeChanged).not.toHaveBeenCalled()
    rerender({ may: true })
    expect(await result.current('warehouse', serveShipping)).toEqual({ ok: true })
    expect(onTreeChanged).toHaveBeenCalledTimes(1)
  })
})
