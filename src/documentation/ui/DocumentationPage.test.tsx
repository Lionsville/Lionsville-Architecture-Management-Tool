// @vitest-environment jsdom
/**
 * The page's promises: it opens reading, editing is a choice and not offered
 * to a read-only reader, a draft becomes one element update when the writer
 * stops (not one per keystroke), the template fills an empty page, and every
 * way of moving — the left column, an element link, previous/next — goes
 * through the same navigation callback. Escape steps back before it steps out.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../../model/testFixtures';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { DocumentationPage, type DocumentationPageProps } from './DocumentationPage';
import type { DocumentationActions } from './DocumentationPage';
import type { DesignDiagram, DesignElement, DesignModel } from '../../model/types';
import type { MarkdownRenderOptions } from '../documentation';

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
    ...overrides,
  };
}

const billing = element({ id: 'e2', name: 'Billing', description: '## Purpose\n\nBills.' });
const planner = element({ id: 'e3', kind: 'actor', name: 'Planner' });
const offDiagram = element({ id: 'e4', name: 'Elsewhere' });

function diagram(): DesignDiagram {
  return laidOut({
    id: 'd1',
    kind: 'layer7',
    name: 'Landscape',
    placements: ['e1', 'e2', 'e3'].map((id) => ({ id, x: 0, y: 0 })),
  });
}

function model(main: DesignElement): DesignModel {
  return {
    name: 'Design',
    customerName: 'Acme',
    diagrams: [diagram()],
    elements: [main, billing, planner, offDiagram],
    relations: [],
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
  const actions = new Proxy({ updateElement } as unknown as DocumentationActions, {
    get: (target, key) => (key in target ? target[key as keyof DocumentationActions] : () => {}),
  });
  const main = overrides.element ?? element({ description: 'Holds every order until [[Billing]] takes it.' });
  const props: DocumentationPageProps = {
    element: main,
    model: model(main),
    diagram: diagram(),
    readOnly: false,
    actions,
    renderMarkdown: fakeRenderer,
    onNavigate: vi.fn(),
    onClose: vi.fn(),
    onRequestDelete: vi.fn(),
    // A stand-in for the editor's inspector: the page owns whether the fields
    // may be edited, not what they are.
    renderInspector: (el, { readOnly }) => (
      <input aria-label="Name" defaultValue={el.name} disabled={readOnly} />
    ),
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

/** A pasted or dropped file, as the two events carry it. */
function imageFile(name = 'Screenshot.png'): File {
  return new File([new Uint8Array([1, 2])], name, { type: 'image/png' });
}

/** jsdom has no clipboard or drag payload; both events read the same two fields. */
function transfer(files: File[], text = '') {
  return { files, items: [], types: files.length ? ['Files'] : [], getData: () => text };
}

describe('DocumentationPage — the plans that name the element (ADR-0010)', () => {
  const plan = (id: string, title: string, elementId: string) => ({
    id, number: Number(id.slice(-1)), title, status: 'agreed' as const,
    elements: [{ elementId, role: 'retires' as const }], decisions: [], milestones: [], body: '',
  });

  it('lists them above the fields and opens one through the host', () => {
    const onOpen = vi.fn();
    const main = element();
    setup({ element: main, plans: { list: [plan('tr-1', 'Replace it', main.id), plan('tr-2', 'Elsewhere', 'other')], onOpen } });
    const section = screen.getByTestId('doc-plans');
    expect(section.textContent).toContain('TR-0001 Replace it');
    expect(section.textContent).not.toContain('Elsewhere');
    fireEvent.click(screen.getByText('TR-0001 Replace it'));
    expect(onOpen).toHaveBeenCalledWith('tr-1');
  });

  it('shows no section when nothing names the element', () => {
    setup({ plans: { list: [], onOpen: vi.fn() } });
    expect(screen.queryByTestId('doc-plans')).toBeNull();
  });
});

