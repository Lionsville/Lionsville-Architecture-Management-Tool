// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ElementPalette, PALETTE_DRAG_MIME } from './ElementPalette';
import type { ElementKind, UploadedLogo } from '../../model/types';

/**
 * The palette after the "variant B, calmer" recut.
 *
 * Two contracts changed on purpose and are pinned here as changed: a CLICK now
 * opens — on a row and on a rail button alike — and the accessible name
 * `Add <kind>` sits on the tray's Place button, the control that actually places.
 * A DRAG still places directly from a closed row or a rail button, which is the
 * fast path and the reason click is free to open. An unavailable kind still
 * produces no row.
 *
 * That includes the domain group, which is no longer an exception anywhere:
 * it opens, it carries a colour, and it drags.
 */

afterEach(() => cleanup());

const KINDS: ElementKind[] = ['application', 'actor'];

const LIBRARY: UploadedLogo[] = [
  { key: 'salesforce', label: 'Salesforce', url: 'https://hal.test/logos/salesforce/content' },
];

function Harness({ initial = false }: { initial?: boolean }) {
  const [collapsed, setCollapsed] = useState(initial);
  return (
    <ThemeProvider theme={createTheme()}>
      <ElementPalette
        kinds={KINDS}
        onAdd={vi.fn()}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
      />
    </ThemeProvider>
  );
}

function renderPalette(props: Partial<React.ComponentProps<typeof ElementPalette>> = {}) {
  const onAdd = props.onAdd ?? vi.fn();
  render(
    <ThemeProvider theme={createTheme()}>
      <ElementPalette kinds={KINDS} {...props} onAdd={onAdd} />
    </ThemeProvider>,
  );
  return { onAdd: onAdd as ReturnType<typeof vi.fn> };
}

/** A minimal DataTransfer stand-in — jsdom's dragStart carries none. */
function dataTransfer() {
  return {
    data: {} as Record<string, string>,
    setData(key: string, value: string) {
      this.data[key] = value;
    },
    setDragImage: vi.fn(),
    effectAllowed: '',
  };
}

function payloadFrom(element: HTMLElement): unknown {
  const dt = dataTransfer();
  fireEvent.dragStart(element, { dataTransfer: dt });
  return JSON.parse(dt.data[PALETTE_DRAG_MIME]);
}

const row = (name: string) => screen.getByRole('button', { name, expanded: false });
const openRow = (name: string) => screen.getByRole('button', { name, expanded: true });

