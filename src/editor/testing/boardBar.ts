// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A person on the board's View bar, for the suites that go through it. */
import { fireEvent, screen, within } from '@testing-library/react';

const word = (name: string) => screen.getByRole('button', { name });

/** A panel opened, the press made, and the panel put away, so the board behind it can be asked about. */
function inPanel(name: string, press: (panel: HTMLElement) => void): void {
  fireEvent.click(word(name));
  const panel = screen.getByRole('dialog', { name, hidden: true });
  press(panel);
  const still = screen.queryByRole('dialog', { name, hidden: true });
  if (still) fireEvent.keyDown(still, { key: 'Escape' });
}

export const pressTidy = () => inPanel('Arrange', (panel) => fireEvent.click(within(panel).getByTestId('arrange-tidy')));
export const pressRoute = () => inPanel('Arrange', (panel) => fireEvent.click(within(panel).getByTestId('arrange-route')));
export const pressAutoRoute = () => inPanel('Arrange', (panel) => fireEvent.click(within(panel).getByTestId('arrange-auto')));
/** A setting under Show, by its words. */
export const pressShow = (label: string, group = 'Show') => inPanel(group, (panel) => fireEvent.click(within(panel).getByRole('checkbox', { name: label, hidden: true })));
/** Line labels on hover, or always. */
export const showLineLabels = (always: boolean) => inPanel('Show', (panel) => fireEvent.click(within(panel).getByRole('radio', { name: always ? 'Always' : 'On hover', hidden: true })));

/** A kind from Add, and a name given to it in the picker. */
export function addFromBar(kind: string, name?: string, add = 'Add'): void {
  fireEvent.click(word(add));
  fireEvent.click(screen.getByRole('menuitem', { name: kind }));
  const field = screen.getByRole('combobox');
  fireEvent.change(field, { target: { value: name ?? kind } });
  fireEvent.keyDown(field, { key: 'Enter' });
}