describe('DocumentationPage', () => {
  it('offers the description\'s history only where the host has one to show (ADR-0008)', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'History…' })).toBeNull();
    cleanup();
    const onOpenHistory = vi.fn();
    setup({ onOpenHistory });
    fireEvent.click(screen.getByRole('button', { name: 'History…' }));
    expect(onOpenHistory).toHaveBeenCalledOnce();
  });

  it('opens reading, with element refs already turned into links', () => {
    setup();
    expect(source()).toBeNull();
    expect(screen.getByTestId('source').textContent).toBe('Holds every order until [Billing](element:e2) takes it.');
    expect(screen.getByRole('heading', { name: 'Order Management' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('takes a pasted picture in and writes the reference where the caret is', async () => {
    const onAddImage = vi.fn(async () => 'screenshot.png');
    setup({ element: element({ description: 'Before.' }), onAddImage });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const area = source()!;
    area.setSelectionRange(area.value.length, area.value.length);

    await act(async () => {
      fireEvent.paste(area, { clipboardData: transfer([imageFile()]) });
    });

    expect(onAddImage).toHaveBeenCalledTimes(1);
    expect(source()!.value).toContain('![Screenshot](../images/screenshot.png)');
  });

  it('writes nothing when the host refuses the picture', async () => {
    // The refusal has already been shown as a toast; a broken reference in the
    // document on top of it would be the second bad thing to happen.
    const onAddImage = vi.fn(async () => undefined);
    setup({ element: element({ description: 'Before.' }), onAddImage });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await act(async () => {
      fireEvent.paste(source()!, { clipboardData: transfer([imageFile()]) });
    });

    expect(onAddImage).toHaveBeenCalled();
    expect(source()!.value).toBe('Before.');
  });

  it('lets ordinary text through, even when a picture rides along with it', async () => {
    // Copying from a rich document carries both; the words are what was meant.
    const onAddImage = vi.fn(async () => 'x.png');
    setup({ element: element({ description: 'Before.' }), onAddImage });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await act(async () => {
      fireEvent.paste(source()!, { clipboardData: transfer([imageFile()], 'some words') });
    });

    expect(onAddImage).not.toHaveBeenCalled();
  });

  it('takes a dropped picture the same way', async () => {
    const onAddImage = vi.fn(async () => 'plan.png');
    setup({ element: element({ description: '' }), onAddImage });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await act(async () => {
      fireEvent.drop(source()!, { dataTransfer: transfer([imageFile('Plan.png')]) });
    });

    expect(source()!.value).toContain('![Plan](../images/plan.png)');
  });

  it('offers no picture affordance to a host that cannot take one', async () => {
    setup({ element: element({ description: 'Before.' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await act(async () => {
      fireEvent.paste(source()!, { clipboardData: transfer([imageFile()]) });
    });

    expect(source()!.value).toBe('Before.');
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
    expect(updateElement).toHaveBeenLastCalledWith('e1', { description: 'One. Two.' }, 'field:e1:description');

    fireEvent.change(area!, { target: { value: 'One. Two. Three.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));
    expect(updateElement).toHaveBeenLastCalledWith('e1', { description: 'One. Two. Three.' }, 'field:e1:description');
    expect(source()).toBeNull();
  });

  it('clears the description when the draft is emptied', () => {
    const { updateElement } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(source()!, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));
    expect(updateElement).toHaveBeenLastCalledWith('e1', { description: undefined }, 'field:e1:description');
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

  it('gives the inspector slot the element, editable only while editing', () => {
    // What the fields ARE is the editor's business — this page takes them as a
    // slot. What it still decides is when they may be typed into: reading is
    // read-only even when the document is not.
    setup();
    const name = () => screen.getByLabelText('Name') as HTMLInputElement;
    expect(name().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(name().disabled).toBe(false);
  });

  it('renders nothing on the right when nobody fills the slot', () => {
    setup({ renderInspector: undefined });
    expect(screen.queryByLabelText('Name')).toBeNull();
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

  it('starts its top bar after the window controls, and drags the window with it', () => {
    setup({ windowChrome: { controlsInset: 78, draggable: true } });
    const bar = screen.getByRole('button', { name: 'Close documentation' }).parentElement!;
    expect(getComputedStyle(bar).paddingLeft).toBe('90px');
    // Read out of the style tags Emotion wrote: jsdom's CSSOM drops a
    // property it does not know, and this is exactly such a property.
    const css = Array.from(document.querySelectorAll('style')).map((tag) => tag.textContent).join('');
    const own = Array.from(bar.classList).find((name) => css.includes(`.${name}{`));
    const rules = (css.match(/[^{}]*\{[^{}]*\}/g) ?? []).filter((rule) => rule.includes(`.${own}`)).join('');
    expect(rules).toContain('-webkit-app-region:drag');
    expect(rules).toContain('button');
    expect(rules).toContain('-webkit-app-region:no-drag');
  });

  it('commits a pending draft when the page goes away', () => {
    const { updateElement, unmount } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(source()!, { target: { value: 'Unsaved words.' } });
    unmount();
    expect(updateElement).toHaveBeenLastCalledWith('e1', { description: 'Unsaved words.' }, 'field:e1:description');
  });
});

describe('DocumentationPage — the pictures the project holds (ADR-0009)', () => {
  const png = 'data:image/png;base64,AAAA';
  const library = [
    { file: 'cutover-k1.png', url: png },
    { file: 'whiteboard-k2.jpg', url: png },
  ];

  function withPictures(overrides: Partial<DocumentationPageProps> = {}) {
    const images = {
      library,
      usedBy: vi.fn((file: string) => (file === 'cutover-k1.png' ? ['Billing', 'ADR-0002 Keep the queue'] : [])),
      onRemove: vi.fn(),
    };
    const view = setup({
      element: element({ description: 'Shown: ![Cutover](../images/cutover-k1.png)' }),
      onAddImage: vi.fn(async () => 'x.png'),
      images,
      ...overrides,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    return { ...view, images };
  }

  it('lists them on request, and says which this page already shows', () => {
    withPictures();
    expect(screen.queryByTestId('doc-pictures')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pictures (2)' }));
    const strip = within(screen.getByTestId('doc-pictures'));
    expect(strip.getByText('cutover-k1.png')).toBeTruthy();
    expect(strip.getByText('whiteboard-k2.jpg')).toBeTruthy();
    expect(strip.getAllByText('Used on this page')).toHaveLength(1);
  });

  it('puts one into the text at the caret, by reference', () => {
    withPictures();
    fireEvent.click(screen.getByRole('button', { name: 'Pictures (2)' }));
    const [, insertWhiteboard] = within(screen.getByTestId('doc-pictures')).getAllByRole('button', { name: 'Insert' });
    act(() => { fireEvent.click(insertWhiteboard); });
    expect(source()!.value).toContain('![whiteboard-k2](../images/whiteboard-k2.jpg)');
  });

  it('asks before deleting, naming every document that shows it', () => {
    const { images } = withPictures();
    fireEvent.click(screen.getByRole('button', { name: 'Pictures (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete picture cutover-k1.png' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete cutover-k1.png?' });
    expect(dialog.textContent).toContain('Billing, ADR-0002 Keep the queue');
    expect(images.onRemove).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(images.onRemove).not.toHaveBeenCalled();
  });

  it('removes it once confirmed, and says so plainly for one nobody shows', () => {
    const { images } = withPictures();
    fireEvent.click(screen.getByRole('button', { name: 'Pictures (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete picture whiteboard-k2.jpg' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete whiteboard-k2.jpg?' });
    expect(dialog.textContent).toContain('No document shows it');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(images.onRemove).toHaveBeenCalledWith('whiteboard-k2.jpg');
  });

  it('offers no list to a host that has none', () => {
    setup({ element: element({ description: 'x' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.queryByRole('button', { name: /^Pictures/ })).toBeNull();
  });
});

describe('DocumentationPage — help with the markdown', () => {
  it('opens a table of what the page draws, with pictures when the host takes them', () => {
    setup({ element: element({ description: 'x' }), onAddImage: vi.fn(async () => 'x.png') });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Markdown help' }));
    const help = within(screen.getByTestId('markdown-help'));
    expect(help.getByText('[[Order Management]]')).toBeTruthy();
    expect(help.getByText('![caption](../images/file.png)')).toBeTruthy();
    expect(help.getByText(/business case/i)).toBeTruthy();
  });

  it('withdraws the picture row on a host that cannot take one in', () => {
    setup({ element: element({ description: 'x' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Markdown help' }));
    const help = within(screen.getByTestId('markdown-help'));
    expect(help.queryByText('![caption](../images/file.png)')).toBeNull();
    expect(help.getByText('[[Order Management]]')).toBeTruthy();
  });
});
