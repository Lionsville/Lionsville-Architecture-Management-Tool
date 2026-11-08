// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model's page (ADR-0036 §2), arranged around questions rather than
 * how the model is stored: what kinds of unit are there, who does what, who answers
 * for what, where does reality differ, and what to start from. Defaults read as
 * plain text and only an exception speaks up.
 *
 * It is kept at the organisation and edited there only: opened over any other scope
 * it reads the organisation's model in full, says so, and every control that writes
 * is gone. Every change is a command through the session it is handed, so each is a
 * step: in the Activity list, under ⌘Z and in the history of the item it touched.
 *
 * Which tab, part, unit and item are up is in the address (`usePlaceTab`,
 * `usePlaceLook`), so a person, a link and an agent reach the same screen.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import type { RoleId, UnitType, UnitTypeId } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import type { WindowChrome } from '../../platform/windowChrome'
import { Button } from '../../widgets/kit/Button'
import { claimKey, keyClaimed } from '../../widgets/kit/keys'
import { Tabs } from '../../widgets/kit/Tabs'
import { PageClose } from '../../widgets/PageClose'
import { PageDialog } from '../../widgets/PageDialog'
import { SeamResizer } from '../../widgets/SeamResizer'
import { useSeamWidth } from '../../widgets/useSeamWidth'
import { usePlaceLook, usePlaceTab } from '../../widgets/placeTab'
import { itemOf, removeResponsibility, removeRole, removeSlot, removeUnitType } from '../edit'
import type { OperatingItem, OperatingModel } from '../edit'
import { exceptionsOf } from '../exceptions'
import { libraryLanguage } from '../library'
import type { Library } from '../library'
import { LIBRARIES } from '../libraries'
import { ALL_OF_THE_MATRIX } from '../matrixView'
import type { MatrixView } from '../matrixView'
import type { OrganisationFacts, OutsideTheModel } from '../organisationFacts'
import { raciParts, readLook, writeLook } from '../raciView'
import type { RaciLook } from '../raciView'
import { ArrangePanel } from './ArrangePanel'
import { countsLine } from './countsLine'
import { ExceptionsTab } from './ExceptionsTab'
import { LandedToast } from './LandedToast'
import { LibrariesPanel } from './LibrariesPanel'
import { LibraryDialog } from './LibraryDialog'
import type { RefuseLine } from './lineChange'
import type { ReaderParts } from './ReaderParts'
import { RemoveConfirm } from './RemoveConfirm'
import type { RoleHolders } from './RemoveConfirm'
import { ResponsibilitiesTab } from './ResponsibilitiesTab'
import { RecordPanel } from './RecordPreview'
import { RolesTab } from './RolesTab'
import { StructureTab } from './StructureTab'
import { useLibraryStep } from './useLibraryStep'
import type { LibraryStep } from './useLibraryStep'
import './Operating.css'

export type OperatingTab = 'structure' | 'roles' | 'responsibilities' | 'exceptions' | 'libraries'

/**
 * A role taken out of a unit type (ADR-0036 §6, *when the model itself changes*),
 * where the host knows who holds it: this page knows the model and nobody's name.
 */
export type SlotTakeOut = {
  /** Whether anybody holds the role in a unit of the type, through the type alone, from today on. */
  held(type: UnitType, roleId: RoleId): boolean
  /** Drawn under the slots while it is being taken out: the people, their moves, and the role out with them as one step. */
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
  /** What the host says beside a picked item (ADR-0036 §6): for one that ends, the people it leaves to decide. */
  aside?: (item: OperatingItem) => ReactNode
  /** A role somebody holds is not taken out of a unit type at once: the host lists them first. Absent, a slot goes at once. */
  slotTakeOut?: SlotTakeOut
  /** Why a slot's solid reporting line would be refused: the host knows the organisation (ADR-0039 §5). Absent: nothing is. */
  refuseLine?: RefuseLine
  /** How many units of each type there are today, as the host counts them across the tree; each card says so where given. */
  unitCounts?: ReadonlyMap<UnitTypeId, number>
  /** Who holds a role today or later, as the host counts them: said before the role is removed. */
  roleHolders?: (roleId: RoleId) => RoleHolders
  /** Asked straight after a library's step is dispatched: what takes back that step, answering whether it did. */
  undoStep?: () => () => boolean
  /** The units and who holds what: worked out by the host while the page is up. Absent: no unit filter and no people. */
  facts?: OrganisationFacts
  /** Goes to the organisation, where this page is edited. */
  onOpenOrganisation?: () => void
  /** Goes to a unit's place in the organisation. */
  onOpenUnit?: (unit: { id: string; scope: string }) => void
  onOpenChart?: () => void
  onOpenHistory?: () => void
  /** Puts a unit's or a holder's own line back, where it is kept. */
  onBackBelow?: (exception: OutsideTheModel) => void
  /** Hands a file over to be saved. Absent: no export. */
  onSave?: (name: string, text: string) => void
  renderMarkdown?: (text: string) => ReactNode
}

