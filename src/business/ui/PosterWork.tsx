// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The poster with what goes round it: the tray and the dialogs of Design, what is
 * picked and lit, and the way onto paper. What a gesture may do is worked out here
 * once, so the canvas draws and the tray offers and neither decides.
 *
 * Read and looking at another day hand the canvas no `design` at all: a canvas that
 * cannot reach the actions cannot offer a *+*, a handle or a drop.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import type { DesignDiagram, DesignElement, DesignModel, ElementId } from '../../model'
import type { Translate } from '../../i18n'
import { captureSheet } from '../../widgets/capturePage'
import { printPage } from '../../widgets/printPage'
import type { PrintDress, PrintPaper } from '../../widgets/printPage'
import type { FunctionCoverage } from '../coverage'
import type { LensValue, SheetLens } from '../lens'
import { posterPaperLayout, posterPlaces } from '../posterPlaces'
import { POSTER_COLUMN_ID } from '../posterLayout'
import type { LaidOutSheet } from '../sheet'
import { wouldCycle } from '../tree'
import { PosterIconDialog, PosterPictureDialog } from './PosterChoose'
import { DesignBar } from './PosterDesign'
import type { PosterActions, PosterDesign } from './PosterDesign'
import { PosterExportDialog } from './PosterExportDialog'
import type { PosterExport } from './PosterExportDialog'
import { PosterPickAt, PosterTray } from './PosterTray'
import type { TrayWork } from './PosterTray'
import { SheetPoster } from './SheetPoster'
import type { PosterHandle } from './SheetPoster'
import type { SheetActions, SheetDomains, SheetResponsible, Supporter } from './FunctionInspector'
import type { Author } from './SheetAuthor'
import { FromAbove } from './SheetAuthor'
import type { SheetClaims } from './SheetAuthor'
import type { Who } from './Responsible'

/** A picture's budget, as the Names reading's. */
const EXPORT_MAX_PIXELS = 40_000_000
const NOTE_SIZE = { width: 180, height: 46 }
const PICTURE_SIZE = { width: 160, height: 90 }

/** A copy of the page for paper, at reading distance whatever the window is zoomed to. */
export function posterCopy(handle: PosterHandle, paper: PrintPaper, dress?: PrintDress) {
  const page = handle.page()
  if (!page) return undefined
  const held = printPage(page.node, page, paper, dress)
  const copy = held.node.querySelector<HTMLElement>('.poster__stage')
  if (copy) {
    copy.dataset.distance = 'reading'
    copy.dataset.labels = 'words'
    copy.removeAttribute('data-finding')
    copy.style.removeProperty('--canvas-zoom')
  }
  return held
}

/** The page as a picture, for the agent's renderer and for a PNG. */
export async function posterShot(handle: PosterHandle, paper: PrintPaper, maxPixels: number, dress?: PrintDress) {
  const held = posterCopy(handle, paper, dress)
  if (!held) throw new Error('SheetPoster: the page is not on screen')
  held.node.dataset.capturing = ''
  try {
    return await captureSheet(held.node, { maxPixels, background: 'white' })
  } finally {
    held.release()
  }
}

export type PosterHostParts = {
  model: DesignModel
  sheet: DesignDiagram
  poster?: PosterActions | undefined
  actions: SheetActions
  applications?: readonly Supporter[] | undefined
  responsible?: SheetResponsible | undefined
  domains?: SheetDomains | undefined
  ownerOf?: ((id: ElementId) => { label: string; fields: readonly string[] } | undefined) | undefined
  claims?: SheetClaims | undefined
  retiring(id: ElementId): boolean
  addImage?: ((file: File) => Promise<string | undefined>) | undefined
  onSave?: ((doc: { name: string; bytes: Uint8Array; mediaType: 'image/png' | 'application/pdf' }) => void) | undefined
  onPrint?: ((doc: { name: string; widthMm: number; heightMm: number }) => Promise<void>) | undefined
}

function SelectingBar({ design, places, parts, author, t, onPicture, handle }: {
  design: PosterDesign
  places: ReturnType<typeof posterPlaces>
  parts: PosterHostParts & { laidOut: LaidOutSheet }
  author: Author
  t: Translate
  onPicture(): void
  handle: { current: PosterHandle | undefined }
}) {
  return (
    <DesignBar
      actions={design.actions} places={places} t={t} onPicture={onPicture}
      onAddArea={() => author.made(author.actions.addArea(t('sheet.nameArea')))}
      fromAbove={<FromAbove claims={parts.claims} t={t} />}
      onPaperLayout={() => {
        const layout = posterPaperLayout(parts.laidOut, parts.sheet)
        design.actions.place(layout.blocks.filter((block) => block.id !== POSTER_COLUMN_ID), layout.blocks.filter((block) => block.id === POSTER_COLUMN_ID))
      }}
      onNote={() => {
        const at = handle.current?.centre() ?? { x: 0, y: 0 }
        design.actions.addItem({ kind: 'note', text: t('sheet.poster.aNote') }, { ...at, ...NOTE_SIZE })
      }}
    />
  )
}

