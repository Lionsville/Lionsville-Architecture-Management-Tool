// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's settings, as one page with an address (`#/<scope>/-/settings`),
 * reached the same way from the tree, the home and row one. The same fields at
 * every level, because every scope is the same document (ADR-0012 §1).
 *
 * **Each change lands by itself, as a step**, so there is no Save and no Cancel
 * and the frame's undo, the Edit menu's and ⌘Z take it back, on the page and on
 * the home after it closes. A field lands as the person leaves it. *Filed
 * under* and *Served by* are not on that stack — a move, and a unit's own
 * `scopes` written where the unit is kept — and the page's first line says so.
 *
 * **Renaming is not moving.** `acme/rail` is how everything under it is filed;
 * renaming relabels and leaves the address alone. *Filed under* changes the
 * address of this scope and of everything beneath it, so that one still asks.
 * A scope may not be filed under itself or a descendant, and the root has no
 * such field, because there is nowhere above it.
 *
 * The two sections of defaults are seeds, not settings that reach back: each says
 * what it falls back on, and what a change does not reach.
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Translate } from '../../i18n'
import { AspectColumnsEditor, settleFreshAspectKeys } from '../../editor'
import { DEFAULT_ASPECT_CONFIG } from '../../model'
import type { AspectConfigEntry } from '../../model'
import { isSafeLinkUrl } from '../../projects/links'
import type { RecordLink } from '../../projects/links'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import { parentScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { typeChoiceOf } from '../../projects/scopeType'
import type { TypeChoice } from '../../projects/scopeType'
import { isTopic } from '../../projects/topics'
import { PageClose } from '../../widgets/PageClose'
import { PageDialog } from '../../widgets/PageDialog'
import { usePlaceTab } from '../../widgets/placeTab'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { Field, TextField, TextInput } from '../../widgets/kit/Field'
import { focusSettingsField, PreferenceRow, SettingNotKept, SettingsField, SettingsPage, SettingsSection } from '../../widgets/kit/SettingsPage'
import { MarkdownField } from '../../documentation/ui/MarkdownField'
import { renderMarkdown } from '../../documentation/ui/renderMarkdown'
import type { ScopeSettingsPatch } from '../App'
import { ScopeField } from './ScopeField'
import { TypeField } from './TypeField'
import { claimKey } from '../../widgets/kit/keys'
import { focusLeaves } from '../../widgets/kit/Surface'
import { WriteRefusalsContext } from '../writeRefusals'
import type { SettingsApplied } from './useOrganisation'

export const SETTINGS_TABS = ['general', 'links', 'exports', 'landscapes'] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]

/** A setting as it stood, and the step that puts it back. */
export type SettingsUndo = { readonly name: string; readonly run: () => void }

export type ScopeSettingsPageProps = {
  open: boolean
  onClose: () => void
  /** The scope, out of the listing. */
  target: ScopeSummary
  /** Its own document, for what the listing does not say; absent until it is read. */
  document: ScopeSnapshot | undefined
  tree: ScopeSummary
  /** What the scope above says, for what an empty field falls back on. */
  aboveClient?: string
  readOnly: boolean
  /** Answers whether it landed, where it can: a field whose change was refused says so and offers it again. */
  onApply: (path: ScopePath, patch: ScopeSettingsPatch) => void | Promise<SettingsApplied>
  /** Removal, which asks. Absent at the root. */
  onDelete?: () => void
  /** Where a link to it is made and said. */
  onCopyLink?: () => void
  /** The newest change this page can take back. */
  onUndoChange?: (undo: SettingsUndo | undefined) => void
  /** *Served by*, drawn by the screen that has the index. */
  servedBy?: ReactNode
  unitTypes?: readonly { id: string; name: string }[]
  /**
   * The field to give the focus to as the page opens (`PAGE_FIELDS`), as the
   * tree's *Move to…* lands on *Filed under*; the nonce says it is asked again.
   */
  field?: { readonly name: string; readonly nonce: number } | undefined
  s: Translate
}

function patchOf(target: ScopeSummary): ScopeSettingsPatch {
  return {
    name: target.name,
    client: target.client ?? '',
    description: target.description ?? '',
    links: (target.links ?? []).map((link) => ({ ...link })),
    type: typeChoiceOf(target),
  }
}

