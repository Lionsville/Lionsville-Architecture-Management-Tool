// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The editor body's hooks that hold state, each mounted alone: when the view
 * settings are reported, which deletes stop for a question, where a page
 * opens, and what a reader's choice on a board writes.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createTheme } from '@mui/material/styles';
import { laidOut } from '../model/testFixtures';
import type { DesignModel } from '../model/types';
import type { EditorActions, EditorState } from './useEditorState';
import { useViewSettings } from './useViewSettings';
import { useDeleteRequests } from './useDeleteRequests';
import { useDocumentation } from './useEditorRequests';
import { useBoardView } from './useBoardView';

function model(): DesignModel {
  return {
    name: 'M',
    diagrams: [laidOut({ id: 'd1', kind: 'container', name: 'C', applicationElementId: 'a', placements: [] })],
    elements: [
      { id: 'a', kind: 'application', name: 'A', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'b', kind: 'application', name: 'B', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'far', kind: 'application', name: 'Far', lifecycle: 'live', isManaged: true, aspects: {}, ref: 'x/far' },
    ],
    relations: [
      { id: 'r1', type: 'flow', sourceId: 'a', targetId: 'b' } as never,
      { id: 'r2', type: 'flow', sourceId: 'a', targetId: 'b', refines: 'r1' } as never,
      { id: 'r3', type: 'flow', sourceId: 'b', targetId: 'a' } as never,
    ],
  };
}

function actions() {
  return { deleteConnection: vi.fn(), deleteSelection: vi.fn(), setShowDeployment: vi.fn(), setColourBy: vi.fn() };
}

describe('the view settings', () => {
  it('are reported on a real change and not on mount or an unchanged render', () => {
    const onChange = vi.fn();
    const view = renderHook(() => useViewSettings({ initial: { showMinimap: true }, onChange }));
    expect(view.result.current.showMinimap).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    view.rerender();
    expect(onChange).not.toHaveBeenCalled();
    const before = view.result.current.showGrid;
    act(() => view.result.current.setShowGrid((on) => !on));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ showGrid: !before, showMinimap: true });
    act(() => view.result.current.setPaletteWidth(view.result.current.paletteWidth));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('are kept without a host to tell', () => {
    const view = renderHook(() => useViewSettings(undefined));
    act(() => view.result.current.setShowLifecycle(false));
    expect(view.result.current.showLifecycle).toBe(false);
  });
});

describe('the deletes worth stopping for', () => {
  function mount(readOnly = false) {
    const a = actions();
    const state = { model: model(), actions: a as unknown as EditorActions };
    const view = renderHook(() => useDeleteRequests(state, state.model.diagrams[0], readOnly));
    return { view, a };
  }

  it('asks before a connection goes, and offers its landings as a second answer', () => {
    const { view, a } = mount();
    act(() => view.result.current.requestDeleteConnection('r1'));
    const asked = view.result.current.confirmDelete;
    expect(asked?.landings).toBe(1);
    expect(a.deleteConnection).not.toHaveBeenCalled();
    asked?.runWithLandings?.();
    expect(a.deleteSelection).toHaveBeenCalledWith({ elementIds: [], connectionIds: ['r1', 'r2'], domainGroups: [] });
    asked?.run();
    expect(a.deleteConnection).toHaveBeenCalledWith('r1');
  });

  it('asks one question for a connection nothing landed on', () => {
    const { view } = mount();
    act(() => view.result.current.requestDeleteConnection('r3'));
    expect(view.result.current.confirmDelete?.landings).toBeUndefined();
    expect(view.result.current.confirmDelete?.runWithLandings).toBeUndefined();
  });

  it('deletes one element straight away and asks before two', () => {
    const { view, a } = mount();
    act(() => view.result.current.requestDeleteSelection({ elementIds: ['b'], connectionIds: [], domainGroups: [] }));
    expect(a.deleteSelection).toHaveBeenCalledTimes(1);
    expect(view.result.current.confirmDelete).toBeUndefined();
    act(() => view.result.current.requestDeleteSelection({ elementIds: ['b', 'far'], connectionIds: [], domainGroups: [] }));
    expect(a.deleteSelection).toHaveBeenCalledTimes(1);
    expect(view.result.current.confirmDelete?.summary.elements).toBe(2);
  });

  it('does nothing on a read-only board', () => {
    const { view, a } = mount(true);
    act(() => view.result.current.requestDeleteConnection('r3'));
    act(() => view.result.current.requestDeleteSelection({ elementIds: ['b'], connectionIds: [], domainGroups: [] }));
    expect(view.result.current.confirmDelete).toBeUndefined();
    expect(a.deleteSelection).not.toHaveBeenCalled();
  });
});

describe('the documentation page', () => {
  function mount(onDocument = vi.fn()) {
    const setSelection = vi.fn();
    const state = { model: model(), setSelection, selectedElement: undefined } as unknown as EditorState;
    const ownership = { ownerOf: (id: string) => (id === 'far' ? { onDocument } : undefined) } as never;
    const view = renderHook(() => useDocumentation({ ownership }, state, state.model.diagrams[0]));
    return { view, setSelection, onDocument };
  }

  it('opens an element’s page and selects it, on the active board', () => {
    const { view, setSelection } = mount();
    act(() => view.result.current.open('a'));
    expect(view.result.current.element?.id).toBe('a');
    expect(view.result.current.diagram?.id).toBe('d1');
    expect(setSelection).toHaveBeenCalled();
    act(() => view.result.current.close());
    expect(view.result.current.element).toBeUndefined();
  });

  it('sends a stand-in’s page to its owner rather than opening one here', () => {
    const { view, setSelection, onDocument } = mount();
    act(() => view.result.current.open('far'));
    expect(onDocument).toHaveBeenCalledTimes(1);
    expect(view.result.current.element).toBeUndefined();
    expect(setSelection).not.toHaveBeenCalled();
  });
});

describe('what a reader’s choice on a board writes', () => {
  it('flips the deployment boxes for this board and writes the flip', () => {
    const a = actions();
    const m = model();
    const view = renderHook(() => useBoardView({
      model: m, diagram: m.diagrams[0], viewing: undefined, platformTree: undefined, theme: createTheme(), actions: a,
    }));
    expect(view.result.current.showDeployment).toBe(true);
    act(() => view.result.current.toggleDeployment());
    expect(view.result.current.showDeployment).toBe(false);
    expect(a.setShowDeployment).toHaveBeenCalledWith(false);
    act(() => view.result.current.chooseColourBy(undefined));
    expect(view.result.current.colourBy).toBeUndefined();
    expect(a.setColourBy).toHaveBeenCalledWith(undefined);
  });
});
