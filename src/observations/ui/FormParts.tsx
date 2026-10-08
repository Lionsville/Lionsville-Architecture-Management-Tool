// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pieces the observation, cause and solution forms share (ADR-0032 §6),
 * and the readers' edit mode with them.
 *
 * **An example under every field**, replaced by what is missing when the form
 * is refused: the field says what it wants before anybody gets it wrong, and
 * says what is wrong in the same place afterwards.
 *
 * **The body with Edit and Preview** in the same place: the markdown source,
 * or what it will read as, rendered by the page's own renderer — the one the
 * documentation uses — with the documentation's markdown help beside it.
 *
 * **A table of links, made on submit**: each row new or existing, with its
 * strength, and taken off again with the button at its end. Nothing in it
 * exists until the form is recorded.
 */
import { useId, useState, type ReactNode, type Ref } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { MarkdownHelp } from '../../documentation/ui/MarkdownHelp'
import { CloseIcon, LinkIcon } from '../../widgets/icons'
import { CAUSE_STRENGTHS } from '../observation'
import type { CauseStrength } from '../observation'
import type { CauseDraft } from '../form'
import { STRENGTH_LABEL } from '../observationScope'

/** A field with an example under it, or what is missing where it was refused. */
export function ExampleField(props: {
  label: string
  value: string
  onChange: (value: string) => void
  example: string
  /** What is wrong, in place of the example; absent where nothing is. */
  problem?: string
  required?: boolean
  type?: 'date'
  max?: string
  autoFocus?: boolean
  /** The input itself, for a dialog that puts focus on it once it has opened. */
  inputRef?: Ref<HTMLInputElement>
  testId?: string
  onBlur?: () => void
  onEnter?: () => void
  select?: boolean
  children?: ReactNode
}) {
  return (
    <TextField
      size="small"
      fullWidth
      select={props.select}
      type={props.type}
      required={props.required}
      autoFocus={props.autoFocus}
      inputRef={props.inputRef}
      label={props.label}
      value={props.value}
      error={props.problem !== undefined}
      helperText={props.problem ?? props.example}
      onChange={(event) => props.onChange(event.target.value)}
      onBlur={props.onBlur}
      onKeyDown={props.onEnter ? (event) => { if (event.key === 'Enter') { event.preventDefault(); props.onEnter?.() } } : undefined}
      slotProps={{
        ...(props.type === 'date' ? { inputLabel: { shrink: true } } : {}),
        htmlInput: {
          autoComplete: 'off',
          ...(props.max ? { max: props.max } : {}),
          ...(props.testId ? { 'data-testid': props.testId } : {}),
          ...(props.select ? { 'aria-label': props.label } : {}),
        },
      }}
    >
      {props.children}
    </TextField>
  )
}

/** A record's title in its reader's edit mode: an example under it, and what is wrong while it is blank. */
export function TitleField({ label, value, onChange, onBlur, example, missing }: {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  example: string
  /** What stands in the example's place while the title is blank. */
  missing: string
}) {
  return (
    <ExampleField
      required label={label} value={value} onChange={onChange} onBlur={onBlur}
      example={example} problem={value.trim() ? undefined : missing}
    />
  )
}

