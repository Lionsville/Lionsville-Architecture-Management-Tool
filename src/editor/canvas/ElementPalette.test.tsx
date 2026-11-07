// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { testTheme } from '../testing/theme';
import { ElementPalette, PALETTE_DRAG_MIME } from './ElementPalette';
import { axeFindings } from '../../app/testing/axe';

afterEach(() => cleanup());

function renderRail(props: Partial<React.ComponentProps<typeof ElementPalette>> = {}) {
  const onPress = vi.fn();
  const view = render(
    <ThemeProvider theme={testTheme}>
      <ElementPalette kinds={['application', 'actor', 'domainGroup']} onPress={onPress} {...props} />
    </ThemeProvider>,
  );
  return { ...view, onPress };
}

describe('the rail of kinds', () => {
  it('names every kind in words and offers nothing it was not given', () => {
    renderRail();
    expect(screen.getByRole('complementary', { name: 'Element palette' })).toBeDefined();
    expect(screen.getByText('Application')).toBeDefined();
    expect(screen.getByText('Actor')).toBeDefined();
    expect(screen.getByText('Domain group')).toBeDefined();
    expect(screen.queryByText('Component')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Existing application or platform…' })).toBeNull();
  });

  it('asks for the picker on a press, naming the kind', () => {
    const { onPress } = renderRail();
    fireEvent.click(screen.getByRole('button', { name: 'Add Application' }));
    expect(onPress).toHaveBeenCalledWith('application');
  });

  it('drags a kind, a group among them, as what a drop reads', () => {
    renderRail();
    const set = vi.fn();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Add Domain group' }), { dataTransfer: { setData: set } });
    expect(set).toHaveBeenCalledWith(PALETTE_DRAG_MIME, JSON.stringify({ kind: 'domainGroup' }));
  });

  it('opens what exists through the host, where the host has it', () => {
    const onAddExisting = vi.fn();
    renderRail({ onAddExisting });
    fireEvent.click(screen.getByRole('button', { name: 'Existing application or platform…' }));
    expect(onAddExisting).toHaveBeenCalledTimes(1);
  });

  it('has nothing axe can find', async () => {
    const { container } = renderRail();
    expect(await axeFindings(container)).toEqual([]);
  });
});
