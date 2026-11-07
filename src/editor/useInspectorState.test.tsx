// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignElement } from '../model/types';
import { useUsesPicker } from './useInspectorState';

describe('the Uses picker', () => {
  const standIn: DesignElement = {
    id: 'far', kind: 'platformService', name: 'Far', lifecycle: 'live', isManaged: false, aspects: {}, ref: 'x/far',
  };

  function mount(usesIds: string[] = ['s']) {
    const setUses = vi.fn(() => ({ refused: [] }));
    const technology = { elsewhere: [], standInFor: (id: string) => (id === 'far' ? standIn : undefined) };
    const view = renderHook(
      ({ elementId, ids }) => useUsesPicker(elementId, ids, new Set(['a', 's', 't']), technology, { setUses }),
      { initialProps: { elementId: 'a', ids: usesIds } },
    );
    return { view, setUses };
  }

  it('writes nothing when the picker closes on the list it opened on, in any order', () => {
    const { view, setUses } = mount(['s', 't']);
    act(() => view.result.current.setPending(['t', 's']));
    act(() => view.result.current.commit());
    expect(setUses).not.toHaveBeenCalled();
  });

  it('writes the ticks as one step when it closes, with no stand-in for what this scope holds', () => {
    const { view, setUses } = mount();
    act(() => view.result.current.setPending(['s', 't']));
    act(() => view.result.current.commit());
    expect(setUses).toHaveBeenCalledTimes(1);
    expect(setUses).toHaveBeenCalledWith('a', ['s', 't']);
  });

  it('writes the stand-in for a tick on something another scope offers', () => {
    const { view, setUses } = mount();
    act(() => view.result.current.setPending(['s', 'far']));
    act(() => view.result.current.commit());
    expect(setUses).toHaveBeenCalledWith('a', ['s', 'far'], [standIn]);
  });

  it('writes what is still ticked when it goes away without closing', () => {
    // Escape on the canvas used to clear the selection and take the inspector
    // away before the list said it closed; the ticks went with it.
    const { view, setUses } = mount();
    act(() => view.result.current.setPending(['s', 't']));
    view.unmount();
    expect(setUses).toHaveBeenCalledTimes(1);
    expect(setUses).toHaveBeenCalledWith('a', ['s', 't']);
  });

  it('writes nothing on the way out when nothing is pending', () => {
    const { view, setUses } = mount();
    view.unmount();
    expect(setUses).not.toHaveBeenCalled();
  });

  it('writes once when two doors close in the same event', () => {
    // The list closing and the focus leaving arrive together on a blur.
    const { view, setUses } = mount();
    act(() => view.result.current.setPending(['s', 't']));
    act(() => {
      view.result.current.commit();
      view.result.current.commit();
    });
    view.unmount();
    expect(setUses).toHaveBeenCalledTimes(1);
  });

  it('follows the rows when the element or its rows change underneath', () => {
    const { view } = mount();
    act(() => view.result.current.setPending(['s', 't']));
    view.rerender({ elementId: 'a', ids: ['t'] });
    expect(view.result.current.pending).toEqual(['t']);
    act(() => view.result.current.setPending(['s']));
    view.rerender({ elementId: 'b', ids: ['t'] });
    expect(view.result.current.pending).toEqual(['t']);
  });
});
