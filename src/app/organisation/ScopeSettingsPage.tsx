// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's settings, as one page with an address (`#/<scope>/-/settings`),
 * reached the same way from the tree, the home and row one. The same fields at
 * every level, because every scope is the same document (ADR-0012 §1).
 *
 * **Each change lands by itself, as a step**, so there is no Save and no Cancel
 * and the frame's undo takes it back. A field lands as the person leaves it.
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
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Translate } from '../../i18n'
import { AspectColumnsEditor, settleFreshAspectKeys } from '../../editor'
import { DEFAULT_ASPECT_CONFIG } from '../../model'
import type { AspectConfigEntry } from '../../model'
import { isSafeLinkUrl } from '../../projects/links'
import type { RecordLink } from '../../projects/links'
import { flattenScopes, SCOPE_KINDS } from '../../projects/scope'
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
import { Field, SelectField, TextField, TextInput } from '../../widgets/kit/Field'
import { PreferenceRow, SettingsPage, SettingsSection } from '../../widgets/kit/SettingsPage'
import { MarkdownField } from '../../documentation/ui/MarkdownField'
import { renderMarkdown } from '../../documentation/ui/renderMarkdown'
import type { ScopeSettingsPatch } from '../App'
import { ScopeField } from './ScopeField'
import { TypeField } from './TypeField'
import { SCOPE_KIND_LABEL } from './scopeKinds'

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
  onApply: (path: ScopePath, patch: ScopeSettingsPatch) => void
  /** Removal, which asks. Absent at the root. */
  onDelete?: () => void
  /** Where a link to it is made and said. */
  onCopyLink?: () => void
  /** The newest change this page can take back. */
  onUndoChange?: (undo: SettingsUndo | undefined) => void
  /** *Served by*, drawn by the screen that has the index. */
  servedBy?: ReactNode
  unitTypes?: readonly { id: string; name: string }[]
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
  open, onClose, target, document, tree, aboveClient, readOnly, onApply, onDelete, onCopyLink, onUndoChange, servedBy, unitTypes = [], s,
}: ScopeSettingsPageProps) {
  const [held, setTab] = usePlaceTab('general')
  const tab = held as SettingsTab
  const [asked, setAsked] = useState<ScopePath | undefined>(undefined)
  const steps = useRef<SettingsUndo[]>([])
  const path = target.path
  useEffect(() => { steps.current = []; onUndoChange?.(undefined) }, [path, onUndoChange])
  useEffect(() => { if (!open) onUndoChange?.(undefined) }, [open, onUndoChange])

  const apply = useCallback((patch: Partial<ScopeSettingsPatch>, name: string, back: Partial<ScopeSettingsPatch>) => {
    const whole = patchOf(target)
    onApply(path, { ...whole, ...patch })
    const undo: SettingsUndo = {
      name,
      run: () => {
        onApply(path, { ...patchOf(target), ...patch, ...back })
        steps.current.pop()
        onUndoChange?.(steps.current.at(-1))
      },
    }
    steps.current.push(undo)
    onUndoChange?.(undo)
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
          <SettingsSection title={s('settings.general')}>
            <CommittedText
              key={`name:${path}`} label={s('group.name')} hint={s('settings.nameHelp')} held={target.name} readOnly={readOnly} required data-testid="settings-name"
              onCommit={(next) => apply({ name: next }, s('settings.undoName'), { name: target.name })}
            />
            {canMove && !readOnly && (
              <ScopeField tree={tree} value={parent} onChange={(next) => { if (next !== parent) setAsked(next) }} label={s('org.filedUnder')} helperText={s('settings.filedUnderHelp')} excluding={path} s={s} />
            )}
            <TypeField
              type={typeChoiceOf(target)} unitTypes={unitTypes} readOnly={readOnly} s={s}
              onChange={(type) => apply({ type }, s('settings.undoType'), { type: typeChoiceOf(target) })}
              {...(topicNext(typeChoiceOf(target)) ? { help: s('org.kindTopicMoves') } : {})}
            />
            {servedBy}
            <CommittedDescription
              key={`description:${path}`} held={target.description ?? ''} readOnly={readOnly} placeholder={s('group.descriptionPlaceholder')}
              onCommit={(description) => apply({ description }, s('settings.undoDescription'), { description: target.description ?? '' })}
            />
            <PreferenceRow label={s('settings.address')} hint={s('settings.addressHelp', { path: `#/${path ? `${path}/` : ''}-/home` })}>
              {onCopyLink && <Button size="small" variant="quiet" onClick={onCopyLink} data-testid="settings-copy-link">{s('share.copy')}</Button>}
            </PreferenceRow>
            {onDelete && !readOnly && (
              <PreferenceRow label={s('settings.deleteWhat')}>
                <Button size="small" variant="danger" onClick={onDelete} data-testid="settings-delete">{s('settings.delete')}</Button>
              </PreferenceRow>
            )}
          </SettingsSection>
        )}
        {tab === 'links' && (
          <SettingsSection title={s('settings.links')} note={s('group.linksHelp')}>
            <LinksField
              key={path} links={target.links ?? []} readOnly={readOnly} s={s}
              onCommit={(links) => apply({ links }, s('settings.undoLinks'), { links: [...(target.links ?? [])] })}
            />
          </SettingsSection>
        )}
        {tab === 'exports' && <ExportsSection target={target} model={model} above={aboveClient?.trim() || name} readOnly={readOnly} apply={apply} s={s} />}
        {tab === 'landscapes' && <LandscapesSection path={path} model={model} readOnly={readOnly} apply={apply} s={s} />}
      </SettingsPage>
      <Dialog
        open={asked !== undefined} title={s('settings.moveTitle', { name })} onClose={() => setAsked(undefined)}
        actions={(
          <>
            <Button onClick={() => setAsked(undefined)}>{s('common.cancel')}</Button>
            <Button
              variant="primary" data-testid="settings-move"
              onClick={() => { if (asked !== undefined) onApply(path, { ...patchOf(target), parent: asked }); setAsked(undefined) }}
            >
              {s('settings.moveConfirm')}
            </Button>
          </>
        )}
      >
        <p>{s('settings.moveBody', { name, below: flattenScopes(target).length - 1 })}</p>
      </Dialog>
    </PageDialog>
  )
}

