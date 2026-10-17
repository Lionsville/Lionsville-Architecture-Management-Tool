// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart and the Conway map in their tab (ADR-0036 §7,
 * ADR-0016): each page handed what the workspace holds — the index, the open
 * scope's session, the register — with the organisation worked out once per
 * change of those, not per render of the editor. And what the inspector
 * beside a chart shows while the editor has nothing selected: the assignment
 * chosen on it (`AssignmentInspector`), or — with none chosen — what the
 * chart says as a whole (`ChartSummary`, 3.6.1).
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
import type { ChartSummary as ChartSummaryShape } from './ChartSummary'
import { unitViewsHere } from './unitViewsHere'
import type { UnitMaking } from './useNewUnit'
import { flattenScopes } from '../../projects/scope'
import { ROOT_SCOPE } from '../../projects/scopePath'

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
/** The chart's summary arrives with the first chart whose inspector is open with nothing picked. */
const ChartSummary = lazyPart<ComponentProps<typeof ChartSummaryShape>>(
  () => import('./ChartSummary').then((held) => held.ChartSummary),
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
    // A unit or an application another scope keeps opens there: a unit on
    // that scope's chart, selected, with its inspector; an application on its
    // record. By opening that scope — `parts.show` shows a page of the scope
    // already open, and selected there an id this scope does not hold.
    onOpenElsewhere: (where: ScopePath, id: ElementId) =>
      props.navigation.onOpenScope?.(where, here.at.unitAt(id) ? { page: 'element', id } : { page: 'document', id }),
    onHandle: parts.renderer.onSheetHandle,
  }
  const select = parts.pages.selectRequestFor(diagram.id)
  const onOpenScope = props.navigation.onOpenScope
  const scopes = props.tree.scopes
  const { writeIn, writable } = parts.unitWrites
  // A unit made on the chart (3.6.2): the session's step where it is filed here, another scope's step elsewhere.
  const make = useMemo<UnitMaking>(() => ({
    scopes: flattenScopes(scopes).map((one) => one.path), writable, dispatch: session.dispatch, writeIn,
    newId: (name) => session.ids.element(name),
    onOpenOperating: () => (scope === ROOT_SCOPE ? parts.pages.openOperating() : onOpenScope?.(ROOT_SCOPE, { page: 'operating' })),
  }), [scopes, writable, session.dispatch, session.ids, writeIn, scope, parts.pages.openOperating, onOpenScope])
  if (kind === 'chart') {
    const { chosenOn, choose } = parts.pages.chartChoice
    const chosen = chosenOn(diagram.id)
    return (
      <ChartPage
        {...common} {...(select ? { select } : {})} {...(chosen !== undefined ? { chosen } : {})}
        onChoose={(assignmentId) => choose(diagram.id, assignmentId)}
        assign={{ dispatch: session.dispatch, makeId: props.shell.makeId, scopeName }}
        scope={scope} {...(props.shell.folds ? { folds: props.shell.folds } : {})} reorder={parts.landMoves}
        make={make}
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
 * selected: the assignment chosen on it, where it is still there; otherwise —
 * nothing chosen, or a removed one — the chart's own summary, whose findings
 * go to their units on the chart as a request from outside does.
 */
export function unitViewInspector(parts: WorkspaceParts, diagram: DesignDiagram): ReactNode {
  if (diagram.kind !== 'chart') return undefined
  return <ChartInspector parts={parts} diagram={diagram} />
}

/**
 * The assignment chosen — kept in this scope, or in another the chart draws
 * a unit of, which it is read from and opened in — or the chart's summary.
 */
function ChartInspector({ parts, diagram }: { parts: WorkspaceParts; diagram: DesignDiagram }) {
  const { props, session } = parts
  const chosen = parts.pages.chartChoice.chosenOn(diagram.id)
  const onOpenPeople = props.navigation.onOpenPeople
  const index = props.tree.index
  const scope = props.project.path
  const model = session.model
  const here = useMemo(() => unitViewsHere(index, scope, model), [index, scope, model])
  const held = chosen === undefined ? undefined : here.at.organisation.assignments.find((one) => one.id === chosen)
  if (!held) {
    return (
      <ChartSummary
        diagram={diagram} index={index} scope={scope} model={model} today={parts.todayDay}
        scopeLabel={parts.readings.scopeLabel} onGoTo={(unitId) => parts.pages.selectOn(diagram.id, unitId)} onOpenPeople={onOpenPeople}
      />
    )
  }
  // One kept in another scope is read here and changed there: the inspector says where, and opens it there on request.
  const keptHere = (model.assignments ?? []).some((one) => one.id === held.id)
  const keptIn = keptHere ? undefined : here.scopeOf(held.unitId)
  const onOpenScope = props.navigation.onOpenScope
  return (
    <AssignmentInspector
      key={held.id} assignmentId={held.id} diagram={diagram} index={index} scope={scope} model={model}
      today={parts.todayDay} readOnly={session.readOnly || !keptHere} people={props.shell.people} dispatch={session.dispatch} makeId={props.shell.makeId}
      scopeName={parts.readings.scopeLabel(scope)} {...(onOpenPeople ? { onOpenPeople } : {})}
      {...(keptIn !== undefined ? {
        keptIn: { name: parts.readings.scopeLabel(keptIn), ...(onOpenScope ? { open: () => onOpenScope(keptIn, { page: 'element', id: held.unitId }) } : {}) },
      } : {})}
    />
  )
}
