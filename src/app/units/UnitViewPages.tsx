// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart and the Conway map in their tab (ADR-0036 §7,
 * ADR-0016): each page handed what the workspace holds — the index, the open
 * scope's session, the register — with the organisation worked out once per
 * change of those, not per render of the editor.
 */
import { useMemo } from 'react'
import type { ReactElement } from 'react'
import type { PageView } from '../../editor'
import type { DesignDiagram, ElementId } from '../../model/types'
import type { ScopePath } from '../../projects/scopePath'
import type { WorkspaceParts } from '../workspaceParts'
import { ChartPage } from './ChartPage'
import { ConwayPage } from './ConwayPage'
import { unitViewsHere } from './unitViewsHere'

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
    return (
      <ChartPage
        {...common} {...(select ? { select } : {})}
        assign={{ dispatch: session.dispatch, makeId: props.shell.makeId, scopeName }}
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