/** The optional body: the markdown source, or what it reads as, in the same place. */
export function DescriptionField({ label, value, onChange, example, renderMarkdown, s, minRows = 10 }: {
  label: string
  value: string
  onChange: (value: string) => void
  example: string
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  s: Translate
  minRows?: number
}) {
  const [preview, setPreview] = useState(false)
  const id = useId()
  return (
    <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography component="label" htmlFor={preview ? undefined : id} variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <MarkdownHelp />
          <ToggleButtonGroup
            exclusive size="small" value={preview ? 'preview' : 'edit'}
            onChange={(_event, next: 'edit' | 'preview' | null) => { if (next) setPreview(next === 'preview') }}
            aria-label={s('observation.formDescriptionMode')}
            data-guide="observationForm.description"
          >
            <ToggleButton value="edit" sx={{ py: 0.25, px: 1.25, textTransform: 'none' }}>{s('observation.formEdit')}</ToggleButton>
            <ToggleButton value="preview" sx={{ py: 0.25, px: 1.25, textTransform: 'none' }}>{s('observation.formPreview')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      {preview ? (
        <Box data-testid="form-preview" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1, minHeight: minRows * 21, bgcolor: 'background.default', fontSize: 14, overflow: 'auto' }}>
          {value.trim() ? renderMarkdown(value) : <Typography color="text.secondary">{s('observation.formNothingWritten')}</Typography>}
        </Box>
      ) : (
        <TextField
          id={id}
          multiline
          fullWidth
          minRows={minRows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'form-description', spellCheck: true } }}
          sx={{ '& textarea': { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 } }}
        />
      )}
      <Typography variant="caption" color="text.secondary">{example}</Typography>
    </Box>
  )
}

/** One of a new observation's three questions, as the form asks it. */
export type SectionInput = {
  key: string
  label: string
  value: string
  onChange: (value: string) => void
  example: string
  /** What is wrong, in place of the example; absent where nothing is. */
  problem?: string
  required?: boolean
}

/**
 * The body asked as its sections, a field each, under one Edit and Preview:
 * the preview is the markdown they make together, as it will be recorded.
 */
