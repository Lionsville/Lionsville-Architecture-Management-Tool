/**
 * Every architecture decision in one place: the tree of where they live down
 * the left, the records of the chosen place in the middle, the one you are
 * reading on the right — a reading pane, the way a mail client is laid out.
 *
 * Three levels, two lists. The group's records arrive as their own list and go
 * back as one (`onGroupDecisionsChange`), because they are kept with the group
 * rather than with any project. The landscape's and every application's are
 * one list on the model, told apart by `applicationId`, and go back whole
 * (`onProjectDecisionsChange`) so the caller commits one model change. The
 * page never writes anywhere itself.
 *
 * A fullscreen dialog for the same two reasons as the documentation page: it
 * portals out of the editor's DOM so the canvas's shortcuts cannot reach a
 * reader, and it covers the whole window, so its top bar takes over the
 * window's two jobs — keep clear of the traffic lights, and be the surface the
 * window is dragged by.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { LanguageProvider } from '../../i18n'
import { matchesQuery } from '../../model'
import type { Language, Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import {
  adrsFor, formatAdrNumber, newAdr, nextAdrNumber, removeAdr, setAdrStatus, sortAdrs, updateAdr,
} from '../adr'
import type { Adr, AdrStatus } from '../adr'
import type { HostModel } from '../../model/fromInterchange'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import type { MakeId } from '../../model/keys'
import { NewAdrDialog, SupersedeDialog } from './AdrDialogs'
import { AdrReader } from './AdrReader'
import { STATUS_COLOR, STATUS_LABEL, appScope, projectScopeOf, scopeApplicationId } from '../adrScope'
import type { ScopeKey } from '../adrScope'

export type AdrPageProps = {
  open: boolean
  onClose: () => void
  model: HostModel
  groupName: string
  groupDecisions: readonly Adr[]
  onGroupDecisionsChange: (next: Adr[]) => void
  onProjectDecisionsChange: (next: Adr[]) => void
  /** Open straight onto this record — from the search. */
  initialAdrId?: string
  readOnly?: boolean
  s: Translate
  language: Language
  makeId: MakeId
  /** `yyyy-mm-dd`. Injected: a clock inside a component cannot be tested. */
  today: () => string
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  /** An element link in a record was followed; the page closes and the caller opens that element. */
  onOpenElement?: (elementId: string) => void
  windowChrome?: WindowChrome
}

