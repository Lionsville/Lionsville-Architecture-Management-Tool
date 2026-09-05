// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ElementInspector } from './ElementInspector';
import type { EditorActions } from './useEditorState';
import type {
  DesignDiagram,
  DesignElement,
  DesignModel,
  ElementKind,
  ParameterSpec,
} from '../types';

/**
 * U7a tabbed inspector: General / Appearance / Data. These tests assert (a)
 * every field that was reachable in the iteration-3 accordion is still reachable
 * under some tab (no persisted field dropped), (b) the shared ColorField accent
 * control round-trips hex/undefined, (c) the active tab resets when the selected
 * element id changes, (d) tab badges reflect set/overridden values, and (e)
 * readOnly disables controls in every tab. The `updateElement` onChange contract
 * is asserted — never MUI internals.
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
    parameters: {},
    ...overrides,
  };
}

function diagram(overrides: Partial<DesignDiagram> = {}): DesignDiagram {
  return { id: 'd1', kind: 'layer7', name: 'Layer 7', placements: [], ...overrides };
}

function model(el: DesignElement, dia: DesignDiagram): DesignModel {
  return { name: 'SD', customerName: 'ACME', diagrams: [dia], elements: [el], connections: [] };
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
  opts: { readOnly?: boolean; dia?: DesignDiagram; parameterSpecs?: ParameterSpec[]; extras?: React.ReactNode } = {},
) {
  const dia = opts.dia ?? diagram();
  const { actions, updateElement, setDomainGroup } = makeActions();
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <ElementInspector
        element={el}
        model={model(el, dia)}
        diagram={dia}
        readOnly={opts.readOnly ?? false}
        parameterSpecs={opts.parameterSpecs ?? []}
        actions={actions}
        onRequestDelete={vi.fn()}
        extras={opts.extras}
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

  it('General reaches Category, Vendor, Technology, Lifecycle, Managed, Description', () => {
    renderInspector(element());
    expect(screen.getByLabelText('Category')).toBeDefined();
    expect(screen.getByLabelText('Vendor')).toBeDefined();
    expect(screen.getByLabelText('Technology')).toBeDefined();
    expect(screen.getByLabelText('Lifecycle')).toBeDefined();
    expect(screen.getByLabelText('Managed')).toBeDefined();
    expect(screen.getByText('Description (markdown)')).toBeDefined();
  });

  it('General reaches the layer7 Placement block (zone read-out + domain group)', () => {
    const dia = diagram({ placements: [{ elementId: 'e1', zone: 'landscape', x: 0, y: 0 }] });
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

  it('Data reaches Operational aspects, Parameters, and the host extras slot', () => {
    const specs: ParameterSpec[] = [{ key: 'serviceLevel', label: 'Service level', input: 'text' }];
    renderInspector(element(), { parameterSpecs: specs, extras: <div>EXTRA_SLOT</div> });
    openTab('Data');
    expect(screen.getByText('OPERATIONAL ASPECTS')).toBeDefined();
    expect(screen.getByText('PARAMETERS')).toBeDefined();
    expect(screen.getByLabelText('Service level')).toBeDefined();
    expect(screen.getByText('EXTRA_SLOT')).toBeDefined();
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

  it('keeps the Vendor text field on the three kinds that carry one', () => {
    // The gate did not disappear — it moved back to the field it was about.
    for (const kind of ['application', 'managementTool', 'externalSystem'] as ElementKind[]) {
      const { unmount } = renderInspector(element({ kind }));
      expect(screen.getByLabelText('Vendor')).toBeDefined();
      unmount();
    }
    for (const kind of ['actor', 'inputChannel', 'component'] as ElementKind[]) {
      const { unmount } = renderInspector(element({ kind }));
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
          parameterSpecs={[]}
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
          parameterSpecs={[]}
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
    renderInspector(element({ vendor: 'SAP' }));
    expect(within(tab('General')).queryByText('●')).not.toBeNull();
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
    const specs: ParameterSpec[] = [{ key: 'serviceLevel', label: 'Service level', input: 'text' }];
    renderInspector(element({ iconKey: 'database' }), { readOnly: true, parameterSpecs: specs });

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
    expect((screen.getByLabelText('Service level') as HTMLInputElement).disabled).toBe(true);
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
