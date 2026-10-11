// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart and the Conway map in their tab (ADR-0036 §7,
 * ADR-0016): each page handed what the workspace holds — the index, the open
 * scope's session, the register — with the organisation worked out once per
 * change of those, not per render of the editor. And what the inspector
 * beside a chart shows while the editor has nothing selected: the assignment
 * chosen on it (`AssignmentInspector`).
 */
import { useMemo } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import type { PageView } from '../../editor'
import type { DesignDiagram, ElementId } from '../../model/types'
import type { ScopePath } from '../../projects/scopePath'
import { lazyPart } from '../../widgets/lazyPart'
import type { WorkspaceParts } from '../workspaceParts'
import type { ChartPage as ChartPageShape } from './ChartPage'
import type { ConwayPage as ConwayPageShape } from './ConwayPage'
import type { AssignmentInspector as AssignmentInspectorShape } from './AssignmentInspector'
import { unitViewsHere } from './unitViewsHere'

/**
 * A chart and a Conway map are tabs, never the first view: each page arrives
 * when the first of its kind is opened (`widgets/lazyPart`), so the first
 * download does not carry them.
 */
const ChartPage = lazyPart<ComponentProps<typeof ChartPageShape>>(
  () => import('./ChartPage').then((held) => held.ChartPage),
)
const ConwayPage = lazyPart<ComponentProps<typeof ConwayPageShape>>(
  () => import('./ConwayPage').then((held) => held.ConwayPage),
)
/** An assignment in the inspector arrives with the first one chosen. */
const AssignmentInspector = lazyPart<ComponentProps<typeof AssignmentInspectorShape>>(
  () => import('./AssignmentInspector').then((held) => held.AssignmentInspector),
)

type Kind = 'chart' | 'conway'

export function unitViewPage(kind: Kind, parts: WorkspaceParts, diagram: DesignDiagram, view: PageView): ReactElement {
  return <UnitViewPage key={diagram.id} kind={kind} parts={parts} diagram={diagram} view={view} />
}

function UnitViewPage({ kind, parts, diagram, view }: { kind: Kind; parts: WorkspaceParts; diagram: DesignDiagram; view: PageView }) {
  const { props, session } = parts
  const index = props.tree.index
  const scope = props.project.path
  const model = session.model
  const here = useMemo(() => unitViewsHere(index, scope, model), [index, scope, model])
  const scopeName = parts.readings.scopeLabel(scope)
  const common = {
    diagram, here, today: parts.todayDay, readOnly: view.readOnly, people: props.shell.people, scopeLabel: parts.readings.scopeLabel,
    ...(view.selectedId !== undefined ? { selectedId: view.selectedId } : {}),
    onSelect: view.onSelect,
    // A unit or an application another scope keeps opens there, on its record.
    onOpenElsewhere: (where: ScopePath, id: ElementId) => parts.show({ scope: where, page: 'document', id }),
    onHandle: parts.renderer.onSheetHandle,
  }
  const select = parts.pages.selectRequestFor(diagram.id)
  if (kind === 'chart') {
    const { chosenOn, choose } = parts.pages.chartChoice
    const chosen = chosenOn(diagram.id)
    return (
      <ChartPage
        {...common} {...(select ? { select } : {})} {...(chosen !== undefined ? { chosen } : {})}
        onChoose={(assignmentId) => choose(diagram.id, assignmentId)}
        assign={{ dispatch: session.dispatch, makeId: props.shell.makeId, scopeName }}
        scope={scope} {...(props.shell.folds ? { folds: props.shell.folds } : {})} reorder={parts.landMoves}
      />
    )
  }
  return (
    <ConwayPage
      {...common} {...(select ? { select } : {})} index={index} scope={scope} model={model}
      declare={{ dispatch: session.dispatch, newRowId: () => session.ids.connection(), scopeName }}
    />
  )
}

/**
 * The inspector beside an organisation chart while the editor has nothing
 * selected: the assignment chosen on it, where it is still there — a removed
 * one leaves the inspector to say what it says with nothing chosen.
 */
export function unitViewInspector(parts: WorkspaceParts, diagram: DesignDiagram): ReactNode {
  if (diagram.kind !== 'chart') return undefined
  const { props, session } = parts
  const chosen = parts.pages.chartChoice.chosenOn(diagram.id)
  if (chosen === undefined || !(session.model.assignments ?? []).some((one) => one.id === chosen)) return undefined
  const onOpenPeople = props.navigation.onOpenPeople
  return (
    <AssignmentInspector
      key={chosen} assignmentId={chosen} diagram={diagram} index={props.tree.index} scope={props.project.path} model={session.model}
      today={parts.todayDay} readOnly={session.readOnly} people={props.shell.people} dispatch={session.dispatch} makeId={props.shell.makeId}
      scopeName={parts.readings.scopeLabel(props.project.path)} {...(onOpenPeople ? { onOpenPeople } : {})}
    />
  )
}
