// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope, edited from the screen it appears on.
 *
 * The same dialog at every level, because every scope is the same document
 * (ADR-0012 §1): the organisation at the root, a domain under it, a landscape
 * under that. What it edits is what a scope says about itself — its name, who
 * its drawings are made out to, what it is, and where the rest of its material
 * lives.
 *
 * **Renaming is not moving.** `acme/rail` is how everything under it is filed
 * and how the last-opened preference points at one; renaming relabels and
 * leaves the address alone. Moving is the separate question *filed under*,
 * which changes the address of this scope and of everything beneath it — save
 * there, remove here, which is the caller's to perform for the same reason a
 * save is.
 *
 * A scope may not be filed under itself or under one of its own descendants,
 * so the field excludes its own subtree; the root has no field at all, because
 * the root is where the tree is and there is nowhere above it.
 *
 * The dialog says what it wants; the caller performs it, because a save is a
 * store operation and not a field edit.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { FieldLabel, FieldsDialog, SectionHeading } from '../../widgets/CompactForms'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import type { StringKey, Translate } from '../../i18n'
import { isSafeLinkUrl } from '../../projects/links'
import type { RecordLink } from '../../projects/links'
import { flattenScopes, SCOPE_KINDS } from '../../projects/scope'
import { isTopic } from '../../projects/topics'
import type { ScopeKind, ScopeSummary } from '../../projects/scope'
import { parentScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { typeChoiceOf } from '../../projects/scopeType'
import type { ScopeTyped, TypeChoice } from '../../projects/scopeType'
import type { ScopeSettingsPatch } from '../App'
import { ScopeField } from './ScopeField'
import { useFreshFor } from '../../widgets/useFreshFor'

/**
 * What each kind is called. A word for this dialog to offer and never a branch
 * ({@link ScopeKind}) — the screen reads it, nothing switches on it.
 */
export const SCOPE_KIND_LABEL = {
  organisation: 'org.kindOrganisation',
  domain: 'org.kindDomain',
  programme: 'org.kindProgramme',
  team: 'org.kindTeam',
  landscape: 'org.kindLandscape',
  topic: 'org.kindTopic',
} as const satisfies Record<ScopeKind, StringKey>

/**
 * The same words, counted (`countScopeKinds`), so a home's line and its
 * tree's badges cannot come to call one scope two things. A scope that says
 * nothing about itself is counted as a scope.
 */
export const SCOPE_KIND_COUNT = {
  organisation: { one: 'org.organisationsOne', other: 'org.organisationsOther' },
  domain: { one: 'org.domainsOne', other: 'org.domainsOther' },
  programme: { one: 'org.programmesOne', other: 'org.programmesOther' },
  team: { one: 'org.teamsOne', other: 'org.teamsOther' },
  landscape: { one: 'org.landscapeScopesOne', other: 'org.landscapeScopesOther' },
  topic: { one: 'org.topicsOne', other: 'org.topicsOther' },
  unsaid: { one: 'org.scopesOne', other: 'org.scopesOther' },
} as const satisfies Record<ScopeKind | 'unsaid', { one: StringKey; other: StringKey }>

/**
 * What a scope's badge says (ADR-0036, amended 17 October 2026): its unit
 * type's name where it says one and the operating model holds it, *Unknown
 * type* where it says one the model does not, else its kind's word.
 */
export function scopeTypeLabel(scope: ScopeTyped, typeName: ((unitTypeId: string) => string | undefined) | undefined, s: Translate): string {
  if (scope.unitTypeId !== undefined) return typeName?.(scope.unitTypeId) ?? s('org.typeGoneBadge')
  return scope.kind ? s(SCOPE_KIND_LABEL[scope.kind]) : ''
}

export type ScopeSettingsDialogProps = {
  /** The scope being edited; the dialog is closed while undefined. */
  target?: ScopeSummary
  /**
   * The tree, for the *filed under* field. Absent means the question is not
   * asked — a caller with no listing to hand cannot offer a move.
   */
  tree?: ScopeSummary
  onSave: (path: ScopePath, patch: ScopeSettingsPatch) => void
  onCancel: () => void
  /**
   * *Served by* for the scope, drawn by the screen that has the index
   * (ADR-0036, amended 11 October 2026). Absent: not said here.
   */
  servedBy?: (path: ScopePath) => ReactNode
  /**
   * The operating model's unit types, offered first under *What this is*
   * (ADR-0036, amended 17 October 2026), the built-in kinds below them.
   * Absent or empty — no operating model — the kinds alone, as before.
   */
  unitTypes?: readonly { id: string; name: string }[]
  s: Translate
}

type LinkDraft = RecordLink

export function ScopeSettingsDialog({
  target, tree, onSave, onCancel, servedBy, unitTypes = [], s,
}: ScopeSettingsDialogProps) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [description, setDescription] = useState('')
  const [links, setLinks] = useState<LinkDraft[]>([])
  const [type, setType] = useState<TypeChoice>('')
  const [parent, setParent] = useState<ScopePath>(ROOT_SCOPE)

  // Reopening on a different scope must not show the previous one's values;
  // a new listing of the same scope must not take back what is typed.
  useFreshFor(target, (one) => one.path, (one) => {
    setName(one.name)
    setClient(one.client ?? '')
    setDescription(one.description ?? '')
    setLinks((one.links ?? []).map((link) => ({ ...link })))
    setType(typeChoiceOf(one))
    setParent(parentScope(one.path) ?? ROOT_SCOPE)
  })

  // The root has nowhere to go, and a listing is what the field is made of.
  const canMove = tree !== undefined && target !== undefined && target.path !== ROOT_SCOPE

  const ready = name.trim().length > 0

  return (
    <FieldsDialog open={target !== undefined} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('group.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <TextField
            autoFocus
            fullWidth
            label={s('group.name')}
            helperText={s('group.nameHelp', { path: target?.path || '/' })}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            fullWidth
            label={s('group.client')}
            placeholder={name.trim() || undefined}
            helperText={s('group.clientHelp')}
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={s('group.description')}
            placeholder={s('group.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <TypeField type={type} unitTypes={unitTypes} onChange={setType} s={s} {...(becomesTopic(type, target, tree) ? { help: s('org.kindTopicMoves') } : {})} />
          {canMove && (
            <ScopeField
              tree={tree}
              value={parent}
              onChange={setParent}
              label={s('org.filedUnder')}
              helperText={s('org.filedUnderHelp')}
              excluding={target.path}
              s={s}
            />
          )}

          <LinksField links={links} onChange={setLinks} s={s} />
          {/* Who serves it: a link kept on each unit, written where the unit is,
              as it is picked — not with Save, which writes this scope. */}
          {target && servedBy?.(target.path)}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={!ready}
          onClick={() => {
            if (!target) return
            // A patch and not a record: a scope also holds a model, decisions
            // and plans this dialog does not show, and the caller reads the
            // scope and writes these fields onto it rather than over it.
            onSave(target.path, {
              name,
              client,
              description,
              links,
              type,
              ...(canMove && parent !== (parentScope(target.path) ?? ROOT_SCOPE)
                ? { parent }
                : {}),
            })
          }}
        >
          {s('settings.save')}
        </Button>
      </DialogActions>
    </FieldsDialog>
  )
}

/**
 * *What this is*: one list, the operating model's unit types first under
 * their own heading where there are any, the built-in kinds under theirs
 * below, still allowed; the kinds alone where the organisation has no
 * operating model (ADR-0036, amended 17 October 2026). A unit type the scope
 * says and the model no longer holds is listed once so the field can show it.
 */
const HEADING = { fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'text.secondary', minHeight: 0, py: 0.5, '&.Mui-disabled': { opacity: 1 } } as const

/** Said a topic and not one yet: saving files it under the topics place (ADR-0042 §2), which the field says. */
function becomesTopic(type: TypeChoice, target: ScopeSummary | undefined, tree: ScopeSummary | undefined): boolean {
  return type === 'kind:topic' && target !== undefined && target.kind !== 'topic' && !isTopic(target.path, tree ? flattenScopes(tree) : [])
}

function TypeField({ type, unitTypes, onChange, help, s }: {
  type: TypeChoice; unitTypes: readonly { id: string; name: string }[]; onChange: (type: TypeChoice) => void; help?: string; s: Translate
}) {
  const grouped = unitTypes.length > 0
  const gone = type.startsWith('unit:') && !unitTypes.some((one) => `unit:${one.id}` === type)
  return (
    <TextField
      select
      fullWidth
      label={s('org.kind')}
      helperText={help ?? s(grouped ? 'org.typeHelp' : 'org.kindHelp')}
      value={type}
      onChange={(e) => onChange(e.target.value as TypeChoice)}
      slotProps={{ select: { 'data-testid': 'scope-type-field' } as object }}
    >
      <MenuItem value="">{s('org.kindNone')}</MenuItem>
      {/* Headings, not choices: a Select makes every child an option, so each is one that cannot be picked. */}
      {grouped && <MenuItem disabled sx={HEADING}>{s('org.typeFromModel')}</MenuItem>}
      {unitTypes.map((one) => (
        <MenuItem key={one.id} value={`unit:${one.id}`}>{one.name}</MenuItem>
      ))}
      {gone && <MenuItem value={type}>{s('org.typeGoneBadge')}</MenuItem>}
      {grouped && <MenuItem disabled sx={HEADING}>{s('org.typeBuiltIn')}</MenuItem>}
      {SCOPE_KINDS.map((one) => (
        <MenuItem key={one} value={`kind:${one}`}>{s(SCOPE_KIND_LABEL[one])}</MenuItem>
      ))}
    </TextField>
  )
}

/**
 * Where the rest of its material lives, as links: a label and an address
 * each, flagged where the address is not one a link may carry.
 */
function LinksField({ links, onChange, s }: { links: LinkDraft[]; onChange: (links: LinkDraft[]) => void; s: Translate }) {
  const editLink = (index: number, patch: Partial<LinkDraft>) =>
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)))
  return (
    <Box>
      <SectionHeading>{s('group.links')}</SectionHeading>
      <FieldLabel sx={{ mb: 1 }}>{s('group.linksHelp')}</FieldLabel>
      <Stack spacing={1}>
        {links.map((link, index) => {
          // Flagged, not refused: somebody halfway through typing an
          // address has not made a mistake yet. What cannot be rendered is
          // dropped on save, by `normaliseLinks`.
          const bad = link.url.trim().length > 0 && !isSafeLinkUrl(link.url)
          return (
            <Stack key={index} direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
              <TextField
                label={index === 0 ? s('group.linkLabel') : undefined}
                value={link.label}
                sx={{ width: 160 }}
                onChange={(e) => editLink(index, { label: e.target.value })}
              />
              <TextField
                label={index === 0 ? s('group.linkUrl') : undefined}
                placeholder="https://"
                value={link.url}
                error={bad}
                helperText={bad ? s('group.badUrl') : undefined}
                sx={{ flex: 1 }}
                onChange={(e) => editLink(index, { url: e.target.value })}
              />
              <Tooltip title={s('group.removeLink', { name: link.label || link.url })}>
                <IconButton
                  size="small"
                  aria-label={s('group.removeLink', { name: link.label || link.url })}
                  onClick={() => onChange(links.filter((_, i) => i !== index))}
                  sx={{ mt: index === 0 ? 1 : 0 }}
                >
                  ✕
                </IconButton>
              </Tooltip>
            </Stack>
          )
        })}
      </Stack>
      <Button
        size="small"
        sx={{ mt: 1 }}
        onClick={() => onChange([...links, { label: '', url: '' }])}
      >
        {s('group.addLink')}
      </Button>
    </Box>
  )
}
