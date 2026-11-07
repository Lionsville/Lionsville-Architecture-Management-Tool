// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { laidOut } from '../model/testFixtures';
import type { DesignDiagram } from '../model/types';
import { AddPicker, addableKinds, useAddRequests, type AddRequest } from './AddPicker';
import type { EditorParts } from './editorParts';

afterEach(cleanup);

const board: DesignDiagram = laidOut({ id: 'b', kind: 'layer7', name: 'B', placements: [] });

function Harness({ request, partsOver }: { request: AddRequest; partsOver: { actions: object; ownership?: object } }) {
  const adding = useAddRequests();
  useEffect(() => adding.ask(request), []);
  const [diagram] = useState(board);
  const parts = {
    adding,
    state: { actions: partsOver.actions },
    props: { ownership: partsOver.ownership },
  } as unknown as EditorParts;
  return <AddPicker parts={parts} diagram={diagram} />;
}

const field = () => screen.getByRole('combobox');
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });

describe('adding where the person is looking', () => {
  it('names something new, of the kind asked for, where it was asked for', () => {
    const addElement = vi.fn();
    const at = { position: { x: 5, y: 6 }, zone: 'landscape' as const };
    render(<Harness request={{ screen: { x: 0, y: 0 }, kind: 'application', at }} partsOver={{ actions: { addElement } }} />);
    type('Claims');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(addElement).toHaveBeenCalledWith({ kind: 'application', name: 'Claims', ...at });
  });

  it('makes it arrive connected when a line was in hand', () => {
    const addElement = vi.fn();
    render(<Harness request={{ screen: { x: 0, y: 0 }, connectFrom: 'billing' }} partsOver={{ actions: { addElement } }} />);
    type('Claims');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(addElement).toHaveBeenCalledWith(expect.objectContaining({ connectFrom: 'billing' }));
  });

  it('changes what a new one would be with Tab', () => {
    const addElement = vi.fn();
    render(<Harness request={{ screen: { x: 0, y: 0 } }} partsOver={{ actions: { addElement } }} />);
    const first = addableKinds(board)[0];
    fireEvent.keyDown(field(), { key: 'Tab' });
    type('Support');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(addElement.mock.calls[0][0].kind).toBe(addableKinds(board)[1]);
    expect(first).not.toBe(addableKinds(board)[1]);
  });

  it('lists what exists in the same field, and brings it in through the host', () => {
    const onPickExisting = vi.fn();
    const ownership = { existingRows: () => [{ id: 'claims', name: 'Claims Portal', detail: 'in Shared' }], onPickExisting };
    const at = { position: { x: 1, y: 2 } };
    render(<Harness request={{ screen: { x: 0, y: 0 }, at }} partsOver={{ actions: {}, ownership }} />);
    type('Clai');
    act(() => { fireEvent.click(screen.getByRole('option', { name: /Claims Portal/ })); });
    expect(onPickExisting).toHaveBeenCalledWith('claims', at);
  });

  it('offers a group on a landscape and not on a container diagram', () => {
    expect(addableKinds(board)).toContain('domainGroup');
    expect(addableKinds(laidOut({ id: 'c', kind: 'container', name: 'C', placements: [] }))).not.toContain('domainGroup');
  });
});
