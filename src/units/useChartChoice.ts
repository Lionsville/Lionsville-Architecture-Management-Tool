// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The assignment chosen on an organisation chart (ADR-0036 §7).
 *
 * A person's chip on the chart chooses their assignment, and the inspector
 * docked beside the chart shows it — who, the role and the unit, its days and
 * its share, and the way to end it. An assignment is not an element, so it is
 * not the editor's selection: it is chosen here, by the workspace, because two
 * places read it — the chart marks the chip, and the inspector draws it — and
 * the editor that draws both knows nothing of assignments. It is the
 * inspector's while the editor has nothing selected: choosing a unit, or
 * anything, lets it go (`ChartPage`).
 *
 * One choice for the workspace, on the chart it was made on, so another chart
 * — another tab, the same scope — chooses nothing.
 */
import { useCallback, useMemo, useState } from 'react'

/** An assignment chosen on one chart. */
export type ChartChoice = { diagramId: string; assignmentId: string }

export type ChartChoosing = {
  /** The assignment chosen on this chart, where one is. */
  chosenOn: (diagramId: string) => string | undefined
  /** Choose one on a chart; nothing lets the choice go. */
  choose: (diagramId: string, assignmentId: string | undefined) => void
  /** A unit a press outside the chart asked it to move, which its panel then opens for. */
  moveAskedOn: (diagramId: string) => { unitId: string; nonce: number } | undefined
  askMove: (diagramId: string, unitId: string) => void
}

export function useChartChoice(): ChartChoosing {
  const [chosen, setChosen] = useState<ChartChoice | undefined>(undefined)
  const chosenOn = useCallback((diagramId: string) => (chosen?.diagramId === diagramId ? chosen.assignmentId : undefined), [chosen])
  const choose = useCallback((diagramId: string, assignmentId: string | undefined) => {
    setChosen((was) => {
      if (assignmentId === undefined) return was?.diagramId === diagramId ? undefined : was
      return was?.diagramId === diagramId && was.assignmentId === assignmentId ? was : { diagramId, assignmentId }
    })
  }, [])
  const [asked, setAsked] = useState<{ diagramId: string; unitId: string; nonce: number } | undefined>(undefined)
  const moveAskedOn = useCallback((diagramId: string) => (asked?.diagramId === diagramId ? { unitId: asked.unitId, nonce: asked.nonce } : undefined), [asked])
  const askMove = useCallback((diagramId: string, unitId: string) => setAsked((was) => ({ diagramId, unitId, nonce: (was?.nonce ?? 0) + 1 })), [])
  return useMemo(() => ({ chosenOn, choose, moveAskedOn, askMove }), [chosenOn, choose, moveAskedOn, askMove])
}
