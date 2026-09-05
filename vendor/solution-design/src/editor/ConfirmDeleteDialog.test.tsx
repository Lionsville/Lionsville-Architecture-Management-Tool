// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import type { DeletionSummary } from '../model/deletion';

afterEach(() => cleanup());

const summary = (over: Partial<DeletionSummary> = {}): DeletionSummary => ({
  elements: 0,
  connections: 0,
  domainGroups: 0,
  cascadingConnections: 0,
  ...over,
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