export function PosterWork({ parts, laidOut, designing, lens, valueOf, coverageAt, nameOf, selectedId, onSelect, made, only, lit, who, day, kept, keyStrip, dockExtra, handle, exporting, onExported, keyWords, today, scopeName, onLane, author, iconAsked, t }: {
  parts: PosterHostParts
  laidOut: LaidOutSheet
  designing: boolean
  lens: SheetLens | undefined
  valueOf(element: DesignElement): LensValue | undefined
  coverageAt(id: ElementId): FunctionCoverage
  nameOf(id: ElementId): string
  selectedId: ElementId | undefined
  onSelect(id: ElementId | undefined): void
  made(id: ElementId | undefined): void
  only: string | undefined
  lit: ReadonlySet<ElementId> | undefined
  who: Who | undefined
  day: string | undefined
  kept: ReadonlySet<ElementId> | undefined
  keyStrip: ReactNode
  dockExtra: ReactNode
  handle: { current: PosterHandle | undefined }
  /** The export is asked for. */
  exporting: boolean
  onExported(): void
  keyWords: readonly { label: string; swatch?: string }[]
  today: string
  scopeName: string | undefined
  onLane(): void
  author: Author | undefined
  /** Bumped when the panel asks for the selected step's or stakeholder's icon. */
  iconAsked: number
  t: Translate
}) {
  const { model, sheet, poster, actions } = parts
  const [picked, setPicked] = useState<ReadonlySet<ElementId>>(new Set())
  const [lightOf, setLightOf] = useState<{ id: string; tiles: ReadonlySet<ElementId> } | undefined>(undefined)
  const [pickAt, setPickAt] = useState<{ kind: 'team' | 'application'; id: ElementId; anchor: HTMLElement } | undefined>(undefined)
  const [iconFor, setIconFor] = useState<ElementId | undefined>(undefined)
  const [picturing, setPicturing] = useState(false)
  const posterRef: Ref<PosterHandle | undefined> = handle as Ref<PosterHandle | undefined>
  const places = useMemo(() => posterPlaces(laidOut, sheet), [laidOut, sheet])
  const latest = useRef({ model, parts, onSelect, nameOf, made, author, onLane })
  latest.current = { model, parts, onSelect, nameOf, made, author, onLane }

  const design: PosterDesign | undefined = useMemo(() => {
    if (!designing || !poster) return undefined
    return {
      actions: poster,
      picked,
      keptOnRail: kept,
      refusal(id, to) {
        const now = latest.current
        const owner = now.parts.ownerOf?.(id)
        if (owner) return t('standIn.definedIn', { scope: owner.label })
        return wouldCycle(now.model.elements, id, to) ? t('sheet.parentCycle') : undefined
      },
      moveTile(id, to) { actions.updateElement(id, { parentId: to }) },
      onPress(id, adding) {
        setLightOf(undefined)
        if (id === undefined || !adding) {
          setPicked(id === undefined ? new Set() : new Set([id]))
          return false
        }
        setPicked((was) => {
          const next = new Set(was)
          if (!next.delete(id)) next.add(id)
          return next
        })
        latest.current.onSelect(id)
        return true
      },
      onBox(ids) { setPicked(new Set(ids)) },
      onPick(kind, id, anchor) { setPickAt({ kind, id, anchor }) },
      addUnder(id, what) {
        const now = latest.current
        if (what === 'capability') { now.made(actions.addElement({ kind: 'function', name: t('sheet.nameCapability'), parentId: id })); return }
        // A grouping is a child with something under it, so it comes with its first capability.
        const grouping = actions.addElement({ kind: 'function', name: t('sheet.nameGrouping'), parentId: id })
        if (grouping === undefined) return
        actions.addElement({ kind: 'function', name: t('sheet.nameCapability'), parentId: grouping })
        now.made(grouping)
      },
      addStep(phaseId, lane) {
        latest.current.made(actions.addElement({ kind: 'step', name: t('sheet.nameStep'), parentId: phaseId, ...(lane !== undefined ? { lane } : {}) }))
      },
      addPhase(journeyId) { latest.current.made(actions.addElement({ kind: 'step', name: t('sheet.namePhase'), parentId: journeyId })) },
      addLane() { latest.current.onLane() },
      addStakeholder(groupId) { latest.current.made(actions.addElement({ kind: 'actor', name: t('sheet.nameStakeholder'), parentId: groupId })) },
      addGroup() { latest.current.made(actions.addElement({ kind: 'actor', name: t('sheet.nameGroup') })) },
      chooseIcon(id) { setIconFor(id) },
      nameOf(id) {
        if (id === POSTER_COLUMN_ID) return t('sheet.stakeholders')
        const item = latest.current.parts.sheet.poster?.items?.find((one) => one.id === id)
        if (item) return item.text ?? item.alt ?? ''
        return latest.current.nameOf(id)
      },
    }
  }, [designing, poster, picked, kept, actions, t])

  const tray: TrayWork | undefined = useMemo(() => (poster ? {
    model, laidOut, actions: poster, coverageAt, responsible: parts.responsible, applications: parts.applications, domains: parts.domains,
    ownerOf: parts.ownerOf, retiring: parts.retiring, say: (words: string) => handle.current?.say(words), t,
  } : undefined), [poster, model, laidOut, coverageAt, parts.responsible, parts.applications, parts.domains, parts.ownerOf, parts.retiring, handle, t])

  const litNow = useMemo(() => {
    if (!lightOf && !lit) return undefined
    return new Set([...(lit ?? []), ...(lightOf?.tiles ?? [])])
  }, [lit, lightOf])

  // The panel's Choose… for the one it is on.
  const seenAsk = useRef(iconAsked)
  useEffect(() => {
    if (seenAsk.current === iconAsked) return
    seenAsk.current = iconAsked
    if (selectedId !== undefined) setIconFor(selectedId)
  }, [iconAsked, selectedId])

  const iconElement = iconFor !== undefined ? model.elements.find((one) => one.id === iconFor) : undefined
  const strip = (
    <>
      {keyStrip}
      {design && author && tray && <SelectingBar design={design} places={places} parts={{ ...parts, laidOut }} author={author} t={t} onPicture={() => setPicturing(true)} handle={handle} />}
    </>
  )
  const cut = useCallback((paper: PrintPaper): readonly ElementId[] => {
    if (!handle.current) return []
    const held = posterCopy(handle.current, paper)
    if (!held) return []
    const ids: ElementId[] = []
    for (const name of held.node.querySelectorAll<HTMLElement>('.poster-tile__name')) {
      if (name.scrollHeight <= name.clientHeight + 1) continue
      const id = name.closest<HTMLElement>('[data-element-id]')?.dataset.elementId
      if (id) ids.push(id)
    }
    held.release()
    return ids
  }, [handle])
  const save = useCallback(async (how: PosterExport) => {
    const on = handle.current
    if (!on) return
    const dress: PrintDress = { look: how.look, title: how.title, foot: how.foot, date: how.date, key: keyWords }
    const name = `${sheet.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'sheet'}`
    if (how.file === 'png') {
      const shot = await posterShot(on, how.paper, EXPORT_MAX_PIXELS, dress)
      parts.onSave?.({ name: `${name}.png`, bytes: shot.png, mediaType: 'image/png' })
      return
    }
    const held = posterCopy(on, how.paper, dress)
    if (!held) return
    try {
      await document.fonts?.ready
      await parts.onPrint?.({ name: `${name}.pdf`, widthMm: how.paper.widthMm, heightMm: how.paper.heightMm })
    } finally {
      held.release()
    }
  }, [handle, keyWords, sheet.name, parts])

  return (
    <>
      {design && tray && <PosterTray work={tray} picked={picked} lit={lightOf?.id} onLight={(id, tiles) => setLightOf(id !== undefined ? { id, tiles: new Set(tiles) } : undefined)} />}
      <SheetPoster
        laidOut={laidOut} sheet={sheet} lens={lens} valueOf={valueOf} coverageAt={coverageAt} nameOf={nameOf} selectedId={selectedId} onSelect={onSelect}
        strip={strip} only={only} lit={litNow} who={who} day={day} design={design} handle={posterRef} dockExtra={dockExtra}
        ownerLabel={parts.ownerOf ? (id) => parts.ownerOf?.(id)?.label : undefined}
        domainName={parts.domains?.name} domainKnown={parts.domains?.known} appsIn={parts.domains?.applicationsIn} t={t}
      />
      {pickAt && tray && (
        <PosterPickAt
          work={tray} kind={pickAt.kind} anchor={pickAt.anchor} onClose={() => setPickAt(undefined)}
          ids={picked.has(pickAt.id) ? [...picked] : [pickAt.id]}
        />
      )}
      {iconElement && (
        <PosterIconDialog
          name={iconElement.name} icon={iconElement.icon} addImage={parts.addImage} onClose={() => setIconFor(undefined)}
          onChoose={(icon) => actions.updateElement(iconElement.id, { icon })}
        />
      )}
      {picturing && poster && (
        <PosterPictureDialog
          addImage={parts.addImage} onClose={() => setPicturing(false)}
          onAdd={(image, alt) => {
            const at = handle.current?.centre() ?? { x: 0, y: 0 }
            poster.addItem({ kind: 'picture', image, alt }, { ...at, ...PICTURE_SIZE })
          }}
        />
      )}
      {exporting && (
        <PosterExportDialog
          sheet={sheet} page={{ width: places.width, height: places.height }} scopeName={scopeName} keyWords={keyWords.map((one) => one.label)} cutNames={cut}
          waiting={places.waiting.length} canWrite={poster !== undefined} today={today} onClose={onExported}
          onSheet={(patch) => actions.updateSheet(patch)} onSave={save}
          onSelectCut={(ids) => { setPicked(new Set(ids)); if (ids[0] !== undefined) onSelect(ids[0]); handle.current?.say(t('sheet.poster.cutSelected', { count: ids.length })) }}
        />
      )}
    </>
  )
}
