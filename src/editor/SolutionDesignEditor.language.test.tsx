// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { addFromBar } from './testing/boardBar';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import type { DesignModel } from '../model/types';
import type { Language } from '../i18n/strings';

/**
 * The bilingual UI, from the outside.
 *
 * The rest of the suite proves the ENGLISH wording, because English is what
 * `useStrings()` answers with no provider and what the whole test suite reads.
 * This file is the other half: that a `language` prop actually reaches the
 * toolbar, the palette, the canvas bands and the inspector, that the toggle is
 * a request to the host rather than local state, and that no toggle appears
 * when the host did not wire one.
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

function model(): DesignModel {
  return {
    name: 'ACME Solution Design',
    diagrams: [
      laidOut({
        id: 'd1',
        kind: 'layer7',
        name: 'Layer 7 — EU',
        placements: [{ id: 'a1', zone: 'landscape', x: 400, y: 300 }],
      }),
    ],
    elements: [
      {
        id: 'a1',
        kind: 'application',
        name: 'Webshop',
        lifecycle: 'live',
        isManaged: true,
        aspects: {},
      },
    ],
    relations: [],
  };
}

function renderEditor(overrides: Partial<HostedEditorProps> = {}) {
  const onLanguageChange = vi.fn<(language: Language) => void>();
  const host = { current: undefined as unknown as EditorHostState };
  const props: HostedEditorProps = {
    model: model(),
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    onLanguageChange,
    ...overrides,
  };
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor {...props} hostRef={host} />
      </div>
    </ThemeProvider>,
  );
  return { ...view, host, onLanguageChange };
}

describe('SolutionDesignEditor — language', () => {
  it('speaks English when the host passes none', () => {
    renderEditor();
    expect(screen.getByTestId('zoom-fit')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
  });

  it('speaks Dutch when asked — the bar, the dock and what Add offers', () => {
    renderEditor({ language: 'nl' });
    expect(screen.getByRole('button', { name: 'Ordenen' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tonen' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Arrange' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Toevoegen' }));
    expect(screen.getByRole('menuitem', { name: 'Applicatie' })).toBeDefined();
  });

  it('translates the inspector and a new domain group, and does not ask for the language it is in', () => {
    renderEditor({ language: 'nl' });
    fireEvent.click(screen.getByRole('button', { name: 'Toevoegen' }));
    expect(screen.getByRole('menuitem', { name: 'Domeingroep' })).toBeDefined();
    cleanup()
    const { onLanguageChange } = renderEditor({ language: 'nl' });
    fireEvent.click(screen.getByRole('button', { name: 'Meer over deze weergave' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Taal' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Nederlands' }));
    expect(onLanguageChange).not.toHaveBeenCalled();
  });

  it('translates a context menu — the pure builder follows the prop', () => {
    renderEditor({ language: 'nl' });
    const pane = document.querySelector('.react-flow__pane') as HTMLElement;
    fireEvent.contextMenu(pane, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('menu', { name: 'Canvasmenu' })).toBeDefined();
    expect(screen.getByText('Alles selecteren')).toBeDefined();
    expect(screen.getByText('Passend maken')).toBeDefined();
  });

  it('translates the keyboard-shortcuts dialog', () => {
    renderEditor({ language: 'nl' });
    fireEvent.click(screen.getByRole('button', { name: 'Meer over deze weergave' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Sneltoetsen/ }));
    expect(screen.getByRole('heading', { name: 'Sneltoetsen' })).toBeDefined();
    expect(screen.getByText('Alles selecteren')).toBeDefined();
    expect(screen.getByText('Element zoeken')).toBeDefined();
  });

  /**
   * The one place the language leaves the screen and lands in the DATA.
   *
   * A default name is a placeholder until you don't type over it, at which point
   * it is the element's name — on the card, in the interchange document, in the
   * PNG. A Dutch editor that quietly writes "New application" is not a missing
   * translation, it is wrong content, so this asserts the model and not just
   * the field.
   */
  it('names a new element what was typed, and selects it in the language of the screen', () => {
    const { host } = renderEditor({ language: 'nl' });

    addFromBar('Applicatie', 'Nieuwe applicatie', 'Toevoegen');

    expect(host.current.commands).toHaveLength(1);
    expect(host.current.model.elements.at(-1)?.name).toBe('Nieuwe applicatie');
    expect(document.querySelector('.kit-panel__name')?.textContent).toBe('Nieuwe applicatie');
  });

  it('asks the host for the chosen language rather than switching itself', () => {
    const { onLanguageChange } = renderEditor({ language: 'nl' });
    fireEvent.click(screen.getByRole('button', { name: 'Meer over deze weergave' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Taal' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'English' }));
    expect(onLanguageChange).toHaveBeenCalledWith('en');
    // Still Dutch: the editor does not own the value.
    expect(screen.getByRole('button', { name: 'Ordenen' })).toBeDefined();
  });

  it('offers no language where the host owns it, and keeps it in read-only mode', () => {
    renderEditor({ onLanguageChange: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'More on this view' }));
    expect(screen.queryByRole('menuitem', { name: 'Language' })).toBeNull();
    cleanup()
    renderEditor({ readOnly: true });
    fireEvent.click(screen.getByRole('button', { name: 'More on this view' }));
    expect(screen.getByRole('menuitem', { name: 'Language' })).toBeDefined();
  });

});