/** Which tab an item is read on when something asks for it by its id. */
function tabOf(kind: OperatingItem['kind']): OperatingTab {
  return kind === 'responsibility' ? 'responsibilities' : kind === 'role' ? 'roles' : 'structure'
}

export function OperatingModelPage(props: OperatingModelPageProps) {
  const { model, dispatch, makeId, initialId, initialNonce, facts } = props
  const { t, language } = useStrings()
  const readOnly = props.readOnly || !props.atOrganisation
  const [tabNow, setTab] = usePlaceTab('structure', 'operating')
  const tab = tabNow as OperatingTab
  const [lookWords, setLookWords] = usePlaceLook('operating')
  const look = useMemo(() => readLook(lookWords), [lookWords])
  const setLook = (next: RaciLook) => setLookWords(writeLook(next))
  const selected = look.select
  const [matrixView, setMatrixView] = useState<MatrixView>(ALL_OF_THE_MATRIX)
  const [arranging, setArranging] = useState(false)
  const [asideWidth, setAsideWidth] = useSeamWidth('operating.aside', 360)
  const [removing, setRemoving] = useState<string | undefined>(undefined)
  const clearTakingRef = useRef(() => {})
  const [slotOpen, setSlotOpen] = useState<RoleId | undefined>(undefined)
  const libraries = props.libraries ?? LIBRARIES
  const fromLibrary = useLibraryStep({ pageOpen: props.open, dispatch, undoStep: props.undoStep })

  // What was just made, with a count that opens its name for typing once.
  const [naming, setNaming] = useState<{ id: string; nonce: number } | undefined>(undefined)
  const select = (id: string | undefined) => {
    const { select: _was, ...rest } = look
    setLook(id === undefined ? rest : { ...rest, select: id })
    clearTakingRef.current()
    setSlotOpen(undefined)
    if (id !== undefined) setArranging(false)
  }
  const chooseTab = (next: OperatingTab) => {
    const { select: _was, ...rest } = look
    setLook(rest)
    setSlotOpen(undefined)
    setTab(next)
  }
  // A request for an item — from search, a link or an agent — opens it on its tab,
  // once per request. The model is read for the item's kind and not watched.
  const latest = useRef(model)
  latest.current = model
  useEffect(() => {
    const asked = itemOf(latest.current, initialId)
    // A reload whose address says what was picked since keeps that.
    if (!asked || look.select !== undefined) return
    // The look first: said from another page, it leaves that page's tab behind, and this tab is the one to keep.
    setLookWords(writeLook({ select: asked.item.id }))
    setTab(tabOf(asked.kind))
  }, [initialId, initialNonce])

  const picked = useMemo(() => itemOf(model, selected), [model, selected])
  const exceptions = useMemo(() => exceptionsOf(model.unitTypes, model.roles, facts), [model.unitTypes, model.roles, facts])
  const { removeSlotOf, taking, clearTaking } = useSlotTaking(props, picked, () => setSlotOpen(undefined))
  clearTakingRef.current = clearTaking
  // An item opened from elsewhere on the page: picked, on its own tab, unless this tab reads it beside itself.
  const openItem = (id: string) => {
    const held = itemOf(model, id)
    if (!held) return
    const beside = (tab === 'structure' && held.kind !== 'responsibility') || tab === 'responsibilities'
    setSlotOpen(undefined)
    if (!beside) setTab(tabOf(held.kind))
    setLook({ ...(beside ? look : {}), select: id })
  }
  const toRemove = itemOf(model, removing)
  const confirmRemove = () => {
    if (!toRemove) return
    const remove = { unitType: removeUnitType, role: removeRole, responsibility: removeResponsibility }[toRemove.kind]
    dispatch(remove(model, toRemove.item.id))
    setRemoving(undefined)
    select(undefined)
  }
  const parts: ReaderParts = {
    model, readOnly, dispatch, onSelect: openItem, onRemove: setRemoving, facts, refuseLine: props.refuseLine, renderMarkdown: props.renderMarkdown,
    aside: picked && props.aside?.(picked), onOpenHistory: props.onOpenHistory, onOpenUnit: props.onOpenUnit, onOpenChart: props.onOpenChart,
  }
  const beside = tab === 'structure' || tab === 'responsibilities'
  const flat = tab === 'responsibilities'
  const reading = beside && !arranging && picked !== undefined
  const main = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  // The record read beside closes back to where it stands in the lanes or the grid, where the focus was in it.
  const closeReader = () => {
    const was = picked?.item.id
    const inside = panel.current?.contains(document.activeElement) === true
    if (slotOpen !== undefined) setSlotOpen(undefined)
    else select(undefined)
    if (inside && was) requestAnimationFrame(() => focusIn(main.current, was))
  }
  // A new responsibility's name kept: its row's first letter is what is set next, so the grid takes the focus there.
  const named = (id: string) => {
    if (naming?.id !== id || tab !== 'responsibilities') return
    setTimeout(() => { if (panel.current?.contains(document.activeElement)) focusIn(main.current, id, true) }, 0)
  }
  const onEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || keyClaimed(event)) return
    if (arranging) { claimKey(event); setArranging(false) } else if (reading) { claimKey(event); closeReader() }
  }
  return (
    <PageDialog open={props.open} topInset={props.windowChrome?.topInset} onClose={props.onClose} aria-label={t('operating.title')}>
      {/* One Escape does one thing: Arrange or the record beside the grid closes before the page does. */}
      <div className="op-page" onKeyDown={onEscape}>
        <div className="op-bar">
          <Tabs
            label={t('operating.title')} value={tab} onChange={(next) => chooseTab(next)}
            items={[
              { value: 'structure', label: t('operating.tabStructure'), guide: 'operating.tabUnits' },
              { value: 'roles', label: t('operating.tabRoles'), guide: 'operating.tabRoles' },
              { value: 'responsibilities', label: t('operating.tabRaci'), guide: 'operating.tabRaci' },
              { value: 'exceptions', label: t('operating.tabExceptions'), guide: 'operating.tabExceptions', ...(exceptions.length ? { count: exceptions.length } : {}) },
              { value: 'libraries', label: t('operating.tabLibraries'), guide: 'operating.tabLibraries' },
            ]}
          />
          <span className="op-bar__counts" data-testid="operating-counts">
            {countsLine(t, model.unitTypes.length, model.roles.length, model.responsibilities.length)}
          </span>
          <PageClose onClose={props.onClose} />
        </div>
        {!props.atOrganisation && (
          <div className="op-readonly" data-testid="operating-read-only">
            <span>{t('operating.atOrganisation')}</span>
            {props.onOpenOrganisation && <Button variant="plain" size="small" onClick={props.onOpenOrganisation}>{t('operating.openItThere')}</Button>}
          </div>
        )}
        <div className="op-body">
          <div className="op-main" data-flat={flat || undefined} ref={main}>
            <TabBody
              tab={tab} parts={parts} props={props} readOnly={readOnly} libraries={libraries} fromLibrary={fromLibrary} selected={selected} select={select} onMade={(id) => { select(id); setNaming((was) => ({ id, nonce: (was?.nonce ?? 0) + 1 })) }} naming={naming} look={look} setLook={setLook}
              setTab={setTab} matrixView={matrixView} setMatrixView={setMatrixView} arranging={arranging} setArranging={setArranging} exceptions={exceptions} openItem={openItem}
            />
          </div>
          {((tab === 'responsibilities' && arranging) || reading) && (
            <SeamResizer orientation="vertical" region="after" value={asideWidth} min={260} max={720} defaultValue={360} onChange={setAsideWidth} label={t('common.resizeColumn')} />
          )}
          {reading && (
            <div className="op-aside" ref={panel}>
              <RecordPanel
                width={asideWidth} picked={picked} parts={parts} onSelect={select} slotOpen={slotOpen} onSlot={setSlotOpen} slotAside={taking}
                removeSlotOf={removeSlotOf} naming={naming} onNamed={named} part={tab === 'responsibilities' ? look.part : undefined}
              />
            </div>
          )}
          {tab === 'responsibilities' && arranging && (
            <ArrangePanel
              width={asideWidth} model={model} order={matrixView.order} onOrder={(order) => setMatrixView({ ...matrixView, order })} part={arrangedPart(model, look)}
              dispatch={dispatch} onClose={() => setArranging(false)} readOnly={readOnly}
            />
          )}
        </div>
      </div>
      <RemoveConfirm
        item={toRemove} holders={toRemove?.kind === 'role' ? props.roleHolders?.(toRemove.item.id) : undefined}
        onCancel={() => setRemoving(undefined)} onConfirm={confirmRemove}
      />
      <FromLibrary
        step={fromLibrary} readOnly={readOnly} model={model} libraries={libraries} language={language} makeId={makeId} chrome={props.windowChrome}
        // What came in is drawn where it now stands, marked new.
        onBrought={() => chooseTab('structure')}
      />
    </PageDialog>
  )
}

