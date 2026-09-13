// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { V3Diagram } from '../model/testFixtures';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ElementInspector } from './ElementInspector';
import type { EditorActions } from './useEditorState';
import type { DesignDiagram, DesignElement, DesignModel, ElementKind } from '../model/types';

/**
 * U7a tabbed inspector: General / Appearance / Data. These tests assert (a)
 * every field an element has is reachable — under some tab beside the canvas,
 * or in the record on the page (`layout="stacked"`), and nothing persisted is
 * dropped, (b) the shared ColorField accent control round-trips hex/undefined,
 * (c) the active tab resets when the selected element id changes, (d) tab
 * badges reflect set/overridden values, and (e) readOnly disables controls in
 * every tab. The `updateElement` onChange contract is asserted — never MUI
 * internals.
 */

afterEach(() => cleanup());

function element(overrides: Partial<DesignElement> = {}): DesignElement {
  return {
    id: 'e1',
    kind: 'application',
    name: 'Webshop',
    lifecycle: 'live',
    isManaged: false,
    aspects: {},
    ...overrides,
  };
}

function diagram(overrides: Partial<V3Diagram> = {}): DesignDiagram {
  return laidOut({ id: 'd1', kind: 'layer7', name: 'Layer 7', placements: [], ...overrides });
}

function model(el: DesignElement, dia: DesignDiagram): DesignModel {
  return { name: 'SD', diagrams: [dia], elements: [el], relations: [] };
}

/**
 * EditorActions stub: a Proxy hands back a fresh no-op for any action not
 * explicitly stubbed so the type is satisfied without spelling out every method.
 */
function makeActions(): {
  actions: EditorActions;
  updateElement: ReturnType<typeof vi.fn>;
  setDomainGroup: ReturnType<typeof vi.fn>;
} {
  const updateElement = vi.fn();
  const setDomainGroup = vi.fn();
  const actions = new Proxy({ updateElement, setDomainGroup } as Record<string | symbol, unknown>, {
    get(target, prop) {
      return target[prop] ?? vi.fn();
    },
  }) as unknown as EditorActions;
  return { actions, updateElement, setDomainGroup };
}

function renderInspector(
  el: DesignElement,
  opts: {
    readOnly?: boolean;
    dia?: DesignDiagram;
    onReplace?: (id: string) => void;
    owned?: { label: string; fields: readonly string[]; onOpen?: () => void; description?: string };
    /** `stacked` is the page, where the record's fields are laid out. */
    layout?: 'tabs' | 'stacked';
    onOpenDocumentation?: (id: string) => void;
    others?: DesignElement[];
  } = {},
) {
  const dia = opts.dia ?? diagram();
  const { actions, updateElement, setDomainGroup } = makeActions();
  const m = model(el, dia);
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <ElementInspector
        element={el}
        model={{ ...m, elements: [...m.elements, ...(opts.others ?? [])] }}
        diagram={dia}
        readOnly={opts.readOnly ?? false}
        actions={actions}
        onRequestDelete={vi.fn()}
        onReplace={opts.onReplace}
        owned={opts.owned}
        layout={opts.layout}
        onOpenDocumentation={opts.onOpenDocumentation}
      />
    </ThemeProvider>,
  );
  return { ...view, updateElement, setDomainGroup };
}

const tab = (name: 'General' | 'Appearance' | 'Data') =>
  screen.getByRole('tab', { name });
const openTab = (name: 'General' | 'Appearance' | 'Data') => fireEvent.click(tab(name));

/** MUI non-native Select exposes disabled via aria-disabled on its combobox. */
const selectDisabled = (labelText: string) =>
  screen.getByLabelText(labelText).getAttribute('aria-disabled') === 'true';