export function ScopeSettingsPage({
  open, onClose, target, document, tree, aboveClient, readOnly, onApply, onDelete, onCopyLink, onUndoChange, servedBy, unitTypes = [], field, s,
}: ScopeSettingsPageProps) {
  const [held, setTab] = usePlaceTab('general')
  const tab = held as SettingsTab
  const general = useLandOnField(open ? field : undefined, tab === 'general', setTab)
  const [asked, setAsked] = useState<ScopePath | undefined>(undefined)
  const steps = useRef<SettingsUndo[]>([])
  const path = target.path
  useEffect(() => { steps.current = []; onUndoChange?.(undefined) }, [path, onUndoChange])
  // Closing the page keeps its steps: a rename read on the home is still a step its undo takes back.

  const apply = useCallback(async (patch: Partial<ScopeSettingsPatch>, name: string, back: Partial<ScopeSettingsPatch>): Promise<SettingsApplied> => {
    const whole = patchOf(target)
    const answer = await Promise.resolve(onApply(path, { ...whole, ...patch })) ?? LANDED
    // A change that did not land is no step: undo would take back what is not there.
    if (!answer.ok) return answer
    const undo: SettingsUndo = {
      name,
      run: () => {
        void onApply(path, { ...patchOf(target), ...patch, ...back })
        steps.current.pop()
        onUndoChange?.(steps.current.at(-1))
      },
    }
    steps.current.push(undo)
    onUndoChange?.(undo)
    return answer
  }, [target, path, onApply, onUndoChange])
  const parent = parentScope(path) ?? ROOT_SCOPE
  const name = target.name.trim() || s('common.organisation')
  const canMove = path !== ROOT_SCOPE
  const topicNext = (type: TypeChoice) => type === 'kind:topic' && target.kind !== 'topic' && !isTopic(path, flattenScopes(tree))
  const model = document?.path === path ? document.model : undefined

  return (
    <PageDialog open={open} onClose={onClose} topInset={0} aria-label={s('settings.title')} data-testid="scope-settings-page">
      <PageClose onClose={onClose} />
      <SettingsPage
        title={s('settings.pageTitle')} owner={s('settings.owner')} data-guide="settings.page"
        section={tab} onSection={setTab}
        sections={[
          { value: 'general', label: s('settings.general') }, { value: 'links', label: s('settings.links') },
          { value: 'exports', label: s('settings.exports') }, { value: 'landscapes', label: s('settings.landscapes') },
        ]}
      >
        {tab === 'general' && (
          <div ref={general} className="kit-settings__field">
          <SettingsSection title={s('settings.general')}>
            <SettingsField name="name">
            <CommittedText
              key={`name:${path}`} label={s('group.name')} hint={s('settings.nameHelp')} held={target.name} readOnly={readOnly} required data-testid="settings-name"
              onCommit={(next) => apply({ name: next }, s('settings.undoName'), { name: target.name })} s={s}
            />
            </SettingsField>
            {canMove && !readOnly && (
              <SettingsField name="filedUnder">
                <ScopeField tree={tree} value={parent} onChange={(next) => { if (next !== parent) setAsked(next) }} label={s('org.filedUnder')} helperText={s('settings.filedUnderHelp')} excluding={path} s={s} />
              </SettingsField>
            )}
            <SettingsField name="type">
            <TypeField
              type={typeChoiceOf(target)} unitTypes={unitTypes} readOnly={readOnly} s={s}
              onChange={(type) => { void apply({ type }, s('settings.undoType'), { type: typeChoiceOf(target) }) }}
              // The organisation is served by no unit, so its help says nothing of Served by.
              {...(topicNext(typeChoiceOf(target)) ? { help: s('org.kindTopicMoves') } : !canMove && unitTypes.length > 0 ? { help: s('org.typeHelpUnserved') } : {})}
            />
            </SettingsField>
            {servedBy}
            <SettingsField name="description">
            <CommittedDescription
              key={`description:${path}`} held={target.description ?? ''} readOnly={readOnly} placeholder={s('group.descriptionPlaceholder')} s={s}
              onCommit={(description) => apply({ description }, s('settings.undoDescription'), { description: target.description ?? '' })}
            />
            </SettingsField>
            <PreferenceRow label={s('settings.address')} hint={s('settings.addressHelp', { path: `#/${path ? `${path}/` : ''}-/home` })}>
              {onCopyLink && <Button size="small" variant="quiet" onClick={onCopyLink} data-testid="settings-copy-link">{s('share.copy')}</Button>}
            </PreferenceRow>
            {onDelete && !readOnly && (
              <PreferenceRow label={s('settings.deleteWhat')}>
                <Button size="small" variant="danger" onClick={onDelete} data-testid="settings-delete">{s('settings.delete')}</Button>
              </PreferenceRow>
            )}
          </SettingsSection>
          </div>
        )}
        {tab === 'links' && (
          <SettingsSection title={s('settings.links')} note={s('group.linksHelp')}>
            <LinksField
              // Keyed by what is held, so an undo that puts the links back is shown.
              key={`${path}:${JSON.stringify(target.links ?? [])}`} links={target.links ?? []} readOnly={readOnly} s={s}
              onCommit={(links) => apply({ links }, s('settings.undoLinks'), { links: [...(target.links ?? [])] })}
            />
          </SettingsSection>
        )}
        {tab === 'exports' && <ExportsSection target={target} model={model} above={aboveClient?.trim() || name} readOnly={readOnly} apply={apply} s={s} />}
        {tab === 'landscapes' && <LandscapesSection path={path} model={model} readOnly={readOnly} apply={apply} s={s} />}
      </SettingsPage>
      <Dialog
        open={asked !== undefined} title={s('settings.moveTitle', { name })} onClose={() => setAsked(undefined)}
        actions={{
          cancel: { onClick: () => setAsked(undefined), label: s('common.cancel') },
          outcome: { 'data-testid': 'settings-move', onClick: () => { if (asked !== undefined) void onApply(path, { ...patchOf(target), parent: asked }); setAsked(undefined) }, label: s('settings.moveConfirm') },
        }}
      >
        <p>{s('settings.moveBody', { name, below: flattenScopes(target).length - 1 })}</p>
      </Dialog>
    </PageDialog>
  )
}

