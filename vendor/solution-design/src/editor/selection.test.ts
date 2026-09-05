import { describe, expect, it } from 'vitest';
import {
  EMPTY_SELECTION,
  isSelectionEmpty,
  mirrorGraphSelection,
  selectConnection,
  selectDomainGroup,
  selectElement,
  selectionCount,
  selectionEquals,
} from './useEditorState';

describe('selection helpers (U2)', () => {
  it('EMPTY_SELECTION is empty', () => {
    expect(isSelectionEmpty(EMPTY_SELECTION)).toBe(true);
    expect(selectionCount(EMPTY_SELECTION)).toBe(0);
  });

  it('selectElement holds exactly one element', () => {
    const s = selectElement('a1');
    expect(s).toEqual({ elementIds: ['a1'], connectionIds: [], domainGroups: [] });
    expect(selectionCount(s)).toBe(1);
    expect(isSelectionEmpty(s)).toBe(false);
  });

  it('selectConnection holds exactly one connection', () => {
    const s = selectConnection('c1');
    expect(s).toEqual({ elementIds: [], connectionIds: ['c1'], domainGroups: [] });
    expect(selectionCount(s)).toBe(1);
  });

  it('selectDomainGroup holds exactly one group, and counts as a selection', () => {
    const s = selectDomainGroup('Core');
    expect(s).toEqual({ elementIds: [], connectionIds: [], domainGroups: ['Core'] });
    expect(selectionCount(s)).toBe(1);
    // Gates the Delete/cut shortcuts (`when: !readOnly && hasSelection`).
    expect(isSelectionEmpty(s)).toBe(false);
  });

  it('selectionCount sums all three id spaces', () => {
    expect(
      selectionCount({ elementIds: ['a1', 'a2'], connectionIds: ['c1'], domainGroups: ['Core'] }),
    ).toBe(4);
  });
});

describe('selectionEquals — the render-loop guard', () => {
  it('treats two empty selections as equal (regression: empty re-fire loop)', () => {
    expect(
      selectionEquals(EMPTY_SELECTION, { elementIds: [], connectionIds: [], domainGroups: [] }),
    ).toBe(true);
  });

  it('is order-independent', () => {
    expect(
      selectionEquals(
        { elementIds: ['a1', 'a2'], connectionIds: ['c1'], domainGroups: [] },
        { elementIds: ['a2', 'a1'], connectionIds: ['c1'], domainGroups: [] },
      ),
    ).toBe(true);
  });

  it('detects a genuine change', () => {
    expect(selectionEquals(selectElement('a1'), selectElement('a2'))).toBe(false);
    expect(
      selectionEquals(selectElement('a1'), {
        elementIds: ['a1'],
        connectionIds: ['c1'],
        domainGroups: [],
      }),
    ).toBe(false);
  });

  it('detects a group-only change (else a selected group could never re-render)', () => {
    expect(selectionEquals(selectDomainGroup('Core'), EMPTY_SELECTION)).toBe(false);
    expect(selectionEquals(selectDomainGroup('Core'), selectDomainGroup('Edge'))).toBe(false);
  });
});

describe('mirrorGraphSelection — folding React Flow’s selection into ours', () => {
  it('takes React Flow’s nodes and edges verbatim', () => {
    expect(mirrorGraphSelection(EMPTY_SELECTION, ['a1', 'a2'], ['c1'])).toEqual({
      elementIds: ['a1', 'a2'],
      connectionIds: ['c1'],
      domainGroups: [],
    });
  });

  it('clears the selected groups when a node or edge is picked', () => {
    expect(mirrorGraphSelection(selectDomainGroup('Core'), ['a1'], [])).toEqual(selectElement('a1'));
    expect(mirrorGraphSelection(selectDomainGroup('Core'), [], ['c1'])).toEqual(
      selectConnection('c1'),
    );
  });

  it('KEEPS the selected groups on an empty fire', () => {
    // React Flow resets its own selection right after every pane click. Folding
    // that in as "nothing is selected" would deselect the group the click had
    // just selected, one tick later.
    expect(mirrorGraphSelection(selectDomainGroup('Core'), [], [])).toEqual(
      selectDomainGroup('Core'),
    );
    // …and the result must compare EQUAL to the current selection, or the
    // canvas would emit it and feed the re-render → re-fire loop.
    expect(
      selectionEquals(
        mirrorGraphSelection(selectDomainGroup('Core'), [], []),
        selectDomainGroup('Core'),
      ),
    ).toBe(true);
  });
});
