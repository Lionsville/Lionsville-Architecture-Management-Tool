// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the workspace hands a drawing, and the question of what view to make next.
 * Beside the editor rather than in it because the drawing's own screen arrives
 * with its first tab, and the question has to be up before any drawing exists.
 */
import { useMemo } from 'react'
import type { Destination } from '../agent/screen'
import type { PageView } from '../editor'
import type { Translate } from '../i18n'
import { kindLabel } from '../model/kinds'
import type { DesignDiagram, ElementKind } from '../model'
import type { StringKey } from '../i18n'
import { DESKTOP_APP_LINK } from '../platform/menu'
import { MORE_PLACES, ORGANISATION_PLACES, SCOPE_PLACES } from './frame/places'
import type { DrawingViewProps } from './DrawingView'
import { NewViewDialog } from './NewViewDialog'
import { printDocument } from './savePicture'
import { unitLanding } from './units/unitViewsHere'
import type { WorkspaceParts } from './workspaceParts'

/** Many of a kind, as the palette's groups head them. */
const MANY: Partial<Record<string, StringKey>> = {
  application: 'drawing.manyApplications', function: 'drawing.manyFunctions', actor: 'drawing.manyActors', step: 'drawing.manySteps',
  process: 'drawing.manyProcesses', component: 'drawing.manyComponents', platform: 'drawing.manyPlatforms', platformService: 'drawing.manyPlatformServices',
}

/** Where a move out of an editor is going, in the words the place goes by. */
export function whereToWord(to: Destination, diagrams: readonly DesignDiagram[], s: Translate): string | undefined {
  if (to.id !== undefined) {
    const view = diagrams.find((one) => one.id === to.id)
    if (view) return view.name
  }
  if (to.page === 'home') return s('frame.home')
  const place = [...SCOPE_PLACES, ...ORGANISATION_PLACES, ...MORE_PLACES].find((one) => one.page === to.page)
  return place ? s(place.label) : undefined
}

export function drawingViewProps(
  parts: Pick<WorkspaceParts, 'props' | 'session' | 'show'> & Partial<Pick<WorkspaceParts, 'pages' | 'files'>>,
  diagram: DesignDiagram,
  view: Pick<PageView, 'readOnly'>,
): DrawingViewProps {
  const { props, session, show, pages, files } = parts
  const { s, language } = props.shell
  const translate = s as Parameters<typeof kindLabel>[1]
  const drawings = pages?.drawings
  const kindWord = (kind: string | undefined) => (kind ? kindLabel(kind as ElementKind, translate) : '')
  return {
    diagram,
    scope: props.project.id,
    images: props.source.repositories.images,
    elements: session.model.elements.map((element) => ({ id: element.id, name: element.name, kind: element.kind, ...(element.description ? { description: element.description } : {}) })),
    diagrams: session.model.diagrams,
    ...(props.shell.drawingOrigin ? { origin: props.shell.drawingOrigin } : {}),
    language,
    readOnly: view.readOnly,
    dispatch: session.dispatch,
    documents: props.files.documents,
    ...(files ? { print: (doc) => printDocument({ props, files }, doc, 'drawingPrint') } : {}),
    diagnostics: props.host.diagnostics,
    notify: props.shell.notify,
    // A box that points at a unit opens it on the scope's chart, where there is one (ADR-0036 §7).
    onOpen: (to) => show({ ...to, ...unitLanding(session.model, to), scope: props.project.path }),
    s,
    kindWord,
    kindGroup: (kind, count) => s('drawing.groupCount', { kind: MANY[kind] ? s(MANY[kind]) : kindWord(kind) || s('drawing.manyOthers'), count }),
    whereTo: (to) => whereToWord(to, session.model.diagrams, s),
    onGetDesktop: () => props.host.controls.openExternal(DESKTOP_APP_LINK.href),
    ...(drawings
      ? {
          editing: drawings.editing === diagram.id,
          onEditing: (editing: boolean) => drawings.setEditing(editing ? diagram.id : undefined),
          onNewView: drawings.chooseView,
          onOpenView: pages.openView,
        }
      : {}),
  }
}

/** The question itself, for a scope that is open: its elements, and how each kind is made here. */
export function NewViewFor({ parts }: { parts: WorkspaceParts }) {
  const { pages, sheets, session, props, diagrams } = parts
  const { asking, stopAsking, make } = pages.drawings
  const { s } = props.shell
  const elements = useMemo(
    () => (asking ? session.model.elements.map((element) => ({ id: element.id, name: element.name })) : []),
    [asking, session.model.elements],
  )
  return (
    <NewViewDialog
      open={asking !== undefined} naming={asking?.naming ?? false} {...(asking?.about ? { about: asking.about } : {})} elements={elements}
      canDraw={Boolean(props.shell.drawingOrigin?.())} onClose={stopAsking}
      make={{
        landscape: diagrams.onCreateLayer7Diagram, sheet: sheets.create, map: pages.createMap, technology: pages.createTechnology,
        chart: () => pages.createUnitView('chart'), conway: () => pages.createUnitView('conway'),
      }}
      onMakeDrawing={make} s={s}
    />
  )
}