/**
 * Every field a way in names is on General: asked for one, the page goes there,
 * and the field has the focus once it is drawn, after the page's own first focus.
 * Returns the ref for General's section.
 */
function useLandOnField(field: { readonly name: string; readonly nonce: number } | undefined, onGeneral: boolean, setTab: (tab: string) => void) {
  const general = useRef<HTMLDivElement | null>(null)
  const name = field?.name
  const nonce = field?.nonce
  useEffect(() => {
    if (name === undefined) return undefined
    if (!onGeneral) { setTab('general'); return undefined }
    const frame = requestAnimationFrame(() => { if (general.current) focusSettingsField(general.current, name) })
    return () => cancelAnimationFrame(frame)
  }, [name, nonce, onGeneral, setTab])
  return general
}

type Apply = (patch: Partial<ScopeSettingsPatch>, name: string, back: Partial<ScopeSettingsPatch>) => Promise<SettingsApplied>

function ExportsSection({ target, model, above, readOnly, apply, s }: {
  target: ScopeSummary; model: ScopeSnapshot['model'] | undefined; above: string; readOnly: boolean; apply: Apply; s: Translate
}) {
  return (
    <SettingsSection title={s('settings.exports')} note={s('settings.exportsNote')}>
      <CommittedText
        key={`client:${target.path}`} label={s('group.client')} held={target.client ?? ''} readOnly={readOnly} data-testid="settings-client"
        hint={s('settings.clientFallback', { name: above })}
        onCommit={(client) => apply({ client }, s('settings.undoClient'), { client: target.client ?? '' })} s={s}
      />
      <CommittedText
        key={`author:${target.path}:${model ? 'read' : 'waiting'}`} label={s('settings.defaultAuthor')} held={model?.defaultAuthor ?? ''} readOnly={readOnly || !model} data-testid="settings-author"
        hint={s('settings.authorFallback')}
        onCommit={(defaultAuthor) => apply({ defaultAuthor }, s('settings.undoAuthor'), { defaultAuthor: model?.defaultAuthor ?? '' })} s={s}
      />
    </SettingsSection>
  )
}

function LandscapesSection({ path, model, readOnly, apply, s }: {
  path: ScopePath; model: ScopeSnapshot['model'] | undefined; readOnly: boolean; apply: Apply; s: Translate
}) {
  const held = model?.defaultAspectConfig ?? DEFAULT_ASPECT_CONFIG
  return (
    <SettingsSection title={s('settings.landscapes')} note={s('settings.defaultColumns')}>
      {model && (
        <AspectsNow
          key={`${path}:${JSON.stringify(held)}`} held={held} readOnly={readOnly} s={s}
          onCommit={(defaultAspectConfig) => apply({ defaultAspectConfig }, s('settings.undoAspects'), { defaultAspectConfig: [...held] })}
        />
      )}
    </SettingsSection>
  )
}

