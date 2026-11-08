// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one thread every reader mounts (ADR-0037 §3, §4): the comments about
 * one record, oldest first, the replies under the comment they answer, and a
 * field to write one more.
 *
 * **Who writes is *you*** (§5): the person the source says is using the app,
 * or this install's *This is me*. Where neither says anybody, the first
 * comment asks once — the register's picker, with *New person…* and its
 * duplicate check — keeps the answer as *This is me*, and then writes. A
 * comment is never signed by a name typed in.
 *
 * **What it offers is what the source says** (§5): *Edit* on your own
 * comments, *Remove* on your own and — where you may moderate the scope — on
 * anybody's, *Comment* and *Reply* wherever you may comment. A removed comment
 * reads *Comment deleted* where it stood, so its replies keep their place.
 *
 * Each step goes through the session the workspace hands down
 * (`CommentsContext`): one step each, in the Activity list, undone by ⌘Z.
 *
 * A comment's body is drawn by the markdown renderer every description is
 * drawn with (`renderMarkdown`), which arrives in a script of its own: the
 * thread is under every reader, and the renderer must not ride in the first
 * download behind it.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { formatMoment } from '../../i18n/dates'
import type { Comment, CommentFrom } from '../../model/comment'
import { isRemoved } from '../../model/comment'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { RecordKey } from '../../model/recordKey'
import { MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
import { renderMarkdown } from '../../documentation/ui/renderMarkdown'
import { meIn } from '../../people/me'
import { registerOf } from '../../people/shown'
import { useSaying } from '../../people/ui/access'
import { usePersonNames } from '../../people/ui/names'
import type { PersonNames } from '../../people/ui/names'
import { PersonPicker } from '../../people/ui/PersonPicker'
import { Button } from '../../widgets/kit/Button'
import { MoreMenu } from '../../widgets/kit/Menu'
import { Toast } from '../../widgets/kit/Toast'
import { useDraft } from '../../widgets/kit/drafts'
import type { ToastWords } from '../../widgets/kit/Toast'
import { commentCount, replyTarget, threadOf } from '../thread'
import { useComments } from './CommentsContext'
import type { CommentsAccess } from './CommentsContext'

export type CommentThreadProps = {
  /** The record the thread is about. */
  about: RecordKey
  /** The scope that keeps the record, where it is not the scope open: its thread is read and written there. */
  scope?: string
  /** What that scope is called, and the way there: the notice then links to it. */
  scopeLabel?: string
  onOpenScope?: () => void
  /** What a record a comment came with is called (a merge's absorbed one, or the number it had before a move); its id where not said. */
  nameOf?: (from: CommentFrom) => string
  /** How to open the record a comment came with, where it can be: the name is then a link. */
  openFrom?: (from: CommentFrom) => (() => void) | undefined
  /** False where the screen around it already names it, as a tab or a section headed *Comments* does: no second heading, no second landmark, no rule. */
  headed?: boolean
  /** Opened by a press on *Write a comment*: the box takes the focus, so what is typed next lands in it. */
  focusNew?: boolean
}

/** What is being written: a new comment, a reply to one, or an edit of one. */
type Writing = { kind: 'new' } | { kind: 'reply'; to: string } | { kind: 'edit'; id: string }

export function CommentThread({ about, scope, scopeLabel, onOpenScope, nameOf, openFrom, headed = true, focusNew = false }: CommentThreadProps) {
  const access = useComments()
  const { t } = useStrings()
  if (!access) return null
  if (scope !== undefined && scope !== access.scope) {
    return (
      <ThreadFrame count={undefined} headed={headed}>
        <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>
          {t('comments.elsewhere')}
          {onOpenScope && (
            <>
              {' '}
              <Link component="button" type="button" onClick={onOpenScope} data-testid="comment-thread-open-scope" sx={{ fontSize: 'inherit', verticalAlign: 'baseline' }}>
                {t('comments.openScope', { scope: scopeLabel ?? scope })}
              </Link>
            </>
          )}
        </Typography>
      </ThreadFrame>
    )
  }
  return <OpenThread access={access} about={about} headed={headed} focusNew={focusNew} {...(nameOf ? { nameOf } : {})} {...(openFrom ? { openFrom } : {})} />
}

function ThreadFrame({ count, headed, children }: { count: number | undefined; headed: boolean; children: ReactNode }) {
  const { t } = useStrings()
  if (!headed) return <Box data-testid="comment-thread" sx={{ display: 'grid', gap: 1 }}>{children}</Box>
  return (
    <Box component="section" data-testid="comment-thread" aria-label={t('comments.title')} sx={{ display: 'grid', gap: 1, mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2" component="h3" data-testid="comment-count">
        {count === undefined || count === 0 ? t('comments.title') : t('comments.count', { count })}
      </Typography>
      {children}
    </Box>
  )
}

/** Who *you* are, as the register reads now; nothing where nobody is said. */
function useMe(names: PersonNames): PersonId | undefined {
  const register = names.access
  return useMemo(() => meIn(register?.me, registerOf(register?.people ?? []))?.id, [register?.me, register?.people])
}

function OpenThread({ access, about, headed, focusNew, nameOf, openFrom }: {
  access: CommentsAccess; about: RecordKey; headed: boolean; focusNew: boolean; nameOf?: (from: CommentFrom) => string; openFrom?: (from: CommentFrom) => (() => void) | undefined
}) {
  const { t } = useStrings()
  const names = usePersonNames()
  const me = useMe(names)
  const [writing, setWriting] = useState<Writing | undefined>(undefined)
  const [asking, setAsking] = useState<{ body: string; replyTo?: string } | undefined>(undefined)
  const [refused, setRefused] = useState(false)
  const [toast, setToast] = useState<ToastWords | null>(null)
  const entries = useMemo(() => threadOf(access.comments, about), [access.comments, about])
  const count = useMemo(() => commentCount(access.comments, about), [access.comments, about])

  const said = (ok: boolean) => {
    setRefused(!ok)
    if (ok) setWriting(undefined)
    return ok
  }
  const post = (body: string, by: PersonId, replyTo?: string) => said(access.dispatch({
    type: 'comment.add',
    comment: { id: access.makeId(), about, by: pickedPerson(by), at: access.now(), body, ...(replyTo ? { replyTo } : {}) },
  }))
  const write = (body: string, replyTo?: string) => {
    if (body.trim() === '') return
    if (me === undefined) setAsking({ body, ...(replyTo ? { replyTo } : {}) })
    else post(body, me, replyTo)
  }
  const actions: EntryActions = {
    me, names, mayComment: access.mayComment, mayModerate: access.mayModerate, writing, setWriting,
    reply: (to, body) => write(body, replyTarget(access.comments, to)),
    edit: (id, body) => said(access.dispatch({ type: 'comment.update', id, body, edited: access.now() })),
    remove: (id) => {
      const before = access.comments.find((one) => one.id === id)
      if (me === undefined || !before) return
      // Taken out at once, and put back from the toast as one step of its own: the log may be everybody's.
      if (said(access.dispatch({ type: 'comment.remove', id, removed: { at: access.now(), by: pickedPerson(me) } }))) {
        setToast({ key: `${id}:${Date.now()}`, message: t('comments.removedToast'), undo: { onPress: () => { setToast(null); access.dispatch({ type: 'comment.put', comment: before }) }, shared: true } })
      }
    },
    ...(nameOf ? { nameOf } : {}),
    ...(openFrom ? { openFrom } : {}),
    ...(access.pointed ? { pointed: access.pointed } : {}),
  }

  return (
    <ThreadFrame count={count} headed={headed}>
      {entries.length === 0 && <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>{t('comments.empty')}</Typography>}
      {entries.map(({ comment, replies }) => (
        <Box key={comment.id} sx={{ display: 'grid', gap: 0.75 }}>
          <Entry comment={comment} actions={actions} />
          {replies.length > 0 && (
            <Box sx={{ display: 'grid', gap: 0.75, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
              {replies.map((reply) => <Entry key={reply.id} comment={reply} actions={actions} />)}
            </Box>
          )}
          {writing?.kind === 'reply' && writing.to === comment.id && (
            <Box sx={{ pl: 2 }}>
              <Composer label={t('comments.writeReply')} submit={t('comments.reply')} testId="comment-reply-field" autoFocus
                onSubmit={(body) => actions.reply(comment.id, body)} onCancel={() => setWriting(undefined)} />
            </Box>
          )}
        </Box>
      ))}
      {refused && <Typography role="alert" sx={{ fontSize: 'var(--t-small)', color: 'error.main' }}>{t('comments.refused')}</Typography>}
      {asking
        ? <AskMe names={names} onCancel={() => setAsking(undefined)} onPicked={(id) => {
          setAsking(undefined)
          post(asking.body, id, asking.replyTo)
          void names.access?.setMe(id)
        }} />
        : <NewComment access={access} names={names} writing={writing} onWrite={(body) => write(body)} focus={focusNew} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </ThreadFrame>
  )
}

/** The field for a new comment, or why there is none. */
function NewComment({ access, names, writing, onWrite, focus }: {
  access: CommentsAccess; names: PersonNames; writing: Writing | undefined; onWrite: (body: string) => void; focus: boolean
}) {
  const { t } = useStrings()
  if (!access.mayComment) return <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>{t('comments.readOnly')}</Typography>
  if (!names.access) return <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>{t('comments.noRegister')}</Typography>
  if (writing && writing.kind !== 'new') return null
  return <Composer label={t('comments.write')} submit={t('comments.send')} testId="comment-new" onSubmit={onWrite} clears autoFocus={focus} />
}

/** *Who is writing?*, asked once: the register's picker, kept as *This is me*. */
function AskMe({ names, onPicked, onCancel }: { names: PersonNames; onPicked: (id: PersonId) => void; onCancel: () => void }) {
  const { t } = useStrings()
  const saying = useSaying(t)
  // While the picker writes a new person it has its own Cancel: one question, one way out.
  const [adding, setAdding] = useState(false)
  if (!names.access) return null
  return (
    <Box data-testid="comment-who" sx={{ display: 'grid', gap: 0.75, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Typography sx={{ fontSize: 'var(--t-small)' }}>{t('comments.who')}</Typography>
      <PersonPicker register={names.access} saying={saying} value={undefined} onChange={(id) => { if (id) onPicked(id) }} onAdding={setAdding} s={t} />
      {!adding && <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="quiet" size="small" onClick={onCancel}>{t('comments.cancel')}</Button></Box>}
    </Box>
  )
}

/** A text field and its button: a comment, a reply or an edit. */
function Composer({ label, submit, initial = '', testId, onSubmit, onCancel, clears = false, autoFocus = false }: {
  label: string; submit: string; initial?: string; testId: string; onSubmit: (body: string) => void; onCancel?: () => void; clears?: boolean
  /** Where a press opened it (Reply, Edit): the writing starts there, not at the top of the page. */
  autoFocus?: boolean
}) {
  const { t } = useStrings()
  const [body, setBody] = useState(initial)
  // A comment typed and not sent is a draft: leaving the page asks first (`kit/drafts`).
  useDraft(body.trim() !== initial.trim())
  // A frame on: the menu Edit was chosen from hands the focus back to its button as it closes.
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!autoFocus) return undefined
    const frame = requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('textarea')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [autoFocus])
  const send = () => {
    if (body.trim() === '') return
    onSubmit(body.trim())
    if (clears) setBody('')
  }
  return (
    <Box ref={box} sx={{ display: 'grid', gap: 0.75 }}>
      <MarkdownEditor
        label={label} value={body} onChange={setBody} minRows={2} attachable={false} testId={testId} onSubmit={send}
        renderPreview={(text) => renderMarkdown(text)}
      />
      {/* Trailing, as GitHub's comment box and a macOS sheet: Cancel, then the button that sends, at the right. */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        {onCancel && <Button variant="quiet" size="small" onClick={onCancel}>{t('comments.cancel')}</Button>}
        <Button size="small" variant="primary" disabled={body.trim() === ''} onClick={send} data-testid={`${testId}-send`}>{submit}</Button>
      </Box>
    </Box>
  )
}

type EntryActions = {
  /** The comment a search hit pointed at, where it is one of these. */
  pointed?: { readonly id: string; readonly nonce: number }
  me: PersonId | undefined
  names: PersonNames
  mayComment: boolean
  mayModerate: boolean
  writing: Writing | undefined
  setWriting: (writing: Writing | undefined) => void
  reply: (to: string, body: string) => void
  edit: (id: string, body: string) => void
  remove: (id: string) => void
  nameOf?: (from: CommentFrom) => string
  openFrom?: (from: CommentFrom) => (() => void) | undefined
}

/** One comment: who, when, what it says — or that it was removed — and what may be done with it. */
function Entry({ comment, actions }: { comment: Comment; actions: EntryActions }) {
  const { t, language } = useStrings()
  const { names } = actions
  const mine = names.isMe(comment.by)
  const editing = actions.writing?.kind === 'edit' && actions.writing.id === comment.id
  const gone = isRemoved(comment)
  const byline = [
    `${names.text(comment.by)}${mine ? ` · ${t('comments.you')}` : ''}`,
    formatMoment(comment.at, language),
    ...(comment.edited && !gone ? [t('comments.edited')] : []),
    ...(comment.via ? [t('comments.via', { agent: comment.via })] : []),
  ].join(' · ')
  // Pointed at by a search hit: marked, and brought into view once per pointing.
  const pointed = actions.pointed?.id === comment.id ? actions.pointed : undefined
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => { if (pointed) root.current?.scrollIntoView?.({ block: 'center' }) }, [pointed])
  return (
    <Box
      ref={root} data-testid={`comment-${comment.id}`} data-pointed={pointed ? 'true' : undefined}
      sx={{ display: 'grid', gap: 0.25, ...(pointed ? { outline: 2, outlineColor: 'primary.main', outlineOffset: 4, borderRadius: 1 } : {}) }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: 'var(--t-small)', color: 'text.secondary' }}>{byline}</Typography>
        {!gone && !editing && <EntryMore comment={comment} mine={mine} actions={actions} />}
      </Box>
      {comment.from && <CameWith from={comment.from} actions={actions} />}
      {gone && <Typography sx={{ fontSize: 'var(--t-small)', fontStyle: 'italic', color: 'text.secondary' }}>{t('comments.removed')}</Typography>}
      {!gone && editing && (
        <Composer label={t('comments.edit')} submit={t('comments.save')} initial={comment.body} testId="comment-edit-field" autoFocus
          onSubmit={(body) => actions.edit(comment.id, body)} onCancel={() => actions.setWriting(undefined)} />
      )}
      {!gone && !editing && <Box sx={{ fontSize: 'var(--t-body)' }}>{renderMarkdown(comment.body)}</Box>}
      {!gone && !editing && <EntryButtons comment={comment} mine={mine} actions={actions} />}
    </Box>
  )
}

/**
 * Where a comment came from (§6): the record it was written about, by the
 * number people call it — the history line above says *Moved here from
 * OB-0001*, and this says the same — and a link to it where it can be opened.
 */
function CameWith({ from, actions }: { from: CommentFrom; actions: EntryActions }) {
  const { t } = useStrings()
  const name = actions.nameOf?.(from) ?? from.id
  const open = actions.openFrom?.(from)
  return (
    <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }} data-testid="comment-from">
      {t('comments.cameWith')}{' '}
      {open
        ? <Link component="button" type="button" onClick={open} sx={{ fontSize: 'inherit', verticalAlign: 'baseline' }}>{name}</Link>
        : name}
    </Typography>
  )
}

/** Reply under a comment, where a person may answer it. */
function EntryButtons({ comment, actions }: { comment: Comment; mine: boolean; actions: EntryActions }) {
  const { t } = useStrings()
  const target = comment.replyTo ?? comment.id
  if (!actions.mayComment) return null
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Button variant="quiet" size="small" data-testid={`comment-reply-${comment.id}`} onClick={() => actions.setWriting({ kind: 'reply', to: target })}>
        {t('comments.reply')}
      </Button>
    </Box>
  )
}

/** A comment's ⋯, at the right of its byline: Edit on your own, and Remove last, as every record's ⋯ has Delete. */
function EntryMore({ comment, mine, actions }: { comment: Comment; mine: boolean; actions: EntryActions }) {
  const { t } = useStrings()
  const mayRemove = actions.mayComment && actions.me !== undefined && (mine || actions.mayModerate)
  const items = [
    ...(actions.mayComment && mine ? [{ label: t('comments.edit'), onSelect: () => actions.setWriting({ kind: 'edit', id: comment.id }), 'data-testid': `comment-edit-${comment.id}` }] : []),
    ...(mayRemove ? [{ label: t('comments.remove'), hint: t('comments.removeTip'), final: true, onSelect: () => actions.remove(comment.id), 'data-testid': `comment-remove-${comment.id}` }] : []),
  ]
  if (items.length === 0) return null
  return <MoreMenu size="small" label={t('comments.more')} items={items} />
}
