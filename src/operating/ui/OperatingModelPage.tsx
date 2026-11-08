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
import type { ReactNode } from 'react'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import type { RoleId, UnitType, UnitTypeId } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import type { WindowChrome } from '../../platform/windowChrome'
import { Button } from '../../widgets/kit/Button'
import { Panel } from '../../widgets/kit/Panel'
import { Tabs } from '../../widgets/kit/Tabs'
import { PageClose } from '../../widgets/PageClose'
import { PageDialog } from '../../widgets/PageDialog'
import { SeamResizer } from '../../widgets/SeamResizer'
import { useSeamWidth } from '../../widgets/useSeamWidth'
import { usePlaceLook, usePlaceTab } from '../../widgets/placeTab'
import { editResponsibility, editRole, editUnitType, itemOf, removeResponsibility, removeRole, removeSlot, removeUnitType } from '../edit'
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
import { ResponsibilityReader } from './ResponsibilityReader'
import { RoleReader } from './RoleReader'
import { RolesTab } from './RolesTab'
import { SlotReader } from './SlotReader'
import { StructureTab } from './StructureTab'
import { UnitTypeReader } from './UnitTypeReader'
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
  return (
    <PageDialog open={props.open} topInset={props.windowChrome?.topInset} onClose={props.onClose} aria-label={t('operating.title')}>
      <div className="op-page">
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
          <div className="op-main" data-flat={flat || undefined}>
            <TabBody
              tab={tab} parts={parts} props={props} readOnly={readOnly} libraries={libraries} fromLibrary={fromLibrary} selected={selected} select={select} onMade={(id) => { select(id); setNaming((was) => ({ id, nonce: (was?.nonce ?? 0) + 1 })) }} look={look} setLook={setLook}
              setTab={setTab} matrixView={matrixView} setMatrixView={setMatrixView} arranging={arranging} setArranging={setArranging} exceptions={exceptions} openItem={openItem}
            />
          </div>
          {beside && (arranging || picked) && (
            <SeamResizer orientation="vertical" region="after" value={asideWidth} min={260} max={720} defaultValue={360} onChange={setAsideWidth} label={t('common.resizeColumn')} />
          )}
          {beside && picked && !arranging && (
            <Reader
              width={asideWidth} picked={picked} parts={parts} slotOpen={slotOpen} onSlot={setSlotOpen} onClose={() => select(undefined)} slotAside={taking}
              removeSlotOf={removeSlotOf} naming={naming} part={tab === 'responsibilities' ? look.part : undefined}
            />
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
function TabBody({ tab, parts, props, readOnly, libraries, fromLibrary, selected, select, onMade, look, setLook, setTab, matrixView, setMatrixView, arranging, setArranging, exceptions, openItem }: {
  tab: OperatingTab; parts: ReaderParts; props: OperatingModelPageProps; readOnly: boolean; libraries: readonly Library[]; fromLibrary: LibraryStep
  selected: string | undefined; select(id: string | undefined): void; onMade(id: string): void; look: RaciLook; setLook(look: RaciLook): void; setTab(tab: OperatingTab): void
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
                unitCounts={props.unitCounts} onFromLibrary={() => fromLibrary.open()} fresh={fromLibrary.fresh}
              />
            )}
            {tab === 'roles' && <RolesTab parts={parts} makeId={makeId} selected={selected} onSelect={select} onNew={select} />}
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

/** The panel beside the structure or the grid: an item, or one role of a unit type. */
function Reader({ width, picked, parts, slotOpen, onSlot, onClose, slotAside, removeSlotOf, part, naming }: {
  width: number; picked: OperatingItem; parts: ReaderParts; slotOpen: RoleId | undefined; onSlot(role: RoleId | undefined): void; onClose(): void
  slotAside: ReactNode; removeSlotOf(type: UnitType, index: number): void; part: string | undefined
  /** The item just made, whose name opens for typing. */
  naming: { id: string; nonce: number } | undefined
}) {
  const { t } = useStrings()
  const { readOnly, dispatch, model } = parts
  const kind = { unitType: t('operating.unitType'), role: t('operating.role'), responsibility: t('operating.responsibility') }[picked.kind]
  const rename = { unitType: editUnitType, role: editRole, responsibility: editResponsibility }[picked.kind]
  const slotAt = picked.kind === 'unitType' && slotOpen !== undefined ? picked.item.slots.findIndex((slot) => slot.role === slotOpen) : -1
  if (picked.kind === 'unitType' && slotAt >= 0) {
    const slot = picked.item.slots[slotAt]
    const type = picked.item
    return (
      <Panel
        kind={type.name} name={model.roles.find((role) => role.id === slot.role)?.name ?? slot.role} onClose={() => onSlot(undefined)} width={width} dataGuide="operating.reader"
        actions={<button type="button" className="op-link op-small" onClick={() => onSlot(undefined)}>{t('operating.backToType', { type: type.name })}</button>}
      >
        <SlotReader type={type} slot={slot} index={slotAt} parts={parts} onTakeOut={() => removeSlotOf(type, slotAt)} />
      </Panel>
    )
  }
  return (
    <Panel
      kind={kind} name={picked.item.name} onClose={onClose} width={width} dataGuide="operating.reader"
      {...(naming?.id === picked.item.id ? { renameRequest: naming.nonce, renameAtOnce: true } : {})}
      {...(readOnly ? {} : { onRename: (name: string) => { dispatch(rename(picked.item.id, 'name', name)) } })}
    >
      <div data-testid="operating-inspector">
        {picked.kind === 'unitType' && <UnitTypeReader type={picked.item} parts={parts} onOpenSlot={onSlot} slotAside={slotAside} />}
        {picked.kind === 'role' && (
          <RoleReader
            role={picked.item} parts={parts} partName={part}
            partDuties={part === undefined ? undefined : model.responsibilities.filter((one) => (one.group?.trim() ?? '') === part).map((one) => one.id)}
          />
        )}
        {picked.kind === 'responsibility' && <ResponsibilityReader responsibility={picked.item} parts={parts} />}
      </div>
    </Panel>
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
