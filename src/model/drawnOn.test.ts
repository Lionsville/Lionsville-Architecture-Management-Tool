import { describe, expect, it } from 'vitest'
import { boardsDrawing } from './drawnOn'
import type { DesignDiagram, DesignElement, DesignModel } from './types'

/**
 * Two landscapes over one model on two days, and an application with a day on
 * its retirement — the arrangement the shipped example has, and the one that
 * makes "show me this application" a question with more than one answer.
 */
const element = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})

const board = (id: string, members: string[], over: Partial<DesignDiagram> = {}): DesignDiagram => ({
  id,
  kind: 'layer7',
  name: id,
  members: members.map((at) => ({ id: at })),
  geometry: { nodes: [] },
  ...over,
})

const model = (over: Partial<DesignModel> = {}): DesignModel => ({
  name: 'Landscape',
  elements: [
    element('wms'),
    element('rater', { lifecycleDates: { retired: '2027-01-01' } }),
  ],
  relations: [],
  diagrams: [
    board('today', ['wms', 'rater']),
    board('later', ['wms', 'rater'], { asOf: '2027-06-01' }),
  ],
  ...over,
})

describe('boardsDrawing', () => {
  it('answers the boards whose members hold it in tab order, and leaves out the ones that do not', () => {
    expect(boardsDrawing(model(), 'wms', '2026-09-12').map((d) => d.id)).toEqual(['today', 'later'])
    const two = model({ diagrams: [board('one', ['wms']), board('two', ['rater'])] })
    expect(boardsDrawing(two, 'rater', '2026-09-12').map((d) => d.id)).toEqual(['two'])
    const sheet = model({
      diagrams: [{ ...board('sh', ['wms']), kind: 'sheet' as const }],
    })
    expect(boardsDrawing(sheet, 'wms', '2026-09-12')).toEqual([])
    expect(boardsDrawing(model(), 'gone', '2026-09-12')).toEqual([])
  })

  it('leaves out a board dated after the element is gone, reads no date as today, draws a retirement to come', () => {
    // The board holds it; its day does not draw it, which is the case a
    // caller that only asked about membership lands a person on.
    expect(boardsDrawing(model(), 'rater', '2026-09-12').map((d) => d.id)).toEqual(['today'])
    expect(boardsDrawing(model(), 'rater', '2027-03-01')).toEqual([])
    const soon = model({ diagrams: [board('soon', ['rater'], { asOf: '2026-12-31' })] })
    expect(boardsDrawing(soon, 'rater', '2026-09-12').map((d) => d.id)).toEqual(['soon'])
  })

})
