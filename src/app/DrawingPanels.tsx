// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two panels beside a drawing: what it points at, as a list that says which
 * links have gone wrong without opening Checks, and the element a pressed shape
 * points at, read in place so the picture does not move.
 *
 * A drawing keeps labels as they were saved and the model keeps names as they
 * are, so a picture falling behind a rename is something this can see and say.
 */
import type { Translate } from '../i18n'
import { drawingsAnchoredTo, drawingsPointingAt } from '../model/drawing'
import type { DrawnShape } from '../model/drawing'
import type { DesignDiagram, DrawingLink } from '../model'
import { Button } from '../widgets/kit/Button'
import { Panel, PanelSection } from '../widgets/kit/Panel'
import type { PaletteElement } from './drawingProtocol'

/** An element as a reader sees it: the palette's, and what it is about. */
export type ReadElement = PaletteElement & { description?: string }

export type LinkState = 'inStep' | 'stale' | 'missing'

/** One link, and how it stands to the model. */
export type LinkFact = {
  link: DrawingLink
  state: LinkState
  /** What to call it: the element's name, or the words on the shape where it is gone. */
  name: string
  /** What the picture says, where that is not the name. */
  says?: string
}

export function linkFacts(links: readonly DrawingLink[], shapes: readonly DrawnShape[], elements: readonly ReadElement[]): LinkFact[] {
  return links.map((link) => {
    const element = elements.find((one) => one.id === link.elementId)
    const label = shapes.find((shape) => shape.shapeId === link.shapeId)?.label ?? ''
    if (!element) return { link, state: 'missing', name: label || link.elementId }
    if (label !== '' && label !== element.name) return { link, state: 'stale', name: element.name, says: label }
    return { link, state: 'inStep', name: element.name }
  })
}

export function DrawingLinksPanel({ facts, shapes, canEdit, onEdit, onRead, onClose, s }: {
  facts: readonly LinkFact[]
  shapes: readonly DrawnShape[]
  canEdit: boolean
  onEdit: () => void
  onRead: (elementId: string) => void
  onClose: () => void
  s: Translate
}) {
  const trouble = facts.filter((fact) => fact.state !== 'inStep')
  const inStep = facts.filter((fact) => fact.state === 'inStep')
  const onlyDrawn = shapes.filter((shape) => shape.elementId === undefined && shape.label !== '')
  return (
    <div className="drawing-view__panel" data-testid="drawing-links-panel">
      <Panel kind={s('drawing.linksKind')} name={s('drawing.linksTitle')} onClose={onClose} {...(canEdit ? { helpLink: { label: s('drawing.edit'), onPress: onEdit } } : {})}>
        {trouble.length > 0 && (
          <PanelSection title={s('drawing.needsLook', { count: trouble.length })}>
            {trouble.map((fact) => (
              <div key={fact.link.shapeId} className="drawing-view__trouble" data-testid={`drawing-trouble-${fact.link.shapeId}`}>
                <strong>{fact.name}</strong>
                <span>{fact.state === 'missing' ? s('drawing.goneHere') : s('drawing.stale', { label: fact.says ?? '' })}</span>
                {fact.state === 'stale' && <Button variant="quiet" size="small" onClick={() => onRead(fact.link.elementId)}>{s('drawing.read')}</Button>}
              </div>
            ))}
          </PanelSection>
        )}
        {inStep.length > 0 && (
          <PanelSection title={s('drawing.inStep', { count: inStep.length })}>
            {inStep.map((fact) => (
              <Button key={fact.link.shapeId} variant="quiet" size="small" onClick={() => onRead(fact.link.elementId)} data-testid={`drawing-link-${fact.link.shapeId}`}>{fact.name}</Button>
            ))}
          </PanelSection>
        )}
        {onlyDrawn.length > 0 && (
          <PanelSection title={s('drawing.onlyDrawn', { count: onlyDrawn.length })}>
            <p>{s('drawing.onlyDrawnBody', { names: onlyDrawn.map((shape) => shape.label).join(', ') })}</p>
          </PanelSection>
        )}
      </Panel>
    </div>
  )
}

export function ElementReader({ element, diagrams, kindWord, onClose, onOpenPage, onOpenView, s }: {
  element: ReadElement
  diagrams: readonly DesignDiagram[]
  kindWord: ((kind: string | undefined) => string) | undefined
  onClose: () => void
  onOpenPage: (id: string) => void
  onOpenView: ((id: string) => void) | undefined
  s: Translate
}) {
  const on = drawingsPointingAt(diagrams, element.id).map((one) => ({ id: one.id, name: one.name }))
  const about = drawingsAnchoredTo(diagrams, element.id)
  const list = (title: string, views: readonly { id: string; name: string }[]) => views.length > 0 && (
    <PanelSection title={title}>
      {views.map((view) => <Button key={view.id} variant="quiet" size="small" onClick={() => onOpenView?.(view.id)}>{view.name}</Button>)}
    </PanelSection>
  )
  return (
    <div className="drawing-view__panel" data-testid="drawing-reader">
      <Panel
        kind={kindWord?.(element.kind) ?? s('drawing.linksKind')} name={element.name} onClose={onClose} help={s('drawing.readerNote')}
        actions={<Button variant="plain" size="small" onClick={() => onOpenPage(element.id)} data-testid="drawing-reader-open" data-guide="drawing.openPage">{s('drawing.openPage')}</Button>}
      >
        {element.description && <p data-testid="drawing-reader-description">{element.description}</p>}
        {list(s('drawing.shownOn'), on)}
        {list(s('drawing.aboutThis'), about)}
      </Panel>
    </div>
  )
}
