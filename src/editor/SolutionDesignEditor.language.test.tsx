// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
    customerName: 'ACME',
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'Layer 7 — EU',
        placements: [{ elementId: 'a1', zone: 'landscape', x: 400, y: 300 }],
      },
    ],
    elements: [
      {
        id: 'a1',
        kind: 'application',
        name: 'Webshop',
        lifecycle: 'live',
        isManaged: true,
        aspects: {},
        parameters: {},
      },
    ],
    connections: [],
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
    expect(screen.getByLabelText('Fit view')).toBeDefined();
    expect(screen.getByLabelText('Element palette')).toBeDefined();
    expect(screen.getByText('Add to canvas')).toBeDefined();
  });

  it('speaks Dutch when asked — toolbar tooltip, palette rows and zone bands', () => {
    renderEditor({ language: 'nl' });
    // Toolbar (aria-label doubles as the tooltip's text).
    expect(screen.getByLabelText('Passend maken')).toBeDefined();
    // Palette chrome and a row label.
    expect(screen.getByLabelText('Elementenpalet')).toBeDefined();
    expect(screen.getByText('Aan het canvas toevoegen')).toBeDefined();
    expect(screen.getByText('Applicatie')).toBeDefined();
    // The canvas overlay (the zone bands themselves render through a React Flow
    // viewport portal that jsdom does not lay out; `model/zones.test.ts` pins
    // their captions).
    expect(screen.getByLabelText('Raster tonen of verbergen')).toBeDefined();
    // And nothing English is left in those places.
    expect(screen.queryByLabelText('Fit view')).toBeNull();
  });

  it('translates the inspector empty state', () => {
    renderEditor({ language: 'nl' });
    expect(screen.getByText(/Selecteer een element of koppeling/)).toBeDefined();
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
    fireEvent.click(screen.getByLabelText('Sneltoetsen'));
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
  it('names a new element in the UI language, in the model as well as the field', () => {
    const { host } = renderEditor({ language: 'nl' });

    fireEvent.click(screen.getByRole('button', { name: 'Applicatie', expanded: false }));
    // The name field shows what you will get if you leave it blank…
    expect(screen.getByPlaceholderText('Nieuwe applicatie')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'applicatie toevoegen' }));

    // …and that is exactly what lands in the model.
    expect(host.current.commands).toHaveLength(1);
    expect(host.current.model.elements.at(-1)?.name).toBe('Nieuwe applicatie');
    expect((screen.getByLabelText('Naam') as HTMLInputElement).value).toBe('Nieuwe applicatie');
  });

  it('names a new domain group in the UI language too', () => {
    renderEditor({ language: 'nl' });
    fireEvent.click(screen.getByRole('button', { name: 'Domeingroep', expanded: false }));
    expect(screen.getByPlaceholderText('Nieuwe groep')).toBeDefined();
  });

  it('asks the host for the other language rather than switching itself', () => {
    const { onLanguageChange } = renderEditor({ language: 'nl' });
    fireEvent.click(screen.getByLabelText('Taal'));
    expect(onLanguageChange).toHaveBeenCalledWith('en');
    // Still Dutch: the editor does not own the value.
    expect(screen.getByLabelText('Passend maken')).toBeDefined();
  });

  it('offers no toggle when the host owns the language elsewhere', () => {
    renderEditor({ onLanguageChange: undefined });
    expect(screen.queryByLabelText('Language')).toBeNull();
  });

  it('keeps the toggle in read-only mode — reading is not a mutation', () => {
    renderEditor({ readOnly: true });
    expect(screen.getByLabelText('Language')).toBeDefined();
  });
});