const LANDED: SettingsApplied = { ok: true }

/** How a field's change lands: the change. Answers whether it did, where it can. */
type Land<T> = (next: T) => void | Promise<SettingsApplied>

/**
 * A field's change, and what became of it. Refused, the field keeps what was
 * typed and says it is not kept, with the change offered again or put back;
 * either way out lets go of that refusal on the frame (`writeRefusals`), so the
 * status word is calm again exactly when nothing on screen is unkept.
 */
function useLanding<T>(land: Land<T>) {
  const refusals = useContext(WriteRefusalsContext)
  const [refused, setRefused] = useState<{ value: T; refusal?: number } | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const standing = useRef(refused)
  standing.current = refused
  const letGo = () => {
    const id = standing.current?.refusal
    if (id !== undefined) refusals?.forget(id)
  }
  const commit = async (next: T) => {
    setBusy(true)
    const answer = await Promise.resolve(land(next)) ?? LANDED
    setBusy(false)
    // A refusal made again is the one that stands now: the one before it goes either way.
    letGo()
    setRefused(answer.ok ? undefined : { value: next, ...(answer.refusal !== undefined ? { refusal: answer.refusal } : {}) })
  }
  const putBack = () => { letGo(); setRefused(undefined) }
  return {
    refused: refused !== undefined, busy,
    commit: (next: T) => { void commit(next) },
    retry: () => { if (standing.current) void commit(standing.current.value) },
    putBack,
  }
}

/** A field's landing as what draws it reads it. */
type Landing = { readonly refused: boolean; readonly busy: boolean; readonly retry: () => void; readonly putBack: () => void }

/** What a refused field says under itself, and its two ways out. */
function NotKeptUnder({ landing, onPutBack, s }: { landing: Landing; onPutBack: () => void; s: Translate }) {
  if (!landing.refused) return null
  return (
    <SettingNotKept
      said={s('settings.notKept')} tryAgain={s('common.tryAgain')} putBack={s('work.putBack')} busy={landing.busy}
      onTryAgain={landing.retry} onPutBack={() => { landing.putBack(); onPutBack() }}
    />
  )
}

/** A text box that lands as it is left, or on Enter, and goes back to what is held on Esc. */
function CommittedText({ label, hint, held, onCommit, readOnly, required, s, 'data-testid': testId }: {
  label: string; hint?: string; held: string; onCommit: Land<string>; readOnly?: boolean; required?: boolean; s: Translate; 'data-testid'?: string
}) {
  const [typed, setTyped] = useState(held)
  const landing = useLanding(onCommit)
  // What is held moved underneath, by an undo or another hand: the field follows.
  useEffect(() => setTyped(held), [held])
  const commit = () => {
    const next = typed.trim()
    if (next === held.trim()) { if (landing.refused) landing.putBack(); return }
    if (required && next.length === 0) { setTyped(held); return }
    landing.commit(next)
  }
  return (
    <>
      <TextField
        label={label} {...(hint ? { hint } : {})} value={typed} onChange={setTyped} readOnly={readOnly} data-testid={testId} onBlur={commit}
        {...(landing.refused ? { error: s('settings.notKept') } : {})}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commit() }
          // A field with something to put back claims the key; one with nothing lets it close the page.
          if (event.key === 'Escape' && typed !== held) { claimKey(event); setTyped(held); landing.putBack() }
        }}
      />
      {landing.refused && <NotKeptActs landing={landing} onPutBack={() => setTyped(held)} s={s} />}
    </>
  )
}

/** Under a field that already says it is not kept: the two ways out, without saying it twice. */
function NotKeptActs({ landing, onPutBack, s }: { landing: Landing; onPutBack: () => void; s: Translate }) {
  return (
    <div className="kit-settings__notkept-acts" data-testid="setting-not-kept">
      <Button size="small" variant="primary" disabled={landing.busy} onClick={landing.retry}>{s('common.tryAgain')}</Button>
      <Button size="small" variant="plain" disabled={landing.busy} onClick={() => { landing.putBack(); onPutBack() }}>{s('work.putBack')}</Button>
    </div>
  )
}