describe('ElementInspector — tab structure (U7a)', () => {
  it('renders three tabs with General active first; header + Delete stay outside tabs', () => {
    renderInspector(element());
    expect(screen.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Appearance' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Data' })).toBeDefined();
    // Header (kind + Name) and Delete are always visible regardless of tab.
    expect(screen.getByText('Application')).toBeDefined();
    expect(screen.getByLabelText('Name')).toBeDefined();
    expect(screen.getByRole('button', { name: /Remove \/ delete/ })).toBeDefined();
  });

  it('General reaches Category, Lifecycle, Managed, Description — and the record is one line and a way to the page', () => {
    // Vendor, technology, owner, the dates and the successor left the panel
    // for the page (`ElementRecord.tsx`): they are what a thing IS, not what
    // a person sets while drawing it. What stays here is a read-out.
    const onOpenDocumentation = vi.fn();
    renderInspector(element({ vendor: 'SAP', owner: 'Logistics' }), { onOpenDocumentation });
    expect(screen.getByLabelText('Category')).toBeDefined();
    expect(screen.getByLabelText('Lifecycle')).toBeDefined();
    expect(screen.getByLabelText('Managed')).toBeDefined();
    expect(screen.getByText('Description (markdown)')).toBeDefined();
    expect(screen.queryByLabelText('Vendor')).toBeNull();
    expect(screen.queryByLabelText('Owner')).toBeNull();
    expect(screen.getByTestId('record-summary').textContent).toContain('Owner: Logistics · Vendor: SAP');
    fireEvent.click(screen.getByRole('button', { name: 'Details ›' }));
    expect(onOpenDocumentation).toHaveBeenCalledWith('e1');
  });

  it('says the record is empty rather than showing nothing, and offers no page where there is none', () => {
    renderInspector(element());
    expect(screen.getByTestId('record-summary').textContent).toContain('Nothing on the record yet');
    expect(screen.queryByRole('button', { name: 'Details ›' })).toBeNull();
  });

  it('General reaches the layer7 Placement block (zone read-out + domain group)', () => {
    const dia = diagram({ placements: [{ id: 'e1', zone: 'landscape', x: 0, y: 0 }] });
    renderInspector(element(), { dia });
    expect(screen.getByText(/Zone:/)).toBeDefined();
    expect(screen.getByLabelText('Domain group')).toBeDefined();
  });

  it('Appearance reaches Accent colour, Shape, the icon grid and its size', () => {
    renderInspector(element());
    openTab('Appearance');
    expect(screen.getByLabelText('Accent colour')).toBeDefined();
    expect(screen.getByLabelText('Shape')).toBeDefined();
    expect(screen.getByRole('group', { name: 'Icon' })).toBeDefined();
    expect(screen.getByLabelText('Icon size')).toBeDefined();
  });

  it('Data reaches Operational aspects', () => {
    renderInspector(element());
    openTab('Data');
    expect(screen.getByText('OPERATIONAL ASPECTS')).toBeDefined();
  });
});

describe('ElementInspector — ColorField accent (U7a, D4)', () => {
  it('writes a hex on change', () => {
    const { updateElement } = renderInspector(element());
    openTab('Appearance');
    fireEvent.change(screen.getByLabelText('Accent colour'), { target: { value: '#ff0000' } });
    expect(updateElement).toHaveBeenCalledWith('e1', { accentColor: '#ff0000' });
  });

  it('clears to undefined via the inline clear affordance', () => {
    const { updateElement } = renderInspector(element({ accentColor: '#ff0000' }));
    openTab('Appearance');
    fireEvent.click(screen.getByLabelText('Clear accent colour'));
    expect(updateElement).toHaveBeenCalledWith('e1', { accentColor: undefined });
  });

  it('disables the clear affordance when no accent is set', () => {
    renderInspector(element());
    openTab('Appearance');
    expect((screen.getByLabelText('Clear accent colour') as HTMLButtonElement).disabled).toBe(true);
  });
});

/**
 * The icon picker. Phase 3 replaced the Autocomplete with `LogoGrid`, and lit
 * the slot for EVERY kind — the vendor gate that used to sit here was about the
 * `vendor` text field and had no business deciding whether an actor may have a
 * mark. The write/clear contract is unchanged and still asserted through
 * `updateElement`; the grid's own behaviour lives in `nodes/LogoGrid.test.tsx`.
 */