/**
 * Where a record stands in the lanes or the grid, focused: a responsibility's row
 * (its first letter, where `letter`), a unit type's card, a role's first chip.
 */
function focusIn(main: HTMLElement | null, id: string, letter = false) {
  if (!main) return
  // Matched by reading the marks rather than a selector, so an id needs no escaping.
  const first = (selector: string, mark: (one: HTMLElement) => string | undefined) =>
    Array.from(main.querySelectorAll<HTMLElement>(selector)).find((one) => mark(one) === id)
  const row = first('[data-kit-row]', (one) => one.dataset.kitRow)
  // A folded column takes no letter: where every role is folded away the row's name takes the focus.
  const cell = letter ? row?.parentElement?.querySelector<HTMLElement>('td[data-kit-cell]:not([data-folded])') : undefined
  const card = first('[data-testid^="unit-type-"]', (one) => one.dataset.testid?.slice('unit-type-'.length))
  const chip = first('button[data-testid^="role-"]', (one) => one.dataset.testid?.slice('role-'.length))
  const target = cell ?? row ?? card?.querySelector<HTMLElement>('.op-card__name') ?? chip
  target?.focus()
}

/** The part the grid shows, as the tab reads it: with none said and no unit or whole organisation, its first group. */
function arrangedPart(model: OperatingModel, look: RaciLook): string | undefined {
  if (look.whole || look.unit !== undefined || look.part !== undefined) return look.part
  return raciParts(model).find((one) => one.responsibilities.length > 0)?.group
}