/** The description, in the shared editor: it lands as the person leaves the field. */
function CommittedDescription({ held, onCommit, readOnly, placeholder, s }: { held: string; onCommit: Land<string>; readOnly: boolean; placeholder: string; s: Translate }) {
  const [typed, setTyped] = useState(held)
  const landing = useLanding(onCommit)
  useEffect(() => setTyped(held), [held])
  return (
    <div onBlur={(event) => { if (focusLeaves(event) && typed.trim() !== held.trim()) landing.commit(typed.trim()) }}>
      <MarkdownField value={typed} onChange={setTyped} disabled={readOnly} renderMarkdown={renderMarkdown} placeholder={placeholder} />
      <NotKeptUnder landing={landing} onPutBack={() => setTyped(held)} s={s} />
    </div>
  )
}

/** The aspects, landing as a whole row's change settles, with their fresh keys read from what was typed. */
function AspectsNow({ held, onCommit, readOnly, s }: { held: readonly AspectConfigEntry[]; onCommit: Land<AspectConfigEntry[]>; readOnly: boolean; s: Translate }) {
  const [columns, setColumns] = useState<AspectConfigEntry[]>([...held])
  const [fresh, setFresh] = useState<string[]>([])
  const landing = useLanding(onCommit)
  const latest = useRef({ columns, fresh })
  latest.current = { columns, fresh }
  const commit = () => {
    const next = settleFreshAspectKeys(latest.current.columns, latest.current.fresh).filter((column) => column.label.trim().length > 0)
    if (JSON.stringify(next) !== JSON.stringify(held)) landing.commit(next)
  }
  if (readOnly) return <ul>{held.map((column) => <li key={column.key}>{column.label}</li>)}</ul>
  return (
    <div onBlur={(event) => { if (focusLeaves(event)) commit() }}>
      <AspectColumnsEditor columns={columns} fresh={fresh} onChange={(next, nextFresh) => { setColumns(next); setFresh(nextFresh); latest.current = { columns: next, fresh: nextFresh } }} />
      <NotKeptUnder landing={landing} onPutBack={() => { setColumns([...held]); setFresh([]) }} s={s} />
    </div>
  )
}

/**
 * Where the rest of its material lives, as links: a label and an address each,
 * flagged where the address is not one a link may carry. Flagged, not refused:
 * somebody halfway through typing an address has not made a mistake yet. What
 * cannot be rendered is dropped as it lands, by `normaliseLinks`.
 */
function LinksField({ links, onCommit, readOnly, s }: { links: readonly RecordLink[]; onCommit: Land<RecordLink[]>; readOnly: boolean; s: Translate }) {
  const [rows, setRows] = useState<RecordLink[]>(links.map((link) => ({ ...link })))
  const landing = useLanding(onCommit)
  const rowsNow = useRef(rows)
  rowsNow.current = rows
  const commit = (next: RecordLink[] = rowsNow.current) => {
    if (JSON.stringify(next) !== JSON.stringify(links)) landing.commit(next)
  }
  const edit = (index: number, patch: Partial<RecordLink>) => setRows(rows.map((link, at) => (at === index ? { ...link, ...patch } : link)))
  const leftRow = (event: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) => {
    if (focusLeaves(event)) commit()
  }
  return (
    <div className="kit-settings__section" onBlur={leftRow}>
      {rows.map((link, index) => {
        const bad = link.url.trim().length > 0 && !isSafeLinkUrl(link.url)
        return (
          <div key={index} className="kit-settings__row">
            <Field label={s('group.linkLabel')}>
              {(ties) => <TextInput {...ties} value={link.label} readOnly={readOnly} onChange={(event) => edit(index, { label: event.target.value })} />}
            </Field>
            <Field label={s('group.linkUrl')} {...(bad ? { error: s('group.badUrl') } : {})}>
              {(ties) => <TextInput {...ties} placeholder="https://" value={link.url} readOnly={readOnly} onChange={(event) => edit(index, { url: event.target.value })} />}
            </Field>
            {!readOnly && (
              <Button
                size="small" variant="quiet" aria-label={s('group.removeLink', { name: link.label || link.url })}
                onClick={() => { const next = rows.filter((_, at) => at !== index); setRows(next); commit(next) }}
              >
                {s('settings.remove')}
              </Button>
            )}
          </div>
        )
      })}
      <NotKeptUnder landing={landing} onPutBack={() => setRows(links.map((link) => ({ ...link })))} s={s} />
      {!readOnly && <div><Button size="small" onClick={() => setRows([...rows, { label: '', url: '' }])}>{s('group.addLink')}</Button></div>}
    </div>
  )
}