export function SectionsField({ label, sections, body, renderMarkdown, s }: {
  label: string
  sections: readonly SectionInput[]
  /** The markdown the sections make. */
  body: string
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  s: Translate
}) {
  const [preview, setPreview] = useState(false)
  return (
    <Box sx={{ display: 'grid', gap: 1, minWidth: 0, alignContent: 'start' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <MarkdownHelp />
          <ToggleButtonGroup
            exclusive size="small" value={preview ? 'preview' : 'edit'}
            onChange={(_event, next: 'edit' | 'preview' | null) => { if (next) setPreview(next === 'preview') }}
            aria-label={s('observation.formDescriptionMode')}
            data-guide="observationForm.description"
          >
            <ToggleButton value="edit" sx={{ py: 0.25, px: 1.25, textTransform: 'none' }}>{s('observation.formEdit')}</ToggleButton>
            <ToggleButton value="preview" sx={{ py: 0.25, px: 1.25, textTransform: 'none' }}>{s('observation.formPreview')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      {preview ? (
        <Box data-testid="form-preview" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1, minHeight: 210, bgcolor: 'background.default', fontSize: 14, overflow: 'auto' }}>
          {renderMarkdown(body)}
        </Box>
      ) : sections.map((one) => (
        <TextField
          key={one.key}
          multiline
          fullWidth
          size="small"
          minRows={3}
          required={one.required}
          label={one.label}
          value={one.value}
          error={one.problem !== undefined}
          helperText={one.problem ?? one.example}
          onChange={(event) => one.onChange(event.target.value)}
          slotProps={{ htmlInput: { 'data-testid': `form-${one.key}`, spellCheck: true } }}
          sx={{ '& textarea': { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 } }}
        />
      ))}
    </Box>
  )
}

/** How strongly a cause explains what it is linked to. */
export function StrengthSelect({ value, onChange, label, helperText, compact, s }: {
  value: CauseStrength
  onChange: (strength: CauseStrength) => void
  label: string
  helperText?: string
  compact?: boolean
  s: Translate
}) {
  return (
    <TextField
      select size="small" fullWidth={!compact} label={compact ? undefined : label} value={value}
      helperText={helperText}
      onChange={(event) => onChange(event.target.value as CauseStrength)}
      slotProps={{ htmlInput: { 'aria-label': label } }}
      sx={compact ? { minWidth: 110 } : undefined}
    >
      {CAUSE_STRENGTHS.map((one) => <MenuItem key={one} value={one}>{s(STRENGTH_LABEL[one])}</MenuItem>)}
    </TextField>
  )
}

/** Records that look like the one being written, each with a way to use it instead. */
export function LookAlikes({ title, rows, action, testId }: {
  title: string
  rows: readonly { id: string; label: string; note?: string; onUse: () => void; tip: string }[]
  action: { label: string; icon: ReactNode }
  testId: string
}) {
  if (rows.length === 0) return null
  return (
    <Box data-testid={testId} sx={{ border: 1, borderColor: 'primary.main', bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 1, display: 'grid', gap: 0.75, fontSize: 13 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{title}</Typography>
      {rows.map((row) => (
        <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
            {row.label}{row.note ? <Box component="span" sx={{ color: 'text.secondary' }}> · {row.note}</Box> : null}
          </Box>
          <Tooltip title={row.tip} describeChild>
            <Button size="small" variant="outlined" startIcon={action.icon} onClick={row.onUse} sx={{ textTransform: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {action.label}
            </Button>
          </Tooltip>
        </Box>
      ))}
    </Box>
  )
}

/** A cause's own fields, written in place: title, why, whether it is a root, and how strongly it explains. */
export function CauseDraftFields({ draft, onChange, problem, rootFixed, noRoot, alike, s, autoFocus }: {
  draft: CauseDraft
  onChange: (draft: CauseDraft) => void
  problem?: string
  /** A root cause and nothing else: the mode asked for one. */
  rootFixed?: boolean
  /** No root to be had here. */
  noRoot?: boolean
  alike?: ReactNode
  s: Translate
  autoFocus?: boolean
}) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <ExampleField
        required autoFocus={autoFocus} label={s('observation.titleField')} value={draft.title}
        onChange={(title) => onChange({ ...draft, title })}
        example={s('observation.causeTitleExample')} problem={problem} testId="cause-draft-title"
      />
      {alike}
      <ExampleField
        label={s('observation.causeWhy')} value={draft.why} onChange={(why) => onChange({ ...draft, why })}
        example={s('observation.causeWhyExample')} testId="cause-draft-why"
      />
      {!noRoot && (
        <FormControlLabel
          control={<Checkbox size="small" checked={rootFixed || draft.root} disabled={rootFixed} onChange={(event) => onChange({ ...draft, root: event.target.checked })} />}
          label={<Typography sx={{ fontSize: 14 }}>{s('observation.causeRoot')}</Typography>}
        />
      )}
      <StrengthSelect
        value={draft.strength} onChange={(strength) => onChange({ ...draft, strength })}
        label={s('observation.causeStrength')} helperText={s('observation.causeStrengthExample')} s={s}
      />
    </Box>
  )
}

/** A cause already written down, found by its number or its words, and added to the form's list. */
export function CausePicker({ candidates, taken, onPick, s, heading, onClose }: {
  candidates: readonly { id: string; label: string; root: boolean }[]
  taken: ReadonlySet<string>
  onPick: (id: string) => void
  s: Translate
  heading: string
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = candidates.filter((one) => !q || one.label.toLowerCase().includes(q))
  return (
    <SubPanel heading={heading} onClose={onClose} closeLabel={s('common.close')} testId="cause-picker">
      <TextField
        autoFocus size="small" fullWidth placeholder={s('observation.causeFind')} value={query}
        onChange={(event) => setQuery(event.target.value)}
        slotProps={{ htmlInput: { 'aria-label': s('observation.causeFind') } }}
      />
      <Box sx={{ maxHeight: 190, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', mt: 0.75 }}>
        {shown.length === 0 && <Typography sx={{ px: 1.25, py: 0.75, fontSize: 13, color: 'text.secondary' }}>{s('observation.causeNoMatch')}</Typography>}
        {shown.map((one) => (
          <Box key={one.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, fontSize: 13 }}>
            <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{one.label}</Box>
            {one.root && <Chip size="small" variant="outlined" color="secondary" label={s('observation.formKindRoot')} sx={{ height: 18, fontSize: 10 }} />}
            <Button
              size="small" variant="outlined" disabled={taken.has(one.id)} onClick={() => onPick(one.id)}
              startIcon={<LinkIcon size={14} />} sx={{ textTransform: 'none' }}
              aria-label={`${taken.has(one.id) ? s('observation.causeAdded') : s('observation.causeAdd')} ${one.label}`}
            >
              {taken.has(one.id) ? s('observation.causeAdded') : s('observation.causeAdd')}
            </Button>
          </Box>
        ))}
      </Box>
    </SubPanel>
  )
}

/** A panel opened in place under a table, with its own way to close. */
export function SubPanel({ heading, onClose, closeLabel, children, testId }: {
  heading: string
  onClose: () => void
  closeLabel: string
  children: ReactNode
  testId?: string
}) {
  return (
    <Box data-testid={testId} sx={{ mt: 1.25, border: 1, borderColor: 'primary.main', borderRadius: 1.5, px: 1.75, py: 1.5, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{heading}</Typography>
        <Tooltip title={closeLabel}>
          <IconButton size="small" aria-label={closeLabel} onClick={onClose}><CloseIcon size={14} /></IconButton>
        </Tooltip>
      </Box>
      {children}
    </Box>
  )
}

/** One row of a form's links: what it names, whether it is new, and how strongly. */
export type LinkRow = {
  key: string
  label: string
  kind: 'new' | 'existing'
  root: boolean
  strength: CauseStrength
  /** A row the form made and will not take off: what a new cause explains. */
  fixed?: boolean
  /** A word before the label, where rows mean different things: *Explains*, *Behind it*. */
  role?: string
}

export function LinkRowsTable({ rows, onStrength, onRemove, empty, s, testId, guide }: {
  rows: readonly LinkRow[]
  onStrength: (key: string, strength: CauseStrength) => void
  onRemove: (key: string) => void
  empty: string
  s: Translate
  testId: string
  guide?: string
}) {
  return (
    <Table size="small" data-testid={testId} data-guide={guide}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: '60%' }}>{s('observation.formColCause')}</TableCell>
          <TableCell>{s('observation.formColKind')}</TableCell>
          <TableCell>{s('observation.formColStrength')}</TableCell>
          <TableCell><Box component="span" sx={visuallyHidden}>{s('observation.formColRemove')}</Box></TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0 && (
          <TableRow><TableCell colSpan={4} sx={{ color: 'text.secondary', textAlign: 'center', py: 1.5 }}>{empty}</TableCell></TableRow>
        )}
        {rows.map((row) => (
          <TableRow key={row.key} data-testid="form-link-row">
            <TableCell>{row.role ? <Box component="span" sx={{ color: 'text.secondary' }}>{row.role}: </Box> : null}{row.label}</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              <Chip size="small" variant="outlined" color={row.kind === 'new' ? 'primary' : 'default'} label={row.kind === 'new' ? s('observation.formKindNew') : s('observation.formKindExisting')} sx={{ height: 20, fontSize: 11 }} />
              {row.root && <Chip size="small" variant="outlined" color="secondary" label={s('observation.formKindRoot')} sx={{ height: 20, fontSize: 11, ml: 0.5 }} />}
            </TableCell>
            <TableCell>
              <StrengthSelect compact value={row.strength} onChange={(strength) => onStrength(row.key, strength)} label={s('observation.formStrengthOf', { name: row.label })} s={s} />
            </TableCell>
            <TableCell sx={{ textAlign: 'right' }}>
              {!row.fixed && (
                <Tooltip title={s('observation.formRemoveRow', { name: row.label })}>
                  <IconButton size="small" aria-label={s('observation.formRemoveRow', { name: row.label })} onClick={() => onRemove(row.key)}>
                    <CloseIcon size={14} />
                  </IconButton>
                </Tooltip>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const visuallyHidden = {
  position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
} as const
