// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axeFindings } from '../app/testing/axe';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
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
