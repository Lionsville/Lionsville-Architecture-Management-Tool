// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The one thread (ADR-0037 §3–§5), driven through the writer as the
 * workspace drives it: a comment written as *you*, asked once who that is
 * where nobody is said, a reply under the comment it answers — and under it
 * again when a reply is answered — an edit of your own, a removal that leaves
 * *Comment removed*, and nothing offered where the scope is only read.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { renderShell } from '../../app/testing/renderShell'
import { translator } from '../../i18n'
import type { Command } from '../../model/commands'
import type { Comment } from '../../model/comment'
import { commentList, fromArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import { apply } from '../../model/reducer'
import type { PersonId } from '../../model/person'
import type { Person } from '../../people/person'
import { DEFAULT_POLICY } from '../../people/policy'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { personNames, PersonNamesProvider } from '../../people/ui/names'
import { CommentsProvider } from './CommentsContext'
import { CommentThread } from './CommentThread'
import { CommentBadge } from './CommentBadge'

afterEach(() => cleanup())

const s = translator('en')
const EVA: Person = { id: 'pe-eva', name: 'Eva Lind', pseudonym: 'BCDF', kind: 'internal', state: 'active' }
const TOM: Person = { id: 'pe-tom', name: 'Tom Berg', pseudonym: 'GHJK', kind: 'internal', state: 'active' }
const AT = '2026-10-16T09:00:00.000Z'
const web = { kind: 'element' as const, id: 'web' }
const nothing = () => Promise.resolve({ refused: 'people.unknown' as const })

function register(me: PersonId | undefined, setMe: (id: PersonId | undefined) => void = () => {}): PeopleRegisterAccess {
  return {
    people: [EVA, TOM], policy: DEFAULT_POLICY, me, readOnly: false, today: '2026-10-16',
    add: nothing, change: nothing, leave: nothing, forget: nothing, remove: nothing, merge: nothing,
    setPolicy: () => Promise.resolve(), setMe: (id) => { setMe(id); return Promise.resolve() }, mentionsOf: () => Promise.resolve([]),
  }
}

function scope(comments: Comment[] = []): Model {
  return fromArrays({
    name: 'Shop', relations: [], diagrams: [], comments,
    elements: [{ id: 'web', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: false, aspects: {} }],
  })
}

/** The workspace, as far as a thread sees it: a model, the writer over it, and the register. */
function Harness({ start, me, mayComment = true, mayModerate = true, onMe, keptIn }: {
  start: Model; me: PersonId | undefined; mayComment?: boolean; mayModerate?: boolean; onMe?: (id: PersonId | undefined) => void; keptIn?: string
}) {
  const [model, setModel] = useState(start)
  const [who, setWho] = useState(me)
  let next = 0
  const dispatch = (command: Command) => {
    const result = apply(model, command)
    if (result.ok) setModel(result.model)
    return result.ok
  }
  return (
    <PersonNamesProvider names={personNames(register(who, (id) => { setWho(id); onMe?.(id) }), s)}>
      <CommentsProvider value={{
        scope: 'shop', comments: commentList(model), dispatch, mayComment, mayModerate,
        makeId: () => `cm-new-${++next}`, now: () => AT,
      }}>
        <CommentThread about={web} {...(keptIn ? { scope: keptIn } : {})} />
      </CommentsProvider>
      <output data-testid="held">{JSON.stringify(commentList(model))}</output>
    </PersonNamesProvider>
  )
}

const held = (): Comment[] => JSON.parse(screen.getByTestId('held').textContent ?? '[]') as Comment[]

function write(testId: string, text: string) {
  fireEvent.change(screen.getByTestId(testId), { target: { value: text } })
  fireEvent.click(screen.getByTestId(`${testId}-send`))
}

const first: Comment = { id: 'cm-1', about: web, by: { person: 'pe-tom' }, at: AT, body: 'Who runs **this**?' }
const mine: Comment = { id: 'cm-2', about: web, by: { person: 'pe-eva' }, at: AT, body: 'The web team.', replyTo: 'cm-1' }

describe('a thread', () => {
  it('says there is nothing yet, and writes a comment as you', () => {
    renderShell(<Harness start={scope()} me="pe-eva" />)
    expect(screen.getByTestId('comment-count').textContent).toBe('Comments')
    write('comment-new', '  Who owns this?  ')
    expect(held()).toEqual([{ id: 'cm-new-1', about: web, by: { person: 'pe-eva' }, at: AT, body: 'Who owns this?' }])
    expect(screen.getByTestId('comment-count').textContent).toBe('Comments (1)')
    expect(screen.getByTestId('comment-cm-new-1').textContent).toContain('Eva Lind · you')
  })

  it('asks once who is writing where nobody is said, keeps the answer as This is me, and then writes', () => {
    const said: (PersonId | undefined)[] = []
    renderShell(<Harness start={scope()} me={undefined} onMe={(id) => said.push(id)} />)
    write('comment-new', 'A question')
    expect(held()).toEqual([])
    fireEvent.click(within(screen.getByTestId('comment-who')).getByTestId('person-pick-pe-tom'))
    expect(said).toEqual(['pe-tom'])
    expect(held()).toEqual([{ id: 'cm-new-1', about: web, by: { person: 'pe-tom' }, at: AT, body: 'A question' }])
    expect(screen.queryByTestId('comment-who')).toBeNull()
  })

  it('puts a reply under the comment it answers, and a reply to a reply under the same one', () => {
    renderShell(<Harness start={scope([first, mine])} me="pe-eva" />)
    fireEvent.click(screen.getByTestId('comment-reply-cm-2'))
    write('comment-reply-field', 'And the shop team')
    expect(held().at(-1)).toMatchObject({ body: 'And the shop team', replyTo: 'cm-1' })
  })

  it('edits your own comment and says it was edited, and offers no edit of anybody else’s', () => {
    renderShell(<Harness start={scope([first, mine])} me="pe-eva" />)
    expect(screen.queryByTestId('comment-edit-cm-1')).toBeNull()
    fireEvent.click(screen.getByTestId('comment-edit-cm-2'))
    write('comment-edit-field', 'The web team, for now.')
    expect(held()[1]).toEqual({ ...mine, body: 'The web team, for now.', edited: AT })
    expect(screen.getByTestId('comment-cm-2').textContent).toContain('edited')
  })

  it('removes a comment as a tombstone the replies stay under', () => {
    renderShell(<Harness start={scope([first, mine])} me="pe-eva" />)
    fireEvent.click(screen.getByTestId('comment-remove-cm-1'))
    expect(held()[0]).toEqual({ ...first, body: '', removed: { at: AT, by: { person: 'pe-eva' } } })
    expect(screen.getByTestId('comment-cm-1').textContent).toContain('Comment removed')
    expect(screen.getByTestId('comment-cm-2')).toBeTruthy()
    expect(screen.getByTestId('comment-count').textContent).toBe('Comments (1)')
  })

  it('offers removing another’s comment only to who may moderate', () => {
    renderShell(<Harness start={scope([first, mine])} me="pe-eva" mayModerate={false} />)
    expect(screen.queryByTestId('comment-remove-cm-1')).toBeNull()
    expect(screen.getByTestId('comment-remove-cm-2')).toBeTruthy()
  })

  it('offers nothing to write where the scope is only read, and reads a record of another scope there', () => {
    renderShell(<Harness start={scope([first])} me="pe-eva" mayComment={false} />)
    expect(screen.queryByTestId('comment-new')).toBeNull()
    expect(screen.queryByTestId('comment-reply-cm-1')).toBeNull()
    expect(screen.getByText(s('comments.readOnly'))).toBeTruthy()
    cleanup()
    renderShell(<Harness start={scope([first])} me="pe-eva" keptIn="elsewhere" />)
    expect(screen.getByText(s('comments.elsewhere'))).toBeTruthy()
    expect(screen.queryByTestId('comment-cm-1')).toBeNull()
  })

  it('draws nothing with no workspace around it', () => {
    renderShell(<CommentThread about={web} />)
    expect(screen.queryByTestId('comment-thread')).toBeNull()
  })
})

describe('a record’s count where it is listed', () => {
  it('says how many comments say something, and nothing where none do', () => {
    renderShell(
      <CommentsProvider value={{ scope: 'shop', comments: [first, mine], dispatch: () => true, mayComment: true, mayModerate: true, makeId: () => 'x', now: () => AT }}>
        <CommentBadge about={web} />
        <CommentBadge about={{ kind: 'element', id: 'pay' }} />
      </CommentsProvider>,
    )
    expect(screen.getByTestId('comment-badge-element-web').textContent).toBe('2')
    expect(screen.queryByTestId('comment-badge-element-pay')).toBeNull()
  })
})