export function AdrPage(props: AdrPageProps) {
  const {
    open, onClose, model, groupName, groupDecisions, onGroupDecisionsChange, onProjectDecisionsChange,
    initialAdrId, readOnly = false, s, today, makeId,
  } = props
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const projectDecisions = useMemo(() => model.decisions ?? [], [model.decisions])

  const [scope, setScope] = useState<ScopeKey>('landscape')
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [superseding, setSuperseding] = useState<Adr | undefined>(undefined)
  const [deleting, setDeleting] = useState<Adr | undefined>(undefined)

  // --- where things are ---------------------------------------------------------

  const applications = useMemo(
    () => model.elements.filter((e) => e.kind === 'application').sort((a, b) => a.name.localeCompare(b.name)),
    [model.elements],
  )
  const applicationIds = useMemo(() => new Set(applications.map((a) => a.id)), [applications])
  // Records filed under an application that has since left the model. They
  // are history and stay findable; hiding them would be losing them quietly.
  const orphanIds = useMemo(
    () => [...new Set(projectDecisions.map((a) => a.applicationId).filter((id): id is string => Boolean(id) && !applicationIds.has(id!)))],
    [projectDecisions, applicationIds],
  )

  const owningList = useCallback(
    (key: ScopeKey): readonly Adr[] => (key === 'group' ? groupDecisions : projectDecisions),
    [groupDecisions, projectDecisions],
  )
  const scopedList = useCallback(
    (key: ScopeKey): Adr[] => (key === 'group' ? [...groupDecisions] : adrsFor(projectDecisions, scopeApplicationId(key))),
    [groupDecisions, projectDecisions],
  )
  const scopeOfRecord = useCallback(
    (adr: Adr): ScopeKey => (groupDecisions.some((g) => g.id === adr.id) ? 'group' : projectScopeOf(adr)),
    [groupDecisions],
  )
  const commitList = useCallback((key: ScopeKey, next: Adr[]) => {
    if (key === 'group') onGroupDecisionsChange(next)
    else onProjectDecisionsChange(next)
  }, [onGroupDecisionsChange, onProjectDecisionsChange])

  const scopeLabel = (key: ScopeKey): string => {
    if (key === 'group') return groupName || s('adr.scopeGroup')
    if (key === 'landscape') return model.name || s('adr.scopeLandscape')
    const id = scopeApplicationId(key)!
    return applications.find((a) => a.id === id)?.name ?? id
  }

  // --- selection -------------------------------------------------------------------

  const allRecords = useMemo(() => [...groupDecisions, ...projectDecisions], [groupDecisions, projectDecisions])
  const selected = selectedId ? allRecords.find((a) => a.id === selectedId) : undefined

  // Each opening starts on the landscape's newest record — unless the search
  // asked for a particular one, which the effect below honours instead.
  const latestScoped = useRef(scopedList)
  latestScoped.current = scopedList
  useEffect(() => {
    if (!open || initialAdrId) return
    setScope('landscape')
    setQuery('')
    setSelectedId(sortAdrs(latestScoped.current('landscape'))[0]?.id)
  }, [open, initialAdrId])

  // Opened onto a record: stand in its scope with it selected.
  useEffect(() => {
    if (!open || !initialAdrId) return
    const target = allRecords.find((a) => a.id === initialAdrId)
    if (!target) return
    setScope(scopeOfRecord(target))
    setSelectedId(target.id)
    setQuery('')
  }, [open, initialAdrId, allRecords, scopeOfRecord])

  const trimmed = query.trim()
  const shown: { adr: Adr; scope: ScopeKey }[] = useMemo(() => {
    if (trimmed) {
      return allRecords
        .filter((adr) => matchesQuery(trimmed, [adr.title, adr.body, formatAdrNumber(adr.number), ...adr.signers.map((x) => x.name)]))
        .map((adr) => ({ adr, scope: scopeOfRecord(adr) }))
    }
    return sortAdrs(scopedList(scope)).map((adr) => ({ adr, scope }))
  }, [trimmed, allRecords, scopeOfRecord, scopedList, scope])

  const chooseScope = (key: ScopeKey) => {
    setScope(key)
    setQuery('')
    // Land on the newest record of the place you just walked into.
    setSelectedId(sortAdrs(scopedList(key))[0]?.id)
  }
  const chooseRecord = (adr: Adr, where: ScopeKey) => {
    setScope(where)
    setSelectedId(adr.id)
  }

  // --- changes ----------------------------------------------------------------------

  const create = (title: string) => {
    const list = owningList(scope)
    const fresh = newAdr({
      id: makeId('adr'), number: nextAdrNumber(list), title, date: today(), t: s,
      applicationId: scopeApplicationId(scope),
    })
    commitList(scope, [...list, fresh])
    setCreating(false)
    setQuery('')
    setSelectedId(fresh.id)
  }

  const update = (adr: Adr, patch: Partial<Pick<Adr, 'title' | 'body' | 'signers'>>) => {
    const key = scopeOfRecord(adr)
    commitList(key, updateAdr(owningList(key), adr.id, patch))
  }

  const move = (adr: Adr, next: AdrStatus) => {
    if (next === 'superseded') { setSuperseding(adr); return }
    const key = scopeOfRecord(adr)
    commitList(key, setAdrStatus(owningList(key), adr.id, next, today()))
  }

  const supersede = (adr: Adr, successorId: string) => {
    const key = scopeOfRecord(adr)
    commitList(key, setAdrStatus(owningList(key), adr.id, 'superseded', today(), { supersededBy: successorId }))
    setSuperseding(undefined)
  }

  const remove = (adr: Adr) => {
    const key = scopeOfRecord(adr)
    commitList(key, removeAdr(owningList(key), adr.id))
    setDeleting(undefined)
    if (selectedId === adr.id) setSelectedId(undefined)
  }

  const followElement = props.onOpenElement
    ? (elementId: string) => { onClose(); props.onOpenElement?.(elementId) }
    : undefined

  // --- the tree --------------------------------------------------------------------

  const count = (key: ScopeKey) => scopedList(key).length
  const node = (key: ScopeKey, label: string, note?: string, indent = 0) => (
    <ListItemButton
      key={key}
      selected={key === scope && !trimmed}
      onClick={() => chooseScope(key)}
      sx={{ py: 0.5, pl: 2 + indent * 2 }}
      data-testid={`adr-scope-${key}`}
    >
      <ListItemText
        primary={label}
        secondary={note}
        slotProps={{ primary: { noWrap: true, fontSize: 13 }, secondary: { noWrap: true, fontSize: 11 } }}
      />
      {count(key) > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{count(key)}</Typography>
      )}
    </ListItemButton>
  )

  return (
    <Dialog
      open={open}
      fullScreen
      onClose={onClose}
      aria-label={s('adr.title')}
      slotProps={{ paper: { sx: { bgcolor: 'background.default', display: 'flex', flexDirection: 'column' } } }}
    >
      <LanguageProvider language={props.language}>
        {/* ---- top bar: the window's, while this page is up ---- */}
        <Box
          data-testid="adr-topbar"
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, px: 1.5,
            pl: `${12 + chrome.controlsInset}px`,
            WebkitAppRegion: chrome.draggable ? 'drag' : undefined,
            '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
            minHeight: 48, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
          }}
        >
          <Tooltip title={s('adr.close')}>
            <IconButton size="small" aria-label={s('adr.close')} onClick={onClose}>
              <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
            </IconButton>
          </Tooltip>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {groupName} &nbsp;/&nbsp; {model.name} &nbsp;/&nbsp;
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{s('adr.title')}</Box>
          </Typography>
          <Box sx={{ flex: 1 }} />
          {!readOnly && (
            <Button size="small" variant="contained" onClick={() => setCreating(true)}>
              + {s('adr.new')}
            </Button>
          )}
        </Box>

        {/* ---- three columns ---- */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '240px 320px minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
          {/* the tree */}
          <Box component="nav" data-testid="adr-tree" sx={{ borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'auto' }}>
            <List dense disablePadding>
              <ListSubheader disableSticky sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>{s('adr.scopeGroup')}</ListSubheader>
              {node('group', groupName || s('adr.scopeGroup'), s('adr.scopeGroupNote'))}
              <ListSubheader disableSticky sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>{s('adr.scopeLandscape')}</ListSubheader>
              {node('landscape', model.name, s('adr.scopeLandscapeNote'))}
              <ListSubheader disableSticky sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>{s('adr.scopeApplications')}</ListSubheader>
              {applications.map((app) => node(appScope(app.id), app.name, app.category, 1))}
              {orphanIds.length > 0 && (
                <>
                  <ListSubheader disableSticky sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>{s('adr.scopeRemoved')}</ListSubheader>
                  {orphanIds.map((id) => node(appScope(id), id, undefined, 1))}
                </>
              )}
            </List>
          </Box>

          {/* the list */}
          <Box data-testid="adr-list" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                fullWidth
                size="small"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={s('adr.searchPlaceholder')}
                slotProps={{ htmlInput: { 'aria-label': s('adr.searchField'), autoComplete: 'off' } }}
              />
            </Box>
            <List dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
              {shown.map(({ adr, scope: where }) => (
                <ListItemButton
                  key={adr.id}
                  selected={adr.id === selectedId}
                  onClick={() => chooseRecord(adr, where)}
                  alignItems="flex-start"
                  sx={{ display: 'block', py: 1, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                      {formatAdrNumber(adr.number)}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Chip size="small" color={STATUS_COLOR[adr.status]} label={s(STATUS_LABEL[adr.status])} sx={{ height: 18, fontSize: 10 }} />
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, mt: 0.25 }}>{adr.title}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>
                    {[trimmed ? scopeLabel(where) : undefined, adr.date].filter(Boolean).join(' · ')}
                  </Typography>
                </ListItemButton>
              ))}
              {shown.length === 0 && (
                <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 2, py: 2 }}>
                  {trimmed ? s('adr.searchEmpty', { query: trimmed }) : s('adr.listEmpty')}
                </Typography>
              )}
            </List>
          </Box>

          {/* the record */}
          <Box sx={{ minHeight: 0, minWidth: 0 }}>
            {selected ? (
              <AdrReader
                key={selected.id}
                adr={selected}
                list={owningList(scopeOfRecord(selected))}
                readOnly={readOnly}
                s={s}
                today={today}
                elements={scopeOfRecord(selected) === 'group' ? [] : model.elements}
                renderMarkdown={props.renderMarkdown}
                onUpdate={(patch) => update(selected, patch)}
                onStatus={(next) => move(selected, next)}
                onDelete={() => setDeleting(selected)}
                onSelect={(id) => {
                  const target = allRecords.find((a) => a.id === id)
                  if (target) chooseRecord(target, scopeOfRecord(target))
                }}
                onElementLink={followElement}
              />
            ) : (
              <Box sx={{ p: 5, color: 'text.secondary' }}>
                <Typography>{s('adr.noneSelected')}</Typography>
              </Box>
            )}
          </Box>
        </Box>

        <NewAdrDialog open={creating} onCancel={() => setCreating(false)} onCreate={create} s={s} />
        <SupersedeDialog
          target={superseding}
          candidates={superseding ? scopedList(scopeOfRecord(superseding)).filter((a) => a.id !== superseding.id) : []}
          onCancel={() => setSuperseding(undefined)}
          onConfirm={(id) => superseding && supersede(superseding, id)}
          s={s}
        />
        <ConfirmDialog
          open={Boolean(deleting)}
          title={deleting ? s('adr.deleteTitle', { name: formatAdrNumber(deleting.number) }) : ''}
          body={s('adr.deleteBody')}
          confirmLabel={s('adr.delete')}
          cancelLabel={s('common.cancel')}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => deleting && remove(deleting)}
        />
      </LanguageProvider>
    </Dialog>
  )
}
