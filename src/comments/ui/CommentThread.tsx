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
 * reads *Comment removed* where it stood, so its replies keep their place.
 *
 * Each step goes through the session the workspace hands down
 * (`CommentsContext`): one step each, in the Activity list, undone by ⌘Z.
 *
 * A comment's body is drawn by the markdown renderer every description is
 * drawn with (`renderMarkdown`), which arrives in a script of its own: the
 * thread is under every reader, and the renderer must not ride in the first
 * download behind it.
 */
import { useMemo, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { formatMoment } from '../../i18n/dates'
import type { Comment, CommentFrom } from '../../model/comment'
import { isRemoved } from '../../model/comment'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { RecordKey } from '../../model/recordKey'
import { renderMarkdown } from '../../documentation/ui/renderMarkdown'
import { meIn } from '../../people/me'
import { registerOf } from '../../people/shown'
import { useSaying } from '../../people/ui/access'
import { usePersonNames } from '../../people/ui/names'
import type { PersonNames } from '../../people/ui/names'
import { PersonPicker } from '../../people/ui/PersonPicker'
import { commentCount, replyTarget, threadOf } from '../thread'
import { useComments } from './CommentsContext'
import type { CommentsAccess } from './CommentsContext'

export type CommentThreadProps = {
  /** The record the thread is about. */
  about: RecordKey
  /** The scope that keeps the record, where it is not the scope open: its thread is read and written there. */
  scope?: string
  /** What a record a comment came with is called (a merge's absorbed one, or the number it had before a move); its id where not said. */
  nameOf?: (from: CommentFrom) => string
  /** How to open the record a comment came with, where it can be: the name is then a link. */
  openFrom?: (from: CommentFrom) => (() => void) | undefined
}

/** What is being written: a new comment, a reply to one, or an edit of one. */
type Writing = { kind: 'new' } | { kind: 'reply'; to: string } | { kind: 'edit'; id: string }

export function CommentThread({ about, scope, nameOf, openFrom }: CommentThreadProps) {
  const access = useComments()
  const { t } = useStrings()
  if (!access) return null
  if (scope !== undefined && scope !== access.scope) {
    return <ThreadFrame count={undefined}><Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{t('comments.elsewhere')}</Typography></ThreadFrame>
  }
  return <OpenThread access={access} about={about} {...(nameOf ? { nameOf } : {})} {...(openFrom ? { openFrom } : {})} />
}

function ThreadFrame({ count, children }: { count: number | undefined; children: ReactNode }) {
  const { t } = useStrings()
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

function OpenThread({ access, about, nameOf, openFrom }: {
  access: CommentsAccess; about: RecordKey; nameOf?: (from: CommentFrom) => string; openFrom?: (from: CommentFrom) => (() => void) | undefined
}) {
  const { t } = useStrings()
  const names = usePersonNames()
  const me = useMe(names)
  const [writing, setWriting] = useState<Writing | undefined>(undefined)
  const [asking, setAsking] = useState<{ body: string; replyTo?: string } | undefined>(undefined)
  const [refused, setRefused] = useState(false)
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
      if (me !== undefined) said(access.dispatch({ type: 'comment.remove', id, removed: { at: access.now(), by: pickedPerson(me) } }))
    },
    ...(nameOf ? { nameOf } : {}),
    ...(openFrom ? { openFrom } : {}),
  }

  return (
    <ThreadFrame count={count}>
      {entries.length === 0 && <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{t('comments.empty')}</Typography>}
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
              <Composer label={t('comments.writeReply')} submit={t('comments.reply')} testId="comment-reply-field"
                onSubmit={(body) => actions.reply(comment.id, body)} onCancel={() => setWriting(undefined)} />
            </Box>
          )}
        </Box>
      ))}
      {refused && <Typography role="alert" sx={{ fontSize: 12.5, color: 'error.main' }}>{t('comments.refused')}</Typography>}
      {asking
        ? <AskMe names={names} onCancel={() => setAsking(undefined)} onPicked={(id) => {
          setAsking(undefined)
          post(asking.body, id, asking.replyTo)
          void names.access?.setMe(id)
        }} />
        : <NewComment access={access} names={names} writing={writing} onWrite={(body) => write(body)} />}
    </ThreadFrame>
  )
}

