// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ContextMenu } from './ContextMenu';
import type { MenuItem } from './menuItems';

/**
 * The renderer half of the context menu: given items, it must show them the way
 * the builder meant — hints, check marks, danger, disabled-with-reason, nested
 * submenus — fire the chosen item back exactly once and close afterwards.
 */

afterEach(() => cleanup());

const ITEMS: MenuItem[] = [
  { id: 'rename', label: 'Rename', shortcut: 'F2', action: 'rename' },
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    children: [
      { id: 'planned', label: 'Planned', checked: false, action: 'set-lifecycle', args: { lifecycle: 'planned' } },
      { id: 'live', label: 'Live', checked: true, action: 'set-lifecycle', args: { lifecycle: 'live' } },
    ],
  },
  { id: 'sep', label: '', divider: true },
  {
    id: 'pin',
    label: 'Pin route',
    action: 'pin-route',
    disabled: true,
    disabledReason: 'Coming in the routing phase',
  },
  { id: 'delete', label: 'Delete from model…', danger: true, action: 'delete-from-model' },
];

function renderMenu(overrides: Partial<React.ComponentProps<typeof ContextMenu>> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <ContextMenu
        open
        position={{ x: 120, y: 80 }}
        items={ITEMS}
        onSelect={onSelect}
        onClose={onClose}
        {...overrides}
      />
    </ThemeProvider>,
  );
  return { ...view, onSelect, onClose };
}

describe('ContextMenu', () => {
  it('renders the items with their shortcut hints and a divider', () => {
    renderMenu();
    const menu = screen.getByRole('menu', { name: 'Context menu' });
    expect(within(menu).getByRole('menuitem', { name: /Rename/ })).toBeDefined();
    expect(within(menu).getByText('F2').tagName).toBe('KBD');
    expect(within(menu).getByRole('separator')).toBeDefined();
    expect(within(menu).getByRole('menuitem', { name: /Delete from model/ }).className).toMatch(/lv-menu-danger/);
  });

  it('fires onSelect with the picked item, then closes', () => {
    const { onSelect, onClose } = renderMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(ITEMS[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    renderMenu({ open: false });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', () => {
    const { onClose, onSelect } = renderMenu();
    fireEvent.keyDown(screen.getByRole('menu', { name: 'Context menu' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('opens a submenu on hover and reports the child item that was picked', () => {
    const { onSelect, onClose } = renderMenu();
    const parent = screen.getByRole('menuitem', { name: /Lifecycle/ });
    expect(parent.getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.queryByRole('menu', { name: 'Lifecycle' })).toBeNull();

    fireEvent.mouseEnter(parent);
    const submenu = screen.getByRole('menu', { name: 'Lifecycle' });
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    // Checked entries are checkbox items so assistive tech hears the state too.
    expect(within(submenu).getByRole('menuitemcheckbox', { name: 'Live' }).getAttribute('aria-checked')).toBe('true');
    expect(within(submenu).getByRole('menuitemcheckbox', { name: 'Planned' }).getAttribute('aria-checked')).toBe('false');

    fireEvent.click(within(submenu).getByRole('menuitemcheckbox', { name: 'Planned' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(ITEMS[1].children![0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens a submenu from the keyboard with → and closes it with ←', () => {
    renderMenu();
    const parent = screen.getByRole('menuitem', { name: /Lifecycle/ });
    fireEvent.keyDown(parent, { key: 'ArrowRight' });
    const submenu = screen.getByRole('menu', { name: 'Lifecycle' });
    expect(submenu).toBeDefined();

    fireEvent.keyDown(submenu, { key: 'ArrowLeft' });
    expect(screen.queryByRole('menu', { name: 'Lifecycle' })).toBeNull();
  });

  it('hovering a sibling closes an open submenu', () => {
    renderMenu();
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: /Lifecycle/ }));
    expect(screen.getByRole('menu', { name: 'Lifecycle' })).toBeDefined();
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: /Rename/ }));
    expect(screen.queryByRole('menu', { name: 'Lifecycle' })).toBeNull();
  });

  it('keeps a disabled item inert but explains it in a tooltip', async () => {
    const { onSelect } = renderMenu();
    const pin = screen.getByRole('menuitem', { name: /Pin route/ });
    expect(pin.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(pin);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.mouseOver(within(pin).getByText('Pin route'));
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toBe('Coming in the routing phase'));
  });

  it('resolves item icons through renderIcon', () => {
    const items: MenuItem[] = [
      { id: 'rename', label: 'Rename', checked: true, action: 'rename' },
      { id: 'icon', label: 'Icon…', icon: 'database', action: 'pick-icon' },
    ];
    renderMenu({
      items,
      renderIcon: (key) => <span data-testid={`mark-${key}`} />,
    });
    expect(screen.getByTestId('mark-database')).toBeDefined();
  });
});
