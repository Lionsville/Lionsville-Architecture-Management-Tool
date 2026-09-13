/**
 * An application the organisation already has, drawn on this board — the
 * register as a library, wired (ADR-0012 §2, §3).
 *
 * The arithmetic is `projects/library.ts`: what drawing one means for this
 * scope's records comes back as a plan, and this hook is the part that
 * cannot be pure — which dialog is up, the one question a person is asked,
 * and the command at the session. Every outcome is ONE command and one undo
 * step: the record, where it needs making, and its place on the board, as a
 * transaction.
 *
 * What is deliberately NOT here: any write to another scope. Drawing what
 * a domain defines never takes it over; the record this scope gets is a
 * stand-in, and taking ownership is a gesture of its own (`useGestures`).
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Translate } from '../i18n'
import type { Command, DesignElement, ElementId } from '../model'
import { placeOn, transaction } from '../model/commands'
import { seedPlacement } from '../model/placement'
import { isLibraryRefusal, LIBRARY_REFUSAL, libraryRows, planFromLibrary, rowsToImport } from '../projects/library'
import type { LibraryPlan, LibraryRow } from '../projects/library'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ExistingAt } from '../editor/props'
import type { ScopePath } from '../projects/scopePath'
import type { ModelSession } from './useModelSession'
import type { Notify } from './useToasts'

/** How a stand-in is drawn here: outside this landscape, or as one of its applications. */
export type LibraryBand = 'external' | 'domain'

/**
 * Which dialog is up: the picker, the question about an unowned one, or the
 * question every stand-in is asked — which band.
 */
export type LibraryChoice =
  | { kind: 'picking'; rows: readonly LibraryRow[] }
  | { kind: 'asking'; id: ElementId; name: string; canDrawOnly: boolean }
  | { kind: 'placing'; id: ElementId; name: string }

export type Library = {
  /**
   * Open the picker over the active board. Nothing happens on a view that
   * draws no cards. With `at` — the canvas's *Add here* — what is picked
   * lands there, in that band, and the band question is not asked.
   */
  open(at?: ExistingAt): void
  choice: LibraryChoice | undefined
  /** One row of the picker: draw it, or ask about it. */
  pick(id: ElementId): void
  /** The answer "yes": this scope defines it from now on. */
  own(): void
  /** The answer "no": one more stand-in, at the address the others carry. */
  drawOnly(): void
  /**
   * Where a stand-in goes: the external band, drawn as a system outside
   * this landscape, or the landscape band, drawn as the application it is
   * — with a double-click opening it where it is defined.
   */
  place(band: LibraryBand): void
  close(): void
}