/** The field for a new comment, or why there is none. */
function NewComment({ access, names, writing, onWrite }: {
  access: CommentsAccess; names: PersonNames; writing: Writing | undefined; onWrite: (body: string) => void
}) {
  const { t } = useStrings()
  if (!access.mayComment) return <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('comments.readOnly')}</Typography>
  if (!names.access) return <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('comments.noRegister')}</Typography>
  if (writing && writing.kind !== 'new') return null
  return <Composer label={t('comments.write')} submit={t('comments.send')} testId="comment-new" onSubmit={onWrite} clears />
}

/** *Who is writing?*, asked once: the register's picker, kept as *This is me*. */
function AskMe({ names, onPicked, onCancel }: { names: PersonNames; onPicked: (id: PersonId) => void; onCancel: () => void }) {
  const { t } = useStrings()
  const saying = useSaying(t)
  if (!names.access) return null
  return (
    <Box data-testid="comment-who" sx={{ display: 'grid', gap: 0.75, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Typography sx={{ fontSize: 12.5 }}>{t('comments.who')}</Typography>
      <PersonPicker register={names.access} saying={saying} value={undefined} onChange={(id) => { if (id) onPicked(id) }} s={t} />
      <Box><Button size="small" onClick={onCancel}>{t('comments.cancel')}</Button></Box>
    </Box>
  )
}

/** A text field and its button: a comment, a reply or an edit. */
function Composer({ label, submit, initial = '', testId, onSubmit, onCancel, clears = false }: {
  label: string; submit: string; initial?: string; testId: string; onSubmit: (body: string) => void; onCancel?: () => void; clears?: boolean
}) {
  const { t } = useStrings()
  const [body, setBody] = useState(initial)
  const send = () => {
    if (body.trim() === '') return
    onSubmit(body.trim())
    if (clears) setBody('')
  }
  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      <TextField
        size="small" multiline minRows={2} label={label} value={body} onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send() }}
        slotProps={{ htmlInput: { 'data-testid': testId } }}
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" disabled={body.trim() === ''} onClick={send} data-testid={`${testId}-send`}>{submit}</Button>
        {onCancel && <Button size="small" onClick={onCancel}>{t('comments.cancel')}</Button>}
      </Box>
    </Box>
  )
}

type EntryActions = {
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
  return (
    <Box data-testid={`comment-${comment.id}`} sx={{ display: 'grid', gap: 0.25 }}>
      <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{byline}</Typography>
      {comment.from && <CameWith from={comment.from} actions={actions} />}
      {gone && <Typography sx={{ fontSize: 13, fontStyle: 'italic', color: 'text.secondary' }}>{t('comments.removed')}</Typography>}
      {!gone && editing && (
        <Composer label={t('comments.edit')} submit={t('comments.save')} initial={comment.body} testId="comment-edit-field"
          onSubmit={(body) => actions.edit(comment.id, body)} onCancel={() => actions.setWriting(undefined)} />
      )}
      {!gone && !editing && <Box sx={{ fontSize: 13.5 }}>{renderMarkdown(comment.body)}</Box>}
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
    <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} data-testid="comment-from">
      {t('comments.cameWith')}{' '}
      {open
        ? <Link component="button" type="button" onClick={open} sx={{ fontSize: 'inherit', verticalAlign: 'baseline' }}>{name}</Link>
        : name}
    </Typography>
  )
}

function EntryButtons({ comment, mine, actions }: { comment: Comment; mine: boolean; actions: EntryActions }) {
  const { t } = useStrings()
  const target = comment.replyTo ?? comment.id
  const mayRemove = actions.mayComment && actions.me !== undefined && (mine || actions.mayModerate)
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {actions.mayComment && (
        <Button size="small" data-testid={`comment-reply-${comment.id}`} onClick={() => actions.setWriting({ kind: 'reply', to: target })}>
          {t('comments.reply')}
        </Button>
      )}
      {actions.mayComment && mine && (
        <Button size="small" data-testid={`comment-edit-${comment.id}`} onClick={() => actions.setWriting({ kind: 'edit', id: comment.id })}>
          {t('comments.edit')}
        </Button>
      )}
      {mayRemove && (
        <Tooltip title={t('comments.removeTip')}>
          <Button size="small" color="error" data-testid={`comment-remove-${comment.id}`} onClick={() => actions.remove(comment.id)}>
            {t('comments.remove')}
          </Button>
        </Tooltip>
      )}
    </Box>
  )
}
