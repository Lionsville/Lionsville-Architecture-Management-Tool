// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model's page (ADR-0036 §2): the organisation's unit types and
 * roles as cards, the matrix of responsibilities against roles, the rules, and
 * the libraries to start from.
 *
 * It is kept at the organisation and edited there only: opened over any other
 * scope it reads, and says where it is edited. Every change is a command
 * through the session it is handed, so each is a step — in the Activity list,
 * under ⌘Z and in the history of the item it touched.
 *
 * A fullscreen page, and it takes `windowChrome` for the reason every page
 * does: the shell toolbar's drag strip stays live underneath.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import { useStrings } from '../../i18n'
import { barChromeFor, NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { BackIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'
import { itemOf, removeResponsibility, removeRole, removeUnitType } from '../edit'
import type { OperatingModel } from '../edit'
import type { Library } from '../library'
import { LIBRARIES } from '../libraries'
import { countsLine } from './countsLine'
import { Inspector } from './Inspector'
import { LibrariesPanel } from './LibrariesPanel'
import { RaciMatrix } from './RaciMatrix'
import { UnitsAndRoles } from './UnitsAndRoles'

export type OperatingTab = 'units' | 'raci' | 'libraries'

export type OperatingModelPageProps = {
  open: boolean
  model: OperatingModel
  /** Nothing can be changed: a scope that is only read, or the page over a scope that is not the organisation. */
  readOnly: boolean
  /** The organisation is the scope open; anywhere else the page reads and says where it is edited. */
  atOrganisation: boolean
  makeId: MakeId
  dispatch(command: Command): void
  /** An item to open on, with the number of the request that asked (ADR-0019). */
  initialId?: string
  initialNonce?: number
  onClose(): void
  windowChrome?: WindowChrome
  /** The libraries offered; the ones that ship where not said. */
  libraries?: readonly Library[]
}

/** Which tab an item is edited on. */
function tabOf(kind: 'unitType' | 'role' | 'responsibility'): OperatingTab {
  return kind === 'responsibility' ? 'raci' : 'units'
}

export function OperatingModelPage(props: OperatingModelPageProps) {
  const { model, dispatch, makeId, initialId, initialNonce } = props
  const { t, language } = useStrings()
  const readOnly = props.readOnly || !props.atOrganisation
  const [tab, setTab] = useState<OperatingTab>('units')
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [removing, setRemoving] = useState<string | undefined>(undefined)
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)

  // A request for an item — from search, a link or an agent — opens it on its
  // tab, once per request. The model is read for the item's kind and not
  // watched: a later edit is not a new request.
  const latest = useRef(model)
  latest.current = model
  useEffect(() => {
    const asked = itemOf(latest.current, initialId)
    if (!asked) return
    setSelected(asked.item.id)
    setTab(tabOf(asked.kind))
  }, [initialId, initialNonce])

  const picked = useMemo(() => itemOf(model, selected), [model, selected])
  const empty = model.unitTypes.length === 0 && model.roles.length === 0 && model.responsibilities.length === 0
  const select = (id: string | undefined) => setSelected(id)
  const toRemove = itemOf(model, removing)
  const confirmRemove = () => {
    if (!toRemove) return
    const remove = { unitType: removeUnitType, role: removeRole, responsibility: removeResponsibility }[toRemove.kind]
    dispatch(remove(model, toRemove.item.id))
    setRemoving(undefined)
    setSelected(undefined)
  }
  const removeKey = toRemove ? ({ unitType: 'operating.removeUnitType', role: 'operating.removeRole', responsibility: 'operating.removeResponsibility' } as const)[toRemove.kind] : undefined

  return (
    <PageDialog open={props.open} topInset={chrome.topInset} onClose={props.onClose} aria-label={t('operating.title')}>
      <Box
        sx={{
          display: 'flex', flexWrap: 'wrap', rowGap: 0.5, alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Tooltip title={t('operating.close')}>
          <IconButton size="small" aria-label={t('operating.close')} onClick={props.onClose}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Typography component="h1" sx={{ fontSize: 13, fontWeight: 700 }}>{t('operating.title')}</Typography>
        <Tabs value={tab} onChange={(_event, next: OperatingTab) => setTab(next)} sx={{ minHeight: 36, ml: 1 }} aria-label={t('operating.title')}>
          <Tab value="units" label={t('operating.tabUnits')} data-guide="operating.tabUnits" sx={{ minHeight: 36, textTransform: 'none' }} />
          <Tab value="raci" label={t('operating.tabRaci')} data-guide="operating.tabRaci" sx={{ minHeight: 36, textTransform: 'none' }} />
          <Tab value="libraries" label={t('operating.tabLibraries')} data-guide="operating.tabLibraries" sx={{ minHeight: 36, textTransform: 'none' }} />
        </Tabs>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary" data-testid="operating-counts">
          {countsLine(t, model.unitTypes.length, model.roles.length, model.responsibilities.length)}
        </Typography>
      </Box>
      {!props.atOrganisation && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, pt: 1 }}>{t('operating.atOrganisation')}</Typography>
      )}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: 2 }}>
          {tab === 'units' && (
            <UnitsAndRoles
              model={model} readOnly={readOnly} selected={selected} onSelect={select} dispatch={dispatch} makeId={makeId}
              {...(empty ? { onOpenLibraries: () => setTab('libraries') } : {})}
            />
          )}
          {tab === 'raci' && (
            <RaciMatrix model={model} readOnly={readOnly} selected={selected} onSelect={select} dispatch={dispatch} makeId={makeId} />
          )}
          {tab === 'libraries' && (
            <LibrariesPanel
              model={model} readOnly={readOnly} dispatch={dispatch} makeId={makeId}
              libraries={props.libraries ?? LIBRARIES} language={language}
            />
          )}
        </Box>
        {tab !== 'libraries' && (
          <Box
            component="aside" aria-label={t('operating.pick')}
            sx={{ width: 340, flexShrink: 0, borderLeft: 1, borderColor: 'divider', overflow: 'auto', p: 2, bgcolor: 'background.paper' }}
          >
            <Inspector model={model} picked={picked} readOnly={readOnly} dispatch={dispatch} onRemove={setRemoving} />
          </Box>
        )}
      </Box>
      <ConfirmDialog
        open={toRemove !== undefined}
        title={t('operating.remove')}
        body={removeKey && toRemove ? t(removeKey, { name: toRemove.item.name }) : ''}
        confirmLabel={t('operating.removeConfirm')}
        cancelLabel={t('operating.cancel')}
        onCancel={() => setRemoving(undefined)}
        onConfirm={confirmRemove}
      />
    </PageDialog>
  )
}