type Apply = (patch: Partial<ScopeSettingsPatch>, name: string, back: Partial<ScopeSettingsPatch>) => void

function ExportsSection({ target, model, above, readOnly, apply, s }: {
  target: ScopeSummary; model: ScopeSnapshot['model'] | undefined; above: string; readOnly: boolean; apply: Apply; s: Translate
}) {
  return (
    <SettingsSection title={s('settings.exports')} note={s('settings.exportsNote')}>
      <CommittedText
        key={`client:${target.path}`} label={s('group.client')} held={target.client ?? ''} readOnly={readOnly} data-testid="settings-client"
        hint={s('settings.clientFallback', { name: above })}
        onCommit={(client) => apply({ client }, s('settings.undoClient'), { client: target.client ?? '' })}
      />
      <CommittedText
        key={`author:${target.path}:${model ? 'read' : 'waiting'}`} label={s('settings.defaultAuthor')} held={model?.defaultAuthor ?? ''} readOnly={readOnly || !model} data-testid="settings-author"
        hint={s('settings.authorFallback')}
        onCommit={(defaultAuthor) => apply({ defaultAuthor }, s('settings.undoAuthor'), { defaultAuthor: model?.defaultAuthor ?? '' })}
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
          key={path} held={held} readOnly={readOnly}
          onCommit={(defaultAspectConfig) => apply({ defaultAspectConfig }, s('settings.undoAspects'), { defaultAspectConfig: [...held] })}
        />
      )}
    </SettingsSection>
  )
}

