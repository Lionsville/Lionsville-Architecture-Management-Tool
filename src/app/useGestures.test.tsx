// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The four gestures, applied (ADR-0012 §10).
 *
 * Driven over a real session and a real store, because the three properties
 * worth pinning are all about the seam between them: the ORDER of the writes,
 * what a failure halfway leaves behind, and what ⌘Z does afterwards. The
 * arithmetic — which gesture is possible and what it would write — is pinned
 * in node against `projects/gestures.ts`, and none of it is repeated here.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { translator } from '../i18n'
import type { DesignElement } from '../model'
import { laidOut } from '../model/testFixtures'
import { indexScopes } from '../projects/scopeIndex'
import type { ScopeSnapshot } from '../projects/scope'
import { useGestures } from './useGestures'
import type { Gestures } from './useGestures'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'

afterEach(() => cleanup())

const s = translator('en')

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
  }
}

function scope(path: string, elements: DesignElement[]): ScopeSnapshot {
  return {
    path,
    model: {
      name: path || 'Acme',
      elements,
      relations: [],
      diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [] })],
    },
    activeDiagramId: 'l7',
    logoLibrary: [],
  }
}

/**
 * `retail` and `road` both define the WMS — the conflict *link* exists to
 * resolve — and the organisation above them holds nothing about it.
 */
function tree(): ScopeSnapshot[] {
  return [
    scope('', []),
    scope('retail', [element('wms', { name: 'Retail WMS', vendor: 'Initech' })]),
    scope('road', [element('wms', { name: 'Road WMS' })]),
  ]
}

type Harness = {
  gestures: () => Gestures
  session: () => ModelSession
  store: InMemoryScopeStore
  writes: string[]
  notices: [string, string | undefined][]
  failures: string[]
}

type Options = {
  /** The source carries the open scope's changes as steps (`Shell.publishesSteps`). */
  published?: boolean
  /** Somebody else's save, made between this side's read of a scope and its write. */
  meanwhile?: (store: InMemoryScopeStore, path: string) => Promise<void>
  /** The open scope is only read (`ModelSession.readOnly`). */
  readOnly?: boolean
}

function mount(open: string, initial = tree(), failOnWrite?: number, options: Options = {}): Harness {
  const store = new InMemoryScopeStore(initial)
  const writes: string[] = []
  const notices: [string, string | undefined][] = []
  const failures: string[] = []
  const held = initial.find((one) => one.path === open)!
  let interloped = false
  const scopes = {
    save: async (one: ScopeSnapshot, expects?: string) => {
      writes.push(one.path)
      if (failOnWrite !== undefined && writes.length === failOnWrite) {
        throw new Error('the store said no')
      }
      if (options.meanwhile && !interloped) {
        interloped = true
        await options.meanwhile(store, one.path)
      }
      return store.save(one, expects)
    },
    load: (path: string) => store.load(path),
  }

  let gestures!: Gestures
  let session!: ModelSession
  const notify = (message: string, severity?: string) => { notices.push([message, severity]) }
  function Probe() {
    // The session's toasts go to the same list: the refusal at ⌘Z is the
    // session's, and it is what a person sees after a gesture.
    session = useModelSession({ initialProject: held, notify, s, ...(options.readOnly ? { readOnly: true } : {}) })
    gestures = useGestures({
      scope: open,
      scopes,
      models: () => store.models(),
      index: indexScopes(initial.map((one) => ({ path: one.path, model: one.model }))),
      session,
      onTreeChanged: () => {},
      scopeLabel: (path) => path || 'Acme',
      notify,
      onFailure: (where) => { failures.push(where) },
      s,
      ...(options.published ? { published: true } : {}),
    })
    return null
  }
  render(<Probe />)
  return { gestures: () => gestures, session: () => session, store, writes, notices, failures }
}

const settle = () => act(async () => {
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
})

describe('link', () => {
  /**
   * One scope, one command, an ordinary undo — which is what makes it the
   * repair for a conflict rather than a migration.
   */
  it('resolves a conflict in one undo step, without asking', async () => {
    const held = mount('road')
    await act(async () => { held.gestures().ask({ gesture: 'link', id: 'wms' }) })
    await settle()

    expect(held.gestures().choice).toBeUndefined()
    expect(held.session().current().elements[0]).toMatchObject({ ref: 'retail', name: 'Retail WMS' })
    expect(held.session().history()).toHaveLength(1)

    act(() => held.session().undo())
    expect(held.session().current().elements[0].ref).toBeUndefined()
  })

  it('writes only this scope, and says what it did', async () => {
    const held = mount('road')
    await act(async () => { held.gestures().ask({ gesture: 'link', id: 'wms' }) })
    await settle()
    expect(held.writes).toEqual(['road'])
    expect(held.notices[0][0]).toContain('stands in for')
  })
})

