// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model's page (ADR-0036 §2): the organisation's unit types and
 * roles drawn as the structure they make (amended 11 October 2026), the
 * matrix of responsibilities against roles, the rules, and the libraries to
 * start from — brought in through a dialog of their own (`LibraryDialog`),
 * opened beside *New unit type* and *New role*, first on an empty model, and
 * from each library's card.
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
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import type { RoleId, UnitType, UnitTypeId } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import { barChromeFor, NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { BackIcon } from '../../widgets/icons'
import { PageClose } from '../../widgets/PageClose'
import { SeamResizer } from '../../widgets/SeamResizer'
import { useSeamWidth } from '../../widgets/useSeamWidth'
import { PageDialog } from '../../widgets/PageDialog'
import { itemOf, removeResponsibility, removeRole, removeSlot, removeUnitType } from '../edit'
import type { OperatingItem, OperatingModel } from '../edit'
import { libraryLanguage } from '../library'
import type { Library } from '../library'
import { LIBRARIES } from '../libraries'
import { ALL_OF_THE_MATRIX } from '../matrixView'
import type { MatrixView } from '../matrixView'
import { countsLine } from './countsLine'
import { Inspector } from './Inspector'
import type { RefuseLine } from './Inspector'
import { LandedToast } from './LandedToast'
import { LibrariesPanel } from './LibrariesPanel'
import { LibraryDialog } from './LibraryDialog'
import { RaciMatrix } from './RaciMatrix'
import { RemoveConfirm } from './RemoveConfirm'
import type { RoleHolders } from './RemoveConfirm'
import { UnitsAndRoles } from './UnitsAndRoles'
import { useLibraryStep } from './useLibraryStep'
import type { LibraryStep } from './useLibraryStep'

export type OperatingTab = 'units' | 'raci' | 'libraries'

/**
 * A role taken out of a unit type (ADR-0036 §6, *when the model itself
 * changes*), where the host knows who holds it: this page knows the model
 * and nobody's name.
 */
export type SlotTakeOut = {
  /** Whether anybody holds the role in a unit of the type, through the type alone, from today on. */
  held(type: UnitType, roleId: RoleId): boolean
  /**
   * Drawn under the slots in its place, while it is being taken out: the
   * people, their moves, and the role taken out with them as one step.
   * `done` is said once it is taken out, or kept.
   */
  aside(type: UnitType, roleId: RoleId, done: () => void): ReactNode
}

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
  /**
   * What the host says beside a picked item (ADR-0036 §6): for a unit type or
   * a role that ends, the people it leaves to decide. This page knows the
   * model and nobody's name.
   */
  aside?: (item: OperatingItem) => ReactNode
  /** A role somebody holds is not taken out of a unit type at once: the host lists them first. Absent, a slot goes at once. */
  slotTakeOut?: SlotTakeOut
  /** Why a slot's solid reporting line would be refused: the host knows the organisation (ADR-0039 §5). Absent: nothing is. */
  refuseLine?: RefuseLine
  /** How many units of each type there are today, as the host counts them across the tree; each card says so where given. */
  unitCounts?: ReadonlyMap<UnitTypeId, number>
  /** Who holds a role today or later, as the host counts them: said before the role is removed. */
  roleHolders?: (roleId: RoleId) => RoleHolders
  /**
   * Asked straight after a library's step is dispatched: what takes back that
   * step, answering whether it did — which it does only while that step is
   * still the newest. Absent, the toast after a bring-in offers no *Undo*.
   */
  undoStep?: () => () => boolean
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
  const [asideWidth, setAsideWidth] = useSeamWidth('operating.aside', 340)
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [matrixView, setMatrixView] = useState<MatrixView>(ALL_OF_THE_MATRIX)
  const [removing, setRemoving] = useState<string | undefined>(undefined)
  const [takingOut, setTakingOut] = useState<{ typeId: string; roleId: RoleId } | undefined>(undefined)
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const libraries = props.libraries ?? LIBRARIES
  const fromLibrary = useLibraryStep({ pageOpen: props.open, dispatch, undoStep: props.undoStep })

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
  const select = (id: string | undefined) => { setSelected(id); setTakingOut(undefined) }
  // A slot somebody holds through the type alone waits for the host's list of them; any other goes at once.
  const removeSlotOf = (type: UnitType, index: number) => {
    const roleId = type.slots[index].role
    const left = type.slots.some((slot, at) => at !== index && slot.role === roleId)
    if (!left && props.slotTakeOut?.held(type, roleId)) {
      setTakingOut({ typeId: type.id, roleId })
      return
    }
    dispatch(removeSlot(type, index))
    if (takingOut?.typeId === type.id && takingOut.roleId === roleId) setTakingOut(undefined)
  }
  const taking = takingOut && picked?.kind === 'unitType' && picked.item.id === takingOut.typeId
    ? props.slotTakeOut?.aside(picked.item, takingOut.roleId, () => setTakingOut(undefined))
    : undefined
  // An item opened from elsewhere on the page: picked, on its own tab.
  const openItem = (id: string) => {
    const held = itemOf(model, id)
    if (!held) return
    select(id)
    setTab(tabOf(held.kind))
  }
  const toRemove = itemOf(model, removing)
  const confirmRemove = () => {
    if (!toRemove) return
    const remove = { unitType: removeUnitType, role: removeRole, responsibility: removeResponsibility }[toRemove.kind]
    dispatch(remove(model, toRemove.item.id))
    setRemoving(undefined)
    setSelected(undefined)
  }

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
        <PageClose onClose={props.onClose} />
      </Box>
      {!props.atOrganisation && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, pt: 1 }}>{t('operating.atOrganisation')}</Typography>
      )}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: 2 }}>
          {tab === 'units' && (
            <UnitsAndRoles
              model={model} readOnly={readOnly} selected={selected} onSelect={select} dispatch={dispatch} makeId={makeId}
              libraries={libraries} {...(props.unitCounts ? { unitCounts: props.unitCounts } : {})}
              empty={empty} onFromLibrary={() => fromLibrary.open()} fresh={fromLibrary.fresh}
            />
          )}
          {tab === 'raci' && (
            <RaciMatrix model={model} readOnly={readOnly} selected={selected} onSelect={select} dispatch={dispatch} makeId={makeId}
              view={matrixView} onView={setMatrixView} />
          )}
          {tab === 'libraries' && (
            <LibrariesPanel
              model={model} readOnly={readOnly} dispatch={dispatch} libraries={libraries} language={libraryLanguage(language)}
              onFromLibrary={fromLibrary.open} onOpenItem={openItem}
            />
          )}
        </Box>
        {tab !== 'libraries' && (
          <SeamResizer orientation="vertical" region="after" value={asideWidth} min={260} max={720} defaultValue={340} onChange={setAsideWidth} label={t('common.resizeColumn')} />
        )}
        {tab !== 'libraries' && (
          <Box
            component="aside" aria-label={t('operating.pick')}
            sx={{ width: asideWidth, flexShrink: 0, overflow: 'auto', p: 2, bgcolor: 'background.paper' }}
          >
            <Inspector model={model} picked={picked} readOnly={readOnly} dispatch={dispatch} onRemove={setRemoving} aside={picked && props.aside?.(picked)}
              onRemoveSlot={removeSlotOf} slotAside={taking} {...(props.refuseLine ? { refuseLine: props.refuseLine } : {})} />
          </Box>
        )}
      </Box>
      <RemoveConfirm
        item={toRemove} holders={toRemove?.kind === 'role' ? props.roleHolders?.(toRemove.item.id) : undefined}
        onCancel={() => setRemoving(undefined)} onConfirm={confirmRemove}
      />
      <FromLibrary
        step={fromLibrary} readOnly={readOnly} model={model} libraries={libraries} language={language} makeId={makeId} chrome={chrome}
        // What came in is drawn where it now stands, marked new.
        onBrought={() => setTab('units')}
      />
    </PageDialog>
  )
}

/** The dialog that brings a library in, and the toast after it. */
function FromLibrary({ step, readOnly, model, libraries, language, makeId, chrome, onBrought }: {
  step: LibraryStep; readOnly: boolean; model: OperatingModel; libraries: readonly Library[]; language: string; makeId: MakeId
  chrome: WindowChrome; onBrought(): void
}) {
  return (
    <>
      <LibraryDialog
        open={!readOnly && step.asking !== undefined} lists={model} libraries={libraries}
        {...(step.asking?.libraryId ? { libraryId: step.asking.libraryId } : {})}
        language={libraryLanguage(language)} makeId={makeId} windowChrome={chrome} onClose={step.close}
        onBring={(brought) => { step.bring(brought); onBrought() }}
      />
      <LandedToast landed={step.landed} onUndo={step.undo} onClose={step.dismiss} />
    </>
  )
}