describe('ElementInspector — icon picker (now a grid, in Appearance)', () => {
  it('picking a tile writes its iconKey via updateElement', () => {
    const { updateElement } = renderInspector(element());
    openTab('Appearance');

    fireEvent.click(screen.getByLabelText('Database'));

    expect(updateElement).toHaveBeenCalledWith('e1', { iconKey: 'database' });
  });

  it('the None tile writes iconKey: undefined (clear-to-NULL path)', () => {
    const { updateElement } = renderInspector(element({ iconKey: 'database' }));
    openTab('Appearance');

    fireEvent.click(within(screen.getByRole('group', { name: 'Icon' })).getByLabelText('None'));

    expect(updateElement).toHaveBeenCalledWith('e1', { iconKey: undefined });
  });

  it('renders for every kind — a deliberate flip from the three-kind gate', () => {
    for (const kind of [
      'application',
      'managementTool',
      'externalSystem',
      'actor',
      'inputChannel',
      'component',
    ] as ElementKind[]) {
      const { unmount } = renderInspector(element({ kind }));
      openTab('Appearance');
      expect(screen.getByRole('group', { name: 'Icon' })).toBeDefined();
      unmount();
    }
  });

  it('keeps the Vendor text field on the kinds that carry one', () => {
    // The gate did not disappear — it moved back to the field it was about.
    // Three of the kinds that had one were the same `application` in three
    // bands (ADR-0012 §4), so what is left is the application itself.
    for (const kind of ['application'] as ElementKind[]) {
      const { unmount } = renderInspector(element({ kind }), { layout: 'stacked' });
      expect(screen.getByLabelText('Vendor')).toBeDefined();
      unmount();
    }
    for (const kind of ['actor', 'function', 'component'] as ElementKind[]) {
      const { unmount } = renderInspector(element({ kind }), { layout: 'stacked' });
      expect(screen.queryByLabelText('Vendor')).toBeNull();
      unmount();
    }
  });

  it('draws the tile marks decoratively so a reader announces each tile once', () => {
    renderInspector(element());
    openTab('Appearance');
    const tile = screen.getByLabelText('Database');
    expect(within(tile).queryByRole('img')).toBeNull();
  });
});