describe('promote', () => {
  const promote = async () => {
    const held = mount('retail')
    await act(async () => { held.gestures().ask({ gesture: 'promote', id: 'wms', to: '' }) })
    await settle()
    return held
  }

  /** It writes two scopes, so it is asked about before it runs. */
  it('asks first', async () => {
    const held = await promote()
    expect(held.gestures().choice?.kind).toBe('confirming')
    expect(held.writes).toEqual([])
  })

  it('writes the ancestor, then this scope', async () => {
    const held = await promote()
    await act(async () => { held.gestures().confirm() })
    await settle()

    expect(held.writes).toEqual(['', 'retail'])
    expect((await held.store.load(''))?.model.elements[0])
      .toMatchObject({ id: 'wms', name: 'Retail WMS', vendor: 'Initech' })
    expect((await held.store.load('retail'))?.model.elements[0])
      .toMatchObject({ id: 'wms', ref: '', name: 'Retail WMS' })
  })

  /** Only half of the step is on this stack, so ⌘Z stops at it — and says why. */
  it('leaves a barrier the stack will not go past', async () => {
    const held = await promote()
    await act(async () => { held.gestures().confirm() })
    await settle()

    act(() => held.session().undo())
    expect(held.session().current().elements[0].ref).toBe('')
    expect(held.notices.map(([message]) => message).join(' ')).toContain('two scopes')
  })

  /**
   * A failure after the other scope was written leaves a DUPLICATE, never a
   * hole: the definition is in both places, which is a conflict finding
   * somebody can see and repair.
   */
  it('leaves the record in both places when the second write refuses', async () => {
    const held = mount('retail', tree(), 2)
    await act(async () => { held.gestures().ask({ gesture: 'promote', id: 'wms', to: '' }) })
    await settle()
    await act(async () => { held.gestures().confirm() })
    await settle()

    expect((await held.store.load(''))?.model.elements[0]).toMatchObject({ id: 'wms' })
    expect((await held.store.load('retail'))?.model.elements[0].ref).toBeUndefined()
    expect(held.failures).toContain('gesture.save')
    expect(held.notices.some(([message, severity]) => severity === 'warning' && message.includes('both places')))
      .toBe(true)
  })
})

describe('what is on offer', () => {
  it('offers nothing about a record another scope answers for', async () => {
    const held = mount('road', [
      scope('', [element('wms')]),
      scope('road', [element('wms', { ref: '' })]),
    ])
    expect(held.gestures().offers('wms')).toEqual([])
  })

  it('offers link where another scope defines it, and the three that move it', () => {
    const held = mount('retail')
    expect(held.gestures().offers('wms')).toEqual(['link', 'promote', 'transfer'])
    expect(held.gestures().targets('promote')).toEqual([''])
    expect(held.gestures().targets('transfer')).toEqual(['', 'road'])
  })

  it('opens the chooser on a record it holds, and nothing on one it does not', () => {
    const held = mount('retail')
    act(() => held.gestures().choose('nope'))
    expect(held.gestures().choice).toBeUndefined()
    act(() => held.gestures().choose('wms'))
    expect(held.gestures().choice).toMatchObject({ kind: 'choosing', name: 'Retail WMS' })
  })
})

/**
 * A whole write lands over whatever else happened to the scope it writes, so
 * the two the gestures make are made the way a second writer needs them made.
 */
describe('with somebody else writing too', () => {
  /**
   * The other scope is read, changed and written back. A colleague's save to
   * it in between is written over by a blind save; expecting what was read,
   * the store refuses, and the definition is written again into their version.
   */
  it('writes the definition into the other scope as it stands, keeping what was saved meanwhile', async () => {
    const held = mount('retail', tree(), undefined, {
      meanwhile: async (store, path) => {
        const theirs = await store.load(path)
        await store.save({ ...theirs!, model: { ...theirs!.model, name: 'Renamed meanwhile' } })
      },
    })
    await act(async () => { held.gestures().ask({ gesture: 'promote', id: 'wms', to: '' }) })
    await settle()
    await act(async () => { held.gestures().confirm() })
    await settle()

    const above = await held.store.load('')
    expect(above?.model.name).toBe('Renamed meanwhile')
    expect(above?.model.elements[0]).toMatchObject({ id: 'wms', name: 'Retail WMS' })
    expect(held.writes).toEqual(['', '', 'retail'])
  })

  /**
   * Where every change of the open scope is published as a step, the command
   * the gesture dispatched has gone out already, and a whole write of this
   * window's model after it would land over every step somebody else made to
   * the scope in the meantime.
   */
  it('does not write the open scope whole where its steps are published', async () => {
    const held = mount('retail', tree(), undefined, { published: true })
    await act(async () => { held.gestures().ask({ gesture: 'promote', id: 'wms', to: '' }) })
    await settle()
    await act(async () => { held.gestures().confirm() })
    await settle()

    expect(held.writes).toEqual([''])
    expect(held.session().current().elements[0]).toMatchObject({ id: 'wms', ref: '' })
    expect(held.notices.some(([, severity]) => severity === 'success')).toBe(true)
  })
})

/**
 * A scope that is only read makes no gesture. Asked at the start rather than
 * at the session's own refusal at the end: by then the other scope would
 * already hold the definition, and this one would never be told.
 */
describe('on a scope that is only read', () => {
  it('offers nothing', () => {
    const held = mount('road', tree(), undefined, { readOnly: true })
    expect(held.gestures().offers('wms')).toEqual([])
  })

  it('writes no scope at all, and says why', async () => {
    const held = mount('retail', tree(), undefined, { readOnly: true })
    await act(async () => { held.gestures().ask({ gesture: 'promote', id: 'wms', to: '' }) })
    await settle()
    expect(held.gestures().choice).toBeUndefined()
    expect(held.writes).toEqual([])
    expect(held.notices.map(([message]) => message).join(' ')).toContain('open to be read and not changed')
  })
})