describe('ElementPalette — the calm panel', () => {
  it('is a docked aside with quiet group captions and label-only rows', () => {
    render(<Harness />);
    expect(screen.getByRole('complementary', { name: 'Element palette' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Applications & components' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'People & context' })).toBeDefined();
    expect(screen.getByText('Application')).toBeDefined();
    expect(screen.getByText('Actor')).toBeDefined();
    // The description line is gone from the rows — it lives in the rail tooltip.
    expect(screen.queryByText('A system the customer runs or buys')).toBeNull();
  });

  it('has no search field', () => {
    render(<Harness />);
    expect(screen.queryByLabelText('Search elements')).toBeNull();
  });

  it('renders no caption for a group whose kinds the diagram does not offer', () => {
    renderPalette({ kinds: ['application'] });
    expect(screen.getByRole('heading', { name: 'Applications & components' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'People & context' })).toBeNull();
    expect(screen.queryByText('Actor')).toBeNull();
  });

  it('offers the domain group only when the host handles it', () => {
    renderPalette();
    expect(screen.queryByText('Domain group')).toBeNull();

    cleanup();
    renderPalette({ onAddDomainGroup: vi.fn() });
    expect(screen.getByText('Domain group')).toBeDefined();
  });
});

/**
 * The domain group used to be the panel's one exception: it added on click,
 * because a layout rect was held to have nothing worth configuring. It has a
 * colour, so it opens like everything else. These tests exist to stop the
 * exception coming back.
 */
describe('ElementPalette — the domain group row', () => {
  it('opens a tray with a name and a colour, and no logo grid', () => {
    const onAddDomainGroup = vi.fn();
    renderPalette({ onAddDomainGroup });
    fireEvent.click(row('Domain group'));

    expect(onAddDomainGroup).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Domain group name')).toBeDefined();
    expect(screen.getByLabelText('Domain group colour')).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Logo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add domain group' })).toBeDefined();
  });

  it('places with the typed name and picked colour', () => {
    const onAddDomainGroup = vi.fn();
    renderPalette({ onAddDomainGroup });
    fireEvent.click(row('Domain group'));
    fireEvent.change(screen.getByLabelText('Domain group name'), {
      target: { value: 'Commerce' },
    });
    fireEvent.change(screen.getByLabelText('Domain group colour'), {
      target: { value: '#2f6fdb' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain group' }));

    expect(onAddDomainGroup).toHaveBeenCalledWith({ name: 'Commerce', color: '#2f6fdb' });
  });

  it('places with no seed at all when the tray was left alone', () => {
    const onAddDomainGroup = vi.fn();
    renderPalette({ onAddDomainGroup });
    fireEvent.click(row('Domain group'));
    fireEvent.click(screen.getByRole('button', { name: 'Add domain group' }));

    expect(onAddDomainGroup).toHaveBeenCalledWith(undefined);
  });

  it('clears back to inherit, rather than to a colour that looks like grey', () => {
    const onAddDomainGroup = vi.fn();
    renderPalette({ onAddDomainGroup });
    fireEvent.click(row('Domain group'));
    fireEvent.change(screen.getByLabelText('Domain group colour'), {
      target: { value: '#2f6fdb' },
    });
    fireEvent.click(screen.getByLabelText('Clear colour'));
    fireEvent.click(screen.getByRole('button', { name: 'Add domain group' }));

    expect(onAddDomainGroup).toHaveBeenCalledWith(undefined);
  });

  it('drags onto the board like any other row', () => {
    renderPalette({ onAddDomainGroup: vi.fn() });
    fireEvent.click(row('Domain group'));
    fireEvent.change(screen.getByLabelText('Domain group colour'), {
      target: { value: '#2f6fdb' },
    });

    expect(payloadFrom(openRow('Domain group'))).toEqual({
      kind: 'domainGroup',
      color: '#2f6fdb',
    });
  });

  it('shows the name it will get, so an empty field is not a mystery', () => {
    renderPalette({ onAddDomainGroup: vi.fn() });
    fireEvent.click(row('Domain group'));
    expect(screen.getByLabelText('Domain group name').getAttribute('placeholder')).toBe(
      'New group',
    );
  });
});

describe('ElementPalette — pressing a row opens it', () => {
  it('opens the tray instead of adding', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(row('Application'));

    expect(onAdd).not.toHaveBeenCalled();
    expect(openRow('Application')).toBeDefined();
    expect(screen.getByRole('group', { name: 'Logo' })).toBeDefined();
    expect(screen.getByLabelText('Application name')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add application' })).toBeDefined();
  });

  it('places with no seed when the tray was left untouched', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(row('Application'));
    fireEvent.click(screen.getByRole('button', { name: 'Add application' }));

    expect(onAdd).toHaveBeenCalledWith('application', undefined);
    // Placing closes the tray again.
    expect(row('Application')).toBeDefined();
  });

  it('places with the chosen logo and typed name', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(row('Application'));
    fireEvent.click(screen.getByLabelText('Database'));
    fireEvent.change(screen.getByLabelText('Application name'), {
      target: { value: 'Kernsysteem' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add application' }));

    expect(onAdd).toHaveBeenCalledWith('application', {
      iconKey: 'database',
      name: 'Kernsysteem',
    });
  });

  it('treats a whitespace-only name as no name at all', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(row('Application'));
    fireEvent.change(screen.getByLabelText('Application name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add application' }));

    expect(onAdd).toHaveBeenCalledWith('application', undefined);
  });

  it('places on Enter in the name field', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(row('Application'));
    const field = screen.getByLabelText('Application name');
    fireEvent.change(field, { target: { value: 'CRM' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(onAdd).toHaveBeenCalledWith('application', { name: 'CRM' });
  });

  it('keeps one row open at a time', () => {
    renderPalette();
    fireEvent.click(row('Application'));
    fireEvent.click(row('Actor'));

    expect(openRow('Actor')).toBeDefined();
    expect(row('Application')).toBeDefined();
  });

  it('closes on Escape and hands focus back to the row', () => {
    renderPalette();
    fireEvent.click(row('Application'));
    fireEvent.keyDown(screen.getByRole('group', { name: 'Logo' }), { key: 'Escape' });

    const closed = row('Application');
    expect(closed).toBeDefined();
    expect(document.activeElement).toBe(closed);
  });
});

describe('ElementPalette — the logo tray', () => {
  /**
   * DELIBERATE FLIP (Phase 3): the tray used to offer a logo on the three
   * vendor-bearing kinds only. Every element row now gets the grid — an actor or
   * an input channel earns a mark as much as an application does, and the old
   * gate was really about the `vendor` text FIELD. The domain group still has
   * none: it is a labelled region, not a thing with an identity.
   */
  it('offers icons on every element row', () => {
    renderPalette();
    fireEvent.click(row('Actor'));
    expect(screen.getByRole('group', { name: 'Logo' })).toBeDefined();
    expect(screen.getByLabelText('Actor name')).toBeDefined();
  });

  it('offers none on the domain group — a labelled region has no identity', () => {
    renderPalette({ onAddDomainGroup: vi.fn() });
    fireEvent.click(row('Domain group'));
    expect(screen.queryByRole('group', { name: 'Logo' })).toBeNull();
  });

  it('places an actor with a picked mark — the flip is wired, not just rendered', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(row('Actor'));
    fireEvent.click(screen.getByLabelText('Crew'));
    fireEvent.click(screen.getByRole('button', { name: 'Add actor' }));

    expect(onAdd).toHaveBeenCalledWith('actor', { iconKey: 'rail-crew' });
  });

  it('lists uploaded library entries as images, never as inline markup', () => {
    renderPalette({ logoLibrary: LIBRARY });
    fireEvent.click(row('Application'));

    const tile = screen.getByLabelText('Salesforce');
    const image = within(tile).getByRole('presentation');
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe(LIBRARY[0].url);
  });

  it('places with an uploaded key', () => {
    const { onAdd } = renderPalette({ logoLibrary: LIBRARY });
    fireEvent.click(row('Application'));
    fireEvent.click(screen.getByLabelText('Salesforce'));
    fireEvent.click(screen.getByRole('button', { name: 'Add application' }));

    expect(onAdd).toHaveBeenCalledWith('application', { iconKey: 'salesforce' });
  });

  it('shows the upload tile only when the host can handle it', () => {
    const onRequestLogoUpload = vi.fn();
    const { unmount } = render(
      <ThemeProvider theme={createTheme()}>
        <ElementPalette kinds={KINDS} onAdd={vi.fn()} onRequestLogoUpload={onRequestLogoUpload} />
      </ThemeProvider>,
    );
    fireEvent.click(row('Application'));
    fireEvent.click(screen.getByLabelText('Upload a logo'));
    expect(onRequestLogoUpload).toHaveBeenCalledTimes(1);
    unmount();

    renderPalette();
    fireEvent.click(row('Application'));
    expect(screen.queryByLabelText('Upload a logo')).toBeNull();
  });
});

describe('ElementPalette — dragging', () => {
  it('places directly from a closed row, carrying only the kind', () => {
    renderPalette();
    expect(payloadFrom(row('Application'))).toEqual({ kind: 'application' });
  });

  it('carries the tray choices once they are made', () => {
    renderPalette({ logoLibrary: LIBRARY });
    fireEvent.click(row('Application'));
    fireEvent.click(screen.getByLabelText('Salesforce'));
    fireEvent.change(screen.getByLabelText('Application name'), { target: { value: 'CRM' } });

    expect(payloadFrom(openRow('Application'))).toEqual({
      kind: 'application',
      iconKey: 'salesforce',
      name: 'CRM',
    });
  });

  it('never sets a source discriminator — the row already knows its kind', () => {
    renderPalette();
    expect(payloadFrom(row('Application'))).not.toHaveProperty('source');
  });

  it('hands a rendered preview to setDragImage instead of the row ghost', () => {
    renderPalette();
    const dt = dataTransfer();
    fireEvent.dragStart(row('Application'), { dataTransfer: dt });

    expect(dt.setDragImage).toHaveBeenCalledTimes(1);
    const [node] = dt.setDragImage.mock.calls[0] as [HTMLElement];
    expect(node).toBeInstanceOf(HTMLElement);
    expect(node.textContent).toContain('Application');
  });

  it('still drags when the browser offers no setDragImage', () => {
    renderPalette();
    const dt = dataTransfer();
    const withoutDragImage = { ...dt, setDragImage: undefined };
    fireEvent.dragStart(row('Application'), { dataTransfer: withoutDragImage });

    expect(JSON.parse(withoutDragImage.data[PALETTE_DRAG_MIME])).toEqual({ kind: 'application' });
  });
});

describe('ElementPalette — the collapsed rail', () => {
  /** A palette whose collapse state the test can drive, as the editor does. */
  function Collapsible(props: Partial<React.ComponentProps<typeof ElementPalette>> = {}) {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <ThemeProvider theme={createTheme()}>
        <ElementPalette
          kinds={KINDS}
          onAdd={vi.fn()}
          {...props}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
        />
      </ThemeProvider>
    );
  }

  it('drops the labels but keeps a button per kind and an expand toggle', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Collapse palette'));

    expect(screen.queryByText('Application')).toBeNull();
    expect(screen.getByLabelText('Open application options')).toBeDefined();
    expect(screen.getByLabelText('Open actor options')).toBeDefined();
    expect(screen.getByLabelText('Expand palette')).toBeDefined();
  });

  it('opens the panel at that row instead of placing', () => {
    const onAdd = vi.fn();
    render(<Collapsible onAdd={onAdd} />);
    fireEvent.click(screen.getByLabelText('Collapse palette'));
    fireEvent.click(screen.getByLabelText('Open application options'));

    expect(onAdd).not.toHaveBeenCalled();
    expect(openRow('Application')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add application' })).toBeDefined();
  });

  it('reopens with the draft made before the collapse', () => {
    const onAdd = vi.fn();
    render(<Collapsible onAdd={onAdd} />);
    fireEvent.click(row('Application'));
    fireEvent.click(screen.getByLabelText('Database'));
    fireEvent.click(screen.getByLabelText('Collapse palette'));
    fireEvent.click(screen.getByLabelText('Open application options'));
    fireEvent.click(screen.getByRole('button', { name: 'Add application' }));

    expect(onAdd).toHaveBeenCalledWith('application', { iconKey: 'database' });
  });

  it('still places by drag, which is the point of not placing on click', () => {
    renderPalette({ collapsed: true });
    expect(payloadFrom(screen.getByLabelText('Open application options'))).toEqual({
      kind: 'application',
    });
  });

  it('opens the domain group too — no icon on this rail behaves differently', () => {
    const onAddDomainGroup = vi.fn();
    render(<Collapsible onAddDomainGroup={onAddDomainGroup} />);
    fireEvent.click(screen.getByLabelText('Collapse palette'));
    fireEvent.click(screen.getByLabelText('Open domain group options'));

    expect(onAddDomainGroup).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Domain group colour')).toBeDefined();
  });

  it('drags a domain group straight off the rail', () => {
    renderPalette({ collapsed: true, onAddDomainGroup: vi.fn() });
    expect(payloadFrom(screen.getByLabelText('Open domain group options'))).toEqual({
      kind: 'domainGroup',
    });
  });
});
