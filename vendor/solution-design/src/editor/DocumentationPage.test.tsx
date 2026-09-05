// @vitest-environment jsdom
/**
 * The page's promises: it opens reading, editing is a choice and not offered
 * to a read-only reader, a draft becomes one element update when the writer
 * stops (not one per keystroke), the template fills an empty page, and every
 * way of moving — the left column, an element link, previous/next — goes
 * through the same navigation callback. Escape steps back before it steps out.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { DocumentationPage, type DocumentationPageProps } from './DocumentationPage';
import type { EditorActions } from './useEditorState';
import type { DesignDiagram, DesignElement, DesignModel, MarkdownRenderOptions } from '../types';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function element(overrides: Partial<DesignElement> = {}): DesignElement {
  return {
    id: 'e1',
    kind: 'application',
    name: 'Order Management',
    lifecycle: 'live',
    isManaged: false,
    aspects: {},
    parameters: {},
    ...overrides,
  };
}

const billing = element({ id: 'e2', name: 'Billing', description: '## Purpose\n\nBills.' });
const planner = element({ id: 'e3', kind: 'actor', name: 'Planner' });
const offDiagram = element({ id: 'e4', name: 'Elsewhere' });

function diagram(): DesignDiagram {
  return {
    id: 'd1',
    kind: 'layer7',
    name: 'Landscape',
    placements: ['e1', 'e2', 'e3'].map((elementId) => ({ elementId, x: 0, y: 0 })),
  };
}

function model(main: DesignElement): DesignModel {
  return {
    name: 'Design',
    customerName: 'Acme',
    diagrams: [diagram()],
    elements: [main, billing, planner, offDiagram],
    connections: [],
  };
}

/** A renderer that shows the source verbatim and offers one element link to click. */
function fakeRenderer(md: string, options?: MarkdownRenderOptions) {
  return (
    <div data-testid="rendered">
      <h2>Purpose</h2>
      <span data-testid="source">{md}</span>
      <button type="button" onClick={() => options?.onElementLink?.('e2')}>
        follow link
      </button>
    </div>
  );
}

function setup(overrides: Partial<DocumentationPageProps> = {}) {
  const updateElement = vi.fn();
  const actions = new Proxy({ updateElement } as unknown as EditorActions, {
    get: (target, key) => (key in target ? target[key as keyof EditorActions] : () => {}),
  });
  const main = overrides.element ?? element({ description: 'Holds every order until [[Billing]] takes it.' });
  const props: DocumentationPageProps = {
    element: main,
    model: model(main),
    diagram: diagram(),
    readOnly: false,
    actions,
    parameterSpecs: [],
    renderMarkdown: fakeRenderer,
    onNavigate: vi.fn(),
    onClose: vi.fn(),
    onRequestDelete: vi.fn(),
    ...overrides,
  };
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <DocumentationPage {...props} />
    </ThemeProvider>,
  );
  return { ...view, props, updateElement };
}

const source = () => screen.queryByLabelText('Documentation source (markdown)') as HTMLTextAreaElement | null;

describe('DocumentationPage', () => {
  it('opens reading, with element refs already turned into links', () => {
    setup();
    expect(source()).toBeNull();
    expect(screen.getByTestId('source').textContent).toBe('Holds every order until [Billing](element:e2) takes it.');
    expect(screen.getByRole('heading', { name: 'Order Management' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('offers no Edit to a read-only reader', () => {
    setup({ readOnly: true });
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Read' })).toBeTruthy();
  });

  it('commits a draft once it has been quiet, and again on the way back to Read', () => {
    vi.useFakeTimers();
    const { updateElement } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const area = source();
    expect(area).not.toBeNull();
    fireEvent.change(area!, { target: { value: 'One.' } });
    fireEvent.change(area!, { target: { value: 'One. Two.' } });
    expect(updateElement).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(updateElement).toHaveBeenCalledTimes(1);
    expect(updateElement).toHaveBeenLastCalledWith('e1', { description: 'One. Two.' });

    fireEvent.change(area!, { target: { value: 'One. Two. Three.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));
    expect(updateElement).toHaveBeenLastCalledWith('e1', { description: 'One. Two. Three.' });
    expect(source()).toBeNull();
  });

  it('clears the description when the draft is emptied', () => {
    const { updateElement } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(source()!, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));
    expect(updateElement).toHaveBeenLastCalledWith('e1', { description: undefined });
  });

  it('fills an empty page from the template', () => {
    setup({ element: element({ description: undefined }) });
    expect(screen.getByText('Nothing written yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start from the template' }));
    expect(source()!.value.startsWith('| Short description | |')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Start from the template' })).toBeNull();
  });

  it('lists the diagram’s elements by kind and navigates from the list, a link, and next', () => {
    const { props } = setup();
    const nav = within(screen.getByTestId('doc-nav'));
    expect(nav.getByText('Billing')).toBeTruthy();
    expect(nav.getByText('Planner')).toBeTruthy();
    expect(nav.queryByText('Elsewhere')).toBeNull();

    fireEvent.click(nav.getByText('Planner'));
    expect(props.onNavigate).toHaveBeenLastCalledWith('e3');

    fireEvent.click(screen.getByRole('button', { name: 'follow link' }));
    expect(props.onNavigate).toHaveBeenLastCalledWith('e2');

    // Applications first, alphabetical: Billing, Order Management; so next is Planner.
    fireEvent.click(screen.getByRole('button', { name: 'Next element' }));
    expect(props.onNavigate).toHaveBeenLastCalledWith('e3');
    fireEvent.click(screen.getByRole('button', { name: 'Previous element' }));
    expect(props.onNavigate).toHaveBeenLastCalledWith('e2');
  });

  it('shows the element’s fields, editable only while editing', () => {
    setup();
    const name = () => screen.getByLabelText('Name') as HTMLInputElement;
    expect(name().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(name().disabled).toBe(false);
    // The page is the description; the inspector must not show it a second time.
    expect(screen.queryByLabelText('Description')).toBeNull();
  });

  it('steps back on Escape: out of Edit first, then out of the page', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(source()).toBeNull();
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('commits a pending draft when the page goes away', () => {
    const { updateElement, unmount } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(source()!, { target: { value: 'Unsaved words.' } });
    unmount();
    expect(updateElement).toHaveBeenLastCalledWith('e1', { description: 'Unsaved words.' });
  });
});
