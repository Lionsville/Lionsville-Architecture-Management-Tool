// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignElement } from '../model/types';
import { useRenameFocus, useTabPerElement, useUsesPicker } from './useInspectorState';

describe('the inspector tab', () => {
  it('goes back to the first tab when another element is selected, and keeps it otherwise', () => {
    const view = renderHook(({ id }) => useTabPerElement(id), { initialProps: { id: 'a' } });
    act(() => view.result.current[1](2));
    view.rerender({ id: 'a' });
    expect(view.result.current[0]).toBe(2);
    view.rerender({ id: 'b' });
    expect(view.result.current[0]).toBe(0);
  });
});

describe('a rename request', () => {
  function mount(readOnly = false) {
    const input = document.createElement('input');
    input.value = 'Webshop';
    document.body.appendChild(input);
    const focus = vi.spyOn(input, 'focus');
    const view = renderHook(
      ({ request, id }) => {
        const ref = useRenameFocus(request, id, readOnly);
        ref.current = input;
        return ref;
      },
      { initialProps: { request: undefined as { id: string; nonce: number } | undefined, id: 'a' } },
    );
    return { view, focus };
  }

  it('focuses the name once per nonce, and only for its own element', () => {
    const { view, focus } = mount();
    view.rerender({ request: { id: 'b', nonce: 1 }, id: 'a' });
    expect(focus).not.toHaveBeenCalled();
    view.rerender({ request: { id: 'a', nonce: 2 }, id: 'a' });
    expect(focus).toHaveBeenCalledTimes(1);
    view.rerender({ request: { id: 'a', nonce: 2 }, id: 'a' });
    expect(focus).toHaveBeenCalledTimes(1);
    view.rerender({ request: { id: 'a', nonce: 3 }, id: 'a' });
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it('takes the request on a read-only panel without moving the caret', () => {
    const { view, focus } = mount(true);
    view.rerender({ request: { id: 'a', nonce: 1 }, id: 'a' });
    expect(focus).not.toHaveBeenCalled();
  });
});

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