/** A slot somebody holds through the type alone waits for the host's list of them; any other goes at once. */
function useSlotTaking(props: OperatingModelPageProps, picked: OperatingItem | undefined, leaveSlot: () => void) {
  const [takingOut, setTakingOut] = useState<{ typeId: string; roleId: RoleId } | undefined>(undefined)
  const removeSlotOf = (type: UnitType, index: number) => {
    const roleId = type.slots[index].role
    const left = type.slots.some((slot, at) => at !== index && slot.role === roleId)
    leaveSlot()
    if (!left && props.slotTakeOut?.held(type, roleId)) {
      setTakingOut({ typeId: type.id, roleId })
      return
    }
    props.dispatch(removeSlot(type, index))
    if (takingOut?.typeId === type.id && takingOut.roleId === roleId) setTakingOut(undefined)
  }
  const taking = takingOut && picked?.kind === 'unitType' && picked.item.id === takingOut.typeId
    ? props.slotTakeOut?.aside(picked.item, takingOut.roleId, () => setTakingOut(undefined))
    : undefined
  return { removeSlotOf, taking, clearTaking: () => setTakingOut(undefined) }
}

/** What the tab that is up shows. */
function TabBody({ tab, parts, props, readOnly, libraries, fromLibrary, selected, select, onMade, naming, look, setLook, setTab, matrixView, setMatrixView, arranging, setArranging, exceptions, openItem }: {
  tab: OperatingTab; parts: ReaderParts; props: OperatingModelPageProps; readOnly: boolean; libraries: readonly Library[]; fromLibrary: LibraryStep
  selected: string | undefined; select(id: string | undefined): void; onMade(id: string): void; naming: { id: string; nonce: number } | undefined; look: RaciLook; setLook(look: RaciLook): void; setTab(tab: OperatingTab): void
  matrixView: MatrixView; setMatrixView(view: MatrixView): void; arranging: boolean; setArranging(on: boolean): void
  exceptions: readonly OutsideTheModel[]; openItem(id: string): void
}) {
  const { language } = useStrings()
  const { model, dispatch, makeId, facts } = props
  return (
    <>
            {tab === 'structure' && (
              <StructureTab
                model={model} readOnly={readOnly} selected={selected} onSelect={select} dispatch={dispatch} makeId={makeId}
                unitCounts={props.unitCounts} onFromLibrary={() => fromLibrary.open()} fresh={fromLibrary.fresh} onMade={onMade}
              />
            )}
            {tab === 'roles' && <RolesTab parts={parts} makeId={makeId} selected={selected} onSelect={select} onNew={onMade} naming={naming} />}
            {tab === 'responsibilities' && (
              <ResponsibilitiesTab
                model={model} readOnly={readOnly} dispatch={dispatch} makeId={makeId} facts={facts} look={look}
                onLook={(next) => setLook({ ...next, ...(selected ? { select: selected } : {}) })}
                view={matrixView} onView={setMatrixView} arranging={arranging} onArrange={(on) => { setArranging(on); if (on) select(undefined) }}
                selected={selected} onSelect={select} onMade={onMade} onSave={props.onSave} onOpenUnit={props.onOpenUnit}
              />
            )}
            {tab === 'exceptions' && (
              <ExceptionsTab
                model={model} exceptions={exceptions} readOnly={readOnly} dispatch={dispatch} onBackBelow={props.onBackBelow}
                onOpenRole={(id) => { setTab('roles'); setLook({ select: id }) }}
                onOpenType={(id) => { setTab('structure'); setLook({ select: id }) }}
                onOpenUnit={props.onOpenUnit} selected={selected} onSelect={select}
              />
            )}
            {tab === 'libraries' && (
              <LibrariesPanel
                model={model} readOnly={readOnly} libraries={libraries} language={libraryLanguage(language)}
                onFromLibrary={fromLibrary.open} onOpenItem={openItem} selected={selected} onSelect={select}
              />
            )}
    </>
  )
}

/** The dialog that brings a library in, and the toast after it. */
function FromLibrary({ step, readOnly, model, libraries, language, makeId, chrome, onBrought }: {
  step: LibraryStep; readOnly: boolean; model: OperatingModel; libraries: readonly Library[]; language: string; makeId: MakeId
  chrome: WindowChrome | undefined; onBrought(): void
}) {
  return (
    <>
      <LibraryDialog
        open={!readOnly && step.asking !== undefined} lists={model} libraries={libraries}
        {...(step.asking?.libraryId ? { libraryId: step.asking.libraryId } : {})}
        language={libraryLanguage(language)} makeId={makeId} {...(chrome ? { windowChrome: chrome } : {})} onClose={step.close}
        onBring={(brought) => { step.bring(brought); onBrought() }}
      />
      <LandedToast landed={step.landed} onUndo={step.undo} onClose={step.dismiss} />
    </>
  )
}
