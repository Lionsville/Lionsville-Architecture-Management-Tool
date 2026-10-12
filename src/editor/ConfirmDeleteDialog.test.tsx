// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axeFindings } from '../app/testing/axe';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { DeleteElementDialog } from './DeleteElementDialog';
import type { DeletionSummary } from '../model/deletion';

afterEach(() => cleanup());

const summary = (over: Partial<DeletionSummary> = {}): DeletionSummary => ({
  elements: 0,
  connections: 0,
  domainGroups: 0,
  cascadingConnections: 0,
  standIns: 0,
  roles: [],
  earlierAssignments: 0,
  ...over,
});

describe('ConfirmDeleteDialog — as axe reads it', () => {
  it('finds nothing', async () => {
    render(<ConfirmDeleteDialog summary={summary({ connections: 1 })} subject="Sends orders" onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(await axeFindings()).toEqual([]);
  });
});

describe('ConfirmDeleteDialog — what it calls the thing', () => {
  it('quotes a named subject', () => {
    render(<ConfirmDeleteDialog summary={summary({ connections: 1 })} subject="Sends orders" onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Delete “Sends orders”?')).toBeDefined();
    expect(screen.getByText(/Deletes 1 connection from the model/)).toBeDefined();
  });

  it('calls one unlabeled connection "this connection", without quotes', () => {
    render(<ConfirmDeleteDialog summary={summary({ connections: 1 })} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Delete this connection?')).toBeDefined();
    expect(screen.getByText(/Deletes 1 connection from the model/)).toBeDefined();
  });

  it('counts a mixed selection and names the cascade', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteDialog
        summary={summary({ elements: 2, connections: 1, cascadingConnections: 3 })}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Delete 2 elements and 1 connection?')).toBeDefined();
    expect(screen.getByText(/3 connections attached to them go too/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

/** A unit's assignments go with it (ADR-0036, amended 12 October 2026): the confirmation says who stops being what. */
describe('ConfirmDeleteDialog — the roles a delete ends', () => {
  it('lists each, and what to do instead where the history should stay', async () => {
    render(
      <ConfirmDeleteDialog
        summary={summary({ elements: 2 })}
        endsRoles={['Ada Lovelace stops being Product owner in Webshop.', '1 assignment in it that is already over goes too.']}
        onConfirm={vi.fn()} onClose={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('role-ended').map((one) => one.textContent)).toEqual([
      'Ada Lovelace stops being Product owner in Webshop.', '1 assignment in it that is already over goes too.',
    ]);
    expect(screen.getByTestId('roles-ended-instead').textContent).toBe('To keep who held what, end the unit on a day instead: its lifecycle, or a plan.');
    expect(await axeFindings()).toEqual([]);
  });

  it('says nothing of roles where none ends', () => {
    render(<ConfirmDeleteDialog summary={summary({ elements: 2 })} endsRoles={[]} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId('roles-ended')).toBeNull();
  });
});

/** Units among what goes (3.6.2): the host draws its part, holds nothing, and Delete hands over the choice. */
describe('the delete questions, for a unit', () => {
  const units = (run = vi.fn()) => ({
    initial: 'up',
    render: (choice: string, onChoice: (next: string) => void) => (
      <button type="button" data-testid="host-part" onClick={() => onChoice('delete')}>{`chosen ${choice}`}</button>
    ),
    run,
  });

  it('draws the host\'s part in place of the roles, and confirms with the choice made in it', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDeleteDialog summary={summary({ elements: 1 })} endsRoles={['x']} units={units()} onConfirm={onConfirm} onClose={vi.fn()} />);
    expect(screen.queryByTestId('roles-ended')).toBeNull();
    expect(screen.getByTestId('host-part').textContent).toBe('chosen up');
    fireEvent.click(screen.getByTestId('host-part'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledWith('delete');
  });

  it('lets a unit with units inside it be deleted from the model, with the choice, where an application\'s components hold it back', () => {
    const element = { id: 'north', kind: 'actor' as const, name: 'North', lifecycle: 'live' as const, isManaged: false, aspects: {} };
    const onDeleteFromModel = vi.fn();
    render(
      <DeleteElementDialog element={element} isBoundaryApplication={false} hasComponents units={units()}
        onRemoveFromDiagram={vi.fn()} onDeleteFromModel={onDeleteFromModel} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete from model' }));
    expect(onDeleteFromModel).toHaveBeenCalledWith('up');
    cleanup();
    render(
      <DeleteElementDialog element={element} isBoundaryApplication={false} hasComponents
        onRemoveFromDiagram={vi.fn()} onDeleteFromModel={onDeleteFromModel} onClose={vi.fn()} />,
    );
    expect((screen.getByRole('button', { name: 'Delete from model' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