export function useLibrary(deps: {
  session: ModelSession
  scope: ScopePath
  index: ScopeIndex
  notify: Notify
  s: Translate
  /** Select it on the board and bring it into view, once it is there. */
  focus(id: ElementId): void
  scopeLabel(path: ScopePath): string
}): Library {
  const { session, scope, index, notify, s, focus, scopeLabel } = deps
  // Where the picker was opened from, for as long as it is open.
  const atRef = useRef<ExistingAt | undefined>(undefined)
  const [choice, setChoice] = useState<
    | { kind: 'picking'; rows: readonly LibraryRow[] }
    | { kind: 'asking'; plan: Extract<LibraryPlan, { kind: 'unowned' }> }
    | { kind: 'placing'; element: DesignElement; create: boolean; said: string }
    | undefined
  >(undefined)

  const activeBoard = useCallback(() => {
    const model = session.current()
    return model.diagrams.find((diagram) => diagram.id === session.currentActiveId())
  }, [session])

  const open = useCallback((at?: ExistingAt) => {
    const diagram = activeBoard()
    if (!diagram) return
    atRef.current = at
    setChoice({ kind: 'picking', rows: libraryRows(index, session.current(), diagram) })
  }, [activeBoard, index, session])

  const close = useCallback(() => { atRef.current = undefined; setChoice(undefined) }, [])

  /**
   * Land it: the record where one is needed, and its place on the board, as
   * one step. A definition goes where the palette would put it; a stand-in
   * goes in the band the person chose, because the band is what decides how
   * it is drawn (`nodeFigure`) and that is the question `place` asks.
   */
  const land = useCallback((element: DesignElement, create: boolean, said: string, band?: LibraryBand) => {
    const diagram = activeBoard()
    if (!diagram) return
    const at = atRef.current
    atRef.current = undefined
    const seed = at !== undefined
      ? { ...element, position: at.position, zone: at.zone, group: at.group }
      : band === undefined
        ? element
        : { ...element, zone: band === 'external' ? 'externalSystems' as const : 'landscape' as const }
    const placement = seedPlacement(seed, diagram, element.id)
    // A stand-in brings its interfaces: the flows the tree holds between it
    // and what this scope already has, so an overview joins its cards up the
    // way the landscapes beneath it did. A definition has none to bring.
    const rows = element.ref !== undefined
      ? rowsToImport(index.rowsOf(element.id), element.id, session.current())
      : []
    const command: Command = transaction([
      ...(create ? [{ type: 'element.create' as const, element }] : []),
      placeOn(diagram.id, [placement]),
      ...rows.map((relation) => ({ type: 'relation.create' as const, relation })),
    ])
    setChoice(undefined)
    if (session.dispatch(command) === undefined) return
    focus(element.id)
    notify(said, 'success')
  }, [activeBoard, session, index, focus, notify])

  const pick = useCallback((id: ElementId) => {
    const diagram = activeBoard()
    if (!diagram) return
    const model = session.current()
    const plan = planFromLibrary({ id, scope, model, diagram, index })
    if (isLibraryRefusal(plan)) {
      setChoice(undefined)
      notify(s(LIBRARY_REFUSAL[plan.refused], { name: index.lookup(id)?.name ?? id }), 'warning')
      return
    }
    // Every stand-in is asked which band; a definition is not, because it is
    // this scope's own application and goes where its kind goes.
    switch (plan.kind) {
      case 'draw': {
        const held = model.elements.find((element) => element.id === plan.id)
        if (!held) return
        const said = s('library.drawn', { name: plan.name })
        if (held.ref === undefined || atRef.current) land(held, false, said)
        else setChoice({ kind: 'placing', element: held, create: false, said })
        return
      }
      case 'standIn': {
        const said = s('library.standsIn', { name: plan.element.name, scope: scopeLabel(plan.owner) })
        if (atRef.current) land(plan.element, true, said)
        else setChoice({ kind: 'placing', element: plan.element, create: true, said })
        return
      }
      case 'unowned':
        setChoice({ kind: 'asking', plan })
    }
  }, [activeBoard, session, scope, index, notify, s, land, scopeLabel])

  const own = useCallback(() => {
    if (choice?.kind !== 'asking') return
    land(choice.plan.own, true, s('library.owned', { name: choice.plan.name }))
  }, [choice, land, s])

  const drawOnly = useCallback(() => {
    if (choice?.kind !== 'asking' || !choice.plan.drawOnly) return
    const said = s('library.drawn', { name: choice.plan.name })
    if (atRef.current) land(choice.plan.drawOnly, true, said)
    else setChoice({ kind: 'placing', element: choice.plan.drawOnly, create: true, said })
  }, [choice, s, land])

  const place = useCallback((band: LibraryBand) => {
    if (choice?.kind !== 'placing') return
    land(choice.element, choice.create, choice.said, band)
  }, [choice, land])

  const shown = useMemo<LibraryChoice | undefined>(() => {
    if (!choice) return undefined
    if (choice.kind === 'picking') return choice
    if (choice.kind === 'placing') return { kind: 'placing', id: choice.element.id, name: choice.element.name }
    return {
      kind: 'asking', id: choice.plan.id, name: choice.plan.name,
      canDrawOnly: choice.plan.drawOnly !== undefined,
    }
  }, [choice])

  return useMemo(
    () => ({ open, choice: shown, pick, own, drawOnly, place, close }),
    [open, shown, pick, own, drawOnly, place, close],
  )
}
