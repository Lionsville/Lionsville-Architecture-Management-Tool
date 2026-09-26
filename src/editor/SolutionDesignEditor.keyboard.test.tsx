// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The board without a mouse: the keyboard half of the accessibility audit
 * (`docs/accessibility.md`), over the real editor and a real reducer.
 *
 * Tab reaches every card, every line and every group's name; Enter or Space
 * selects what it reached; the arrows move a selection and the move is a
 * command like a drag's; *Start connection to…* from the menu Shift+F10 opens,
 * then Enter on the card the line should end at, draws it. What stays the
 * pointer's is written down in the audit rather than pretended here: resizing
 * a card, a band or a group, moving a group, and bending a line.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { laidOut } from '../model/testFixtures';
import type { DesignModel } from '../model/types';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import { placedNodes } from '../model/placement';

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

function model(): DesignModel {
  return {
    name: 'Keys',
    elements: [
      { id: 'a1', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'a2', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'a3', kind: 'application', name: 'Ledger', lifecycle: 'live', isManaged: true, aspects: {} },
    ],
    relations: [{ type: 'flow', id: 'c1', sourceId: 'a1', targetId: 'a2', label: 'Sends orders', isBidirectional: false }],
    diagrams: [
      laidOut({
        id: 'd1',
        kind: 'layer7',
        name: 'Landscape',
        groups: [{ id: 'core', name: 'Core' }],
        placements: [
          { id: 'a1', zone: 'landscape', group: 'core', x: 300, y: 300 },
          { id: 'a2', zone: 'landscape', x: 700, y: 300 },
          { id: 'a3', zone: 'landscape', x: 700, y: 600 },
        ],
        layoutConfig: { domainGroups: [{ id: 'core', x: 250, y: 250, width: 300, height: 200 }] },
      }),
    ],
  };
}

function renderEditor(over: Partial<HostedEditorProps> = {}) {
  const host = { current: undefined as unknown as EditorHostState };
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor model={model()} activeDiagramId="d1" {...over} hostRef={host} />
      </div>
    </ThemeProvider>,
  );
  const card = (id: string) => view.container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!;
  const line = (id: string) => view.container.querySelector<HTMLElement>(`.react-flow__edge[data-id="${id}"]`)!;
  const at = (id: string) => placedNodes(host.current.model.diagrams[0]).find((node) => node.id === id)!;
  return { ...view, host, card, line, at };
}

/** Focus a thing and press a key on it, which is all a keyboard does. */
function press(target: HTMLElement, key: string, init: { shiftKey?: boolean } = {}) {
  target.focus();
  fireEvent.keyDown(target, { key, ...init });
}

describe('the board without a mouse', () => {
  it('puts every card and every line in the tab order, each told its keys, a line named by its ends', async () => {
    const { card, line } = renderEditor();
    for (const id of ['a1', 'a2', 'a3']) expect(card(id).tabIndex).toBe(0);
    const toldCard = document.getElementById(card('a1').getAttribute('aria-describedby')!);
    expect(toldCard?.textContent).toContain('The arrow keys move the selection');
    await waitFor(() => expect(line('c1')).not.toBeNull());
    expect(line('c1').getAttribute('tabindex')).toBe('0');
    expect(line('c1').getAttribute('aria-label')).toBe('From Webshop to Billing: Sends orders');
    const told = document.getElementById(line('c1').getAttribute('aria-describedby')!);
    expect(told?.textContent).toContain('Shift+F10 opens its menu');
  });

  it('selects a card with Enter, and another after it without opening the first one’s page', () => {
    const { card } = renderEditor();
    press(card('a1'), 'Enter');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Webshop');

    press(card('a2'), 'Enter');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Billing');
    expect(screen.queryByRole('button', { name: 'Close documentation' })).toBeNull();

    // Enter again on the card that is selected is the page.
    press(card('a2'), 'Enter');
    expect(screen.getByRole('button', { name: 'Close documentation' })).toBeDefined();
  });

  it('moves a selected card with the arrows, as a step of its own', () => {
    const { card, at, host } = renderEditor();
    press(card('a2'), 'Enter');
    const before = at('a2');
    const steps = host.current.commands.length;
    press(card('a2'), 'ArrowRight');
    expect(at('a2').x).toBeGreaterThan(before.x);
    expect(at('a2').y).toBe(before.y);
    expect(host.current.commands.length).toBe(steps + 1);
  });

  it('draws a line: the menu’s Start connection, then Enter on the card it ends at', () => {
    const { card, host } = renderEditor();
    press(card('a2'), 'Enter');
    press(card('a2'), 'F10', { shiftKey: true });
    const menu = screen.getByRole('menu', { name: 'Element menu' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Start connection to/ }));
    expect(screen.getByTestId('lv-connect-hint')).toBeDefined();

    press(card('a3'), 'Enter');
    expect(host.current.model.relations.some((row) => row.sourceId === 'a2' && row.targetId === 'a3')).toBe(true);
    expect(screen.queryByTestId('lv-connect-hint')).toBeNull();
  });

  it('selects a line with Enter, and its menu is Shift+F10 away', async () => {
    const { line } = renderEditor();
    await waitFor(() => expect(line('c1')).not.toBeNull());
    press(line('c1'), 'Enter');
    expect(screen.getByDisplayValue('Sends orders')).toBeDefined();
    await waitFor(() => expect(line('c1')).not.toBeNull());
    press(line('c1'), 'F10', { shiftKey: true });
    expect(screen.getByRole('menu', { name: 'Connection menu' })).toBeDefined();
  });

  it('selects a group from its name, which is in the tab order', () => {
    renderEditor();
    const name = screen.getByRole('button', { name: /Core/ });
    expect(name.tabIndex).toBe(0);
    press(name, 'Enter');
    expect(name.getAttribute('aria-pressed')).toBe('true');
    press(name, 'F10', { shiftKey: true });
    expect(screen.getByRole('menu', { name: 'Domain group menu' })).toBeDefined();
  });

  it('reaches every control in the inspector by Tab, and its tabs by the arrows', () => {
    const { card } = renderEditor();
    press(card('a1'), 'Enter');
    const inspector = screen.getByRole('complementary', { name: 'Inspector' });
    const controls = [...inspector.querySelectorAll<HTMLElement>(
      'button, input, textarea, select, a[href], [role="combobox"], [role="tab"], [role="button"], [tabindex]',
    )].filter((one) => !one.closest('[aria-hidden="true"]') && !(one as HTMLButtonElement).disabled);
    expect(controls.length).toBeGreaterThan(5);
    // Out of the Tab order only where a pattern puts it there on purpose: the
    // tabs a tablist moves between with the arrows (one of them is in it), and
    // an autocomplete's clear and open buttons, whose keys are the field's own
    // (typing clears it, ↓ opens it).
    const byPattern = (one: HTMLElement) =>
      one.getAttribute('role') === 'tab'
      || one.matches('.MuiAutocomplete-clearIndicator, .MuiAutocomplete-popupIndicator');
    const skipped = controls.filter((one) => one.tabIndex < 0 && !byPattern(one));
    expect(skipped.map((one) => one.outerHTML.slice(0, 120))).toEqual([]);

    const tabs = within(inspector).getAllByRole('tab');
    expect(tabs.filter((one) => one.tabIndex === 0)).toHaveLength(1);
    press(tabs[0], 'ArrowRight');
    expect(document.activeElement).toBe(tabs[1]);
  });
});