/** A text box that lands as it is left, or on Enter, and goes back to what is held on Esc. */
function CommittedText({ label, hint, held, onCommit, readOnly, required, 'data-testid': testId }: {
  label: string; hint?: string; held: string; onCommit: (next: string) => void; readOnly?: boolean; required?: boolean; 'data-testid'?: string
}) {
  const [typed, setTyped] = useState(held)
  // What is held moved underneath, by an undo or another hand: the field follows.
  useEffect(() => setTyped(held), [held])
  const commit = () => {
    const next = typed.trim()
    if (next === held.trim()) return
    if (required && next.length === 0) { setTyped(held); return }
    onCommit(next)
  }
  return (
    <TextField
      label={label} {...(hint ? { hint } : {})} value={typed} onChange={setTyped} readOnly={readOnly} data-testid={testId} onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); commit() }
        if (event.key === 'Escape') setTyped(held)
      }}
    />
  )
}

/** The description, in the shared editor: it lands as the person leaves the field. */
function CommittedDescription({ held, onCommit, readOnly, placeholder }: { held: string; onCommit: (next: string) => void; readOnly: boolean; placeholder: string }) {
  const [typed, setTyped] = useState(held)
  useEffect(() => setTyped(held), [held])
  return (
    <div onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && typed.trim() !== held.trim()) onCommit(typed.trim()) }}>
      <MarkdownField value={typed} onChange={setTyped} disabled={readOnly} renderMarkdown={renderMarkdown} placeholder={placeholder} />
    </div>
  )
}

/** The aspects, landing as a whole row's change settles, with their fresh keys read from what was typed. */
function AspectsNow({ held, onCommit, readOnly }: { held: readonly AspectConfigEntry[]; onCommit: (next: AspectConfigEntry[]) => void; readOnly: boolean }) {
  const [columns, setColumns] = useState<AspectConfigEntry[]>([...held])
  const [fresh, setFresh] = useState<string[]>([])
  const latest = useRef({ columns, fresh })
  latest.current = { columns, fresh }
  const commit = () => {
    const next = settleFreshAspectKeys(latest.current.columns, latest.current.fresh).filter((column) => column.label.trim().length > 0)
    if (JSON.stringify(next) !== JSON.stringify(held)) onCommit(next)
  }
  if (readOnly) return <ul>{held.map((column) => <li key={column.key}>{column.label}</li>)}</ul>
  return (
    <div onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) commit() }}>
      <AspectColumnsEditor columns={columns} fresh={fresh} onChange={(next, nextFresh) => { setColumns(next); setFresh(nextFresh); latest.current = { columns: next, fresh: nextFresh } }} />
    </div>
  )
}

/**
 * Where the rest of its material lives, as links: a label and an address each,
 * flagged where the address is not one a link may carry. Flagged, not refused:
 * somebody halfway through typing an address has not made a mistake yet. What
 * cannot be rendered is dropped as it lands, by `normaliseLinks`.
 */
function LinksField({ links, onCommit, readOnly, s }: { links: readonly RecordLink[]; onCommit: (links: RecordLink[]) => void; readOnly: boolean; s: Translate }) {
  const [rows, setRows] = useState<RecordLink[]>(links.map((link) => ({ ...link })))
  const rowsNow = useRef(rows)
  rowsNow.current = rows
  const commit = (next: RecordLink[] = rowsNow.current) => {
    if (JSON.stringify(next) !== JSON.stringify(links)) onCommit(next)
  }
  const edit = (index: number, patch: Partial<RecordLink>) => setRows(rows.map((link, at) => (at === index ? { ...link, ...patch } : link)))
  const leftRow = (event: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commit()
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
      {!readOnly && <div><Button size="small" onClick={() => setRows([...rows, { label: '', url: '' }])}>{s('group.addLink')}</Button></div>}
    </div>
  )
}