describe('ElementInspector — icon size', () => {
  it('writes "large" for the body mark', () => {
    const { updateElement } = renderInspector(element({ iconKey: 'database' }));
    openTab('Appearance');

    fireEvent.mouseDown(screen.getByLabelText('Icon size'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Large (body)'));

    expect(updateElement).toHaveBeenCalledWith('e1', { iconSize: 'large' });
  });

  it('clears back to NULL rather than storing an explicit "small"', () => {
    const { updateElement } = renderInspector(element({ iconKey: 'database', iconSize: 'large' }));
    openTab('Appearance');

    fireEvent.mouseDown(screen.getByLabelText('Icon size'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Small (header)'));

    expect(updateElement).toHaveBeenCalledWith('e1', { iconSize: undefined });
  });

  it('stays disabled until there is an icon to size', () => {
    renderInspector(element());
    openTab('Appearance');
    expect(selectDisabled('Icon size')).toBe(true);
    expect(screen.getByText('Pick an icon first')).toBeDefined();
  });

  it('dots the Appearance tab on its own', () => {
    renderInspector(element({ iconSize: 'large' }));
    expect(within(tab('Appearance')).queryByText('●')).not.toBeNull();
  });
});

describe('ElementInspector — active tab resets on selection change', () => {
  it('returns to General when the selected element id changes', () => {
    const { rerender } = render(
      <ThemeProvider theme={createTheme()}>
        <ElementInspector
          element={element({ id: 'e1' })}
          model={model(element({ id: 'e1' }), diagram())}
          diagram={diagram()}
          readOnly={false}
          actions={makeActions().actions}
          onRequestDelete={vi.fn()}
        />
      </ThemeProvider>,
    );
    openTab('Appearance');
    expect(screen.getByRole('tab', { name: 'Appearance' }).getAttribute('aria-selected')).toBe('true');

    rerender(
      <ThemeProvider theme={createTheme()}>
        <ElementInspector
          element={element({ id: 'e2', name: 'Other' })}
          model={model(element({ id: 'e2' }), diagram())}
          diagram={diagram()}
          readOnly={false}
          actions={makeActions().actions}
          onRequestDelete={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('ElementInspector — tab badges reflect set values', () => {
  it('shows no dots when nothing is set', () => {
    renderInspector(element());
    expect(within(tab('General')).queryByText('●')).toBeNull();
    expect(within(tab('Appearance')).queryByText('●')).toBeNull();
    expect(within(tab('Data')).queryByText('●')).toBeNull();
  });

  it('dots General when identity/status/prose is set', () => {
    renderInspector(element({ category: 'Core' }));
    expect(within(tab('General')).queryByText('●')).not.toBeNull();
  });

  it('does not dot General for the record, which is not under the tab any more', () => {
    renderInspector(element({ vendor: 'SAP' }));
    expect(within(tab('General')).queryByText('●')).toBeNull();
  });

  it('dots Appearance when an appearance override is set', () => {
    renderInspector(element({ accentColor: '#ff0000' }));
    expect(within(tab('Appearance')).queryByText('●')).not.toBeNull();
  });

  it('dots Data when an aspect is set', () => {
    renderInspector(element({ aspects: { platform: { status: 'managed' } } }));
    expect(within(tab('Data')).queryByText('●')).not.toBeNull();
  });
});

describe('ElementInspector — readOnly disables controls in every tab', () => {
  it('disables General, Appearance and Data controls', () => {
    renderInspector(element({ iconKey: 'database' }), { readOnly: true });

    // General
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true);
    expect(selectDisabled('Lifecycle')).toBe(true);
    expect((screen.getByLabelText('Managed') as HTMLInputElement).disabled).toBe(true);

    // Appearance
    openTab('Appearance');
    expect((screen.getByLabelText('Accent colour') as HTMLInputElement).disabled).toBe(true);
    expect(selectDisabled('Shape')).toBe(true);
    expect((screen.getByLabelText('Database') as HTMLButtonElement).disabled).toBe(true);
    expect(selectDisabled('Icon size')).toBe(true);

    // Data
    openTab('Data');
    expect(selectDisabled('Platform')).toBe(true);
  });
});

describe('ElementInspector — actor stickman shape (U7c/D11)', () => {
  it('offers the Box↔Stickman (figure) choice for actors only', () => {
    // Actor: the Shape select carries "Stickman".
    const actor = renderInspector(element({ kind: 'actor' }));
    openTab('Appearance');
    fireEvent.mouseDown(screen.getByLabelText('Shape'));
    expect(within(screen.getByRole('listbox')).getByText('Stickman')).toBeDefined();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    actor.unmount();

    // Application: no "Stickman" option.
    renderInspector(element({ kind: 'application' }));
    openTab('Appearance');
    fireEvent.mouseDown(screen.getByLabelText('Shape'));
    expect(within(screen.getByRole('listbox')).queryByText('Stickman')).toBeNull();
  });

  it('selecting Stickman writes shapeVariant: "figure" via updateElement', () => {
    const { updateElement } = renderInspector(element({ kind: 'actor' }));
    openTab('Appearance');
    fireEvent.mouseDown(screen.getByLabelText('Shape'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Stickman'));
    expect(updateElement).toHaveBeenCalledWith('e1', { shapeVariant: 'figure' });
  });
});

describe('ElementInspector — Replace… (ADR-0010)', () => {
  it('offers the gesture beside "Replaced by" when the host can start one', () => {
    const onReplace = vi.fn();
    renderInspector(element({ id: 'wms' }), { onReplace, layout: 'stacked' });
    fireEvent.click(screen.getByRole('button', { name: 'Replace…' }));
    expect(onReplace).toHaveBeenCalledWith('wms');
  });

  it('offers nothing without a host to answer it, or when read-only', () => {
    renderInspector(element(), { layout: 'stacked' });
    expect(screen.queryByRole('button', { name: 'Replace…' })).toBeNull();
    cleanup();
    renderInspector(element(), { readOnly: true, onReplace: vi.fn(), layout: 'stacked' });
    expect(screen.queryByRole('button', { name: 'Replace…' })).toBeNull();
  });
});

/**
 * A stand-in: drawn on this board, defined in another scope (ADR-0012 §3, §10).
 *
 * The list of fields is handed in rather than known here, so what this panel
 * greys out and what an agent's `element.update` is refused for are the same
 * list. The test therefore passes the real one — the point of it is that a
 * field added to `projects/mayEdit.FIXED_ON_A_STANDIN` locks here with no
 * change to the editor.
 */
describe('ElementInspector — a record another scope answers for', () => {
  const owned = {
    label: 'acme/retail',
    fields: ['name', 'ref', 'lifecycle', 'lifecycleDates', 'vendor', 'technology', 'category', 'owner', 'isManaged', 'successorId', 'aspects', 'outside', 'partyId', 'scopes'],
  };

  it('says where it is defined, and offers to open that scope', () => {
    const onOpen = vi.fn();
    renderInspector(element(), { owned: { ...owned, onOpen } });
    expect(screen.getByTestId('owned-elsewhere').textContent).toContain('acme/retail');
    fireEvent.click(screen.getByRole('button', { name: 'Open acme/retail' }));
    expect(onOpen).toHaveBeenCalled();
  });

  it('draws no way out when there is nowhere to go', () => {
    renderInspector(element(), { owned });
    expect(screen.getByTestId('owned-elsewhere')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull();
  });

  it('shows the owner\'s description in place of its own, read-only', () => {
    renderInspector(element({ description: 'What this scope once wrote' }), {
      owned: { ...owned, fields: [...owned.fields, 'description'], description: 'What the owner says' },
      layout: 'stacked',
    });
    expect(screen.getByText('What the owner says')).toBeDefined();
    expect(screen.queryByText('What this scope once wrote')).toBeNull();
  });

  it('shows the owner\'s detail read-only, and the cached name with it', () => {
    renderInspector(element({ vendor: 'Someone' }), { owned, layout: 'stacked' });
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Vendor') as HTMLInputElement).disabled).toBe(true);
    expect(selectDisabled('Lifecycle')).toBe(true);
    expect((screen.getByLabelText('Owner') as HTMLInputElement).disabled).toBe(true);
  });

  /**
   * The one field a stand-in may say for itself: what the thing means from
   * here, which is a different page from what it IS and is allowed to be.
   */
  it('leaves this scope\'s own account of it writable', () => {
    const { updateElement } = renderInspector(element(), { owned });
    const description = screen.getByLabelText('Description') as HTMLTextAreaElement;
    expect(description.disabled).toBe(false);
    fireEvent.change(description, { target: { value: 'What it means to us.' } });
    expect(updateElement).toHaveBeenCalledWith(
      'e1', { description: 'What it means to us.' }, expect.any(String),
    );
  });

  it('says nothing at all about a record this scope defines', () => {
    renderInspector(element());
    expect(screen.queryByTestId('owned-elsewhere')).toBeNull();
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(false);
  });
});

/**
 * The record, on the page (`ElementRecord.tsx`): the owner's detail laid out
 * in full, and — for the first time on any screen — whether the thing is
 * ours and whose it is otherwise.
 */
describe('ElementInspector — the record on the page', () => {
  const actor = (id: string, name: string): DesignElement =>
    ({ id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {} });

  it('lays the record out: owner, vendor, technology, the dates and the successor', () => {
    const { updateElement } = renderInspector(element(), { layout: 'stacked' });
    expect(screen.getByLabelText('Owner')).toBeDefined();
    expect(screen.getByLabelText('Vendor')).toBeDefined();
    expect(screen.getByLabelText('Technology')).toBeDefined();
    expect(screen.getByLabelText('Live from')).toBeDefined();
    expect(screen.getByLabelText('Replaced by')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'Logistics' } });
    expect(updateElement).toHaveBeenCalledWith('e1', { owner: 'Logistics' }, expect.any(String));
  });

  it('writes `outside` as true or absent, never false — and drops the party with it', () => {
    const { updateElement } = renderInspector(element(), { layout: 'stacked' });
    fireEvent.click(screen.getByLabelText('Outside the organisation'));
    expect(updateElement).toHaveBeenLastCalledWith('e1', { outside: true });
    cleanup();
    const again = renderInspector(element({ outside: true, partyId: 'p1' }), { layout: 'stacked', others: [actor('p1', 'ProRail')] });
    fireEvent.click(screen.getByLabelText('Outside the organisation'));
    expect(again.updateElement).toHaveBeenLastCalledWith('e1', { outside: undefined, partyId: undefined });
  });

  it('asks whose it is only once it is outside, offering the actors of this scope', () => {
    renderInspector(element(), { layout: 'stacked', others: [actor('p1', 'ProRail')] });
    expect(screen.queryByLabelText('Belongs to')).toBeNull();
    cleanup();
    const { updateElement } = renderInspector(element({ outside: true }), { layout: 'stacked', others: [actor('p1', 'ProRail')] });
    fireEvent.mouseDown(screen.getByLabelText('Belongs to'));
    fireEvent.click(screen.getByRole('option', { name: 'ProRail' }));
    expect(updateElement).toHaveBeenLastCalledWith('e1', { partyId: 'p1' });
  });

  it('asks whether it is ours of an application and an actor, and of nothing else', () => {
    for (const kind of ['application', 'actor'] as ElementKind[]) {
      const { unmount } = renderInspector(element({ kind }), { layout: 'stacked' });
      expect(screen.getByLabelText('Outside the organisation')).toBeDefined();
      unmount();
    }
    for (const kind of ['function', 'component', 'step'] as ElementKind[]) {
      const { unmount } = renderInspector(element({ kind }), { layout: 'stacked' });
      expect(screen.queryByLabelText('Outside the organisation')).toBeNull();
      unmount();
    }
  });

  it('keeps Appearance beside the canvas: the page draws no card to colour', () => {
    renderInspector(element({ iconKey: 'database' }), { layout: 'stacked' });
    expect(screen.queryByLabelText('Accent colour')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Icon' })).toBeNull();
    expect(screen.getByText('OPERATIONAL ASPECTS')).toBeDefined();
  });

  it('reads the party back into the panel\'s one line', () => {
    renderInspector(element({ outside: true, partyId: 'p1' }), { others: [actor('p1', 'ProRail')] });
    expect(screen.getByTestId('record-summary').textContent).toContain('Outside · ProRail');
  });
});
