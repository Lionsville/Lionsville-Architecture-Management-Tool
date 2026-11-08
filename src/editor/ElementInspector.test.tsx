// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { V3Diagram } from '../model/testFixtures';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { testTheme } from './testing/theme';
import { ElementInspector } from './ElementInspector';
import { RECORD_SECTIONS, RecordSectionBody, recordSectionsOf } from './inspector/elementRows';
import { rowsShown, addLabel } from './inspector/rowTools';
import { EN as en } from './strings/en';
import type { ElementInspectorProps } from './ElementInspector';
import type { EditorActions } from './useEditorState';
import type { DesignDiagram, DesignElement, DesignModel, ElementKind } from '../model/types';
import type { LeverageLine } from '../model/leverage';
import { axeFindings } from '../app/testing/axe';
import { chooseValue } from '../widgets/kit/testing/select';

/**
 * The one panel for an element, and its rows on the record: every field an element
 * has is reachable, nothing persisted is dropped, rows read as text until pressed,
 * an empty field stays out of the panel until asked for, and readOnly presses
 * nothing. The `updateElement` contract is asserted, never a control's internals.
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
  setHostedOn: ReturnType<typeof vi.fn>;
  setUses: ReturnType<typeof vi.fn>;
  setRealises: ReturnType<typeof vi.fn>;
  setMaintainedBy: ReturnType<typeof vi.fn>;
} {
  const updateElement = vi.fn();
  const setDomainGroup = vi.fn();
  const setHostedOn = vi.fn();
  const setUses = vi.fn(() => ({ refused: [] }));
  const setRealises = vi.fn();
  const setMaintainedBy = vi.fn();
  const actions = new Proxy(
    { updateElement, setDomainGroup, setHostedOn, setUses, setRealises, setMaintainedBy } as Record<string | symbol, unknown>,
    { get(target, prop) { return target[prop] ?? vi.fn(); } },
  ) as unknown as EditorActions;
  return { actions, updateElement, setDomainGroup, setHostedOn, setUses, setRealises, setMaintainedBy };
}

function renderInspector(
  el: DesignElement,
  opts: {
    readOnly?: boolean;
    dia?: DesignDiagram;
    onReplace?: (id: string) => void;
    owned?: { label: string; fields: readonly string[]; onOpen?: () => void; description?: string };
    onOpenDocumentation?: (id: string) => void;
    others?: DesignElement[];
    /** Rows the model holds — what the hosting roll-up is read from (ADR-0013). */
    relations?: DesignModel['relations'];
    /** Who uses a service from another team, as the host works it out (ADR-0014). */
    offeredBeyond?: readonly string[];
    /** What an application leverages, as the host works it out over the tree (ADR-0014). */
    leverage?: LeverageLine;
    /** The technology the rest of the organisation defines (ADR-0017). */
    technology?: ElementInspectorProps['technology'];
    /** The actors the scopes above keep (ADR-0012 §4). */
    parties?: ElementInspectorProps['parties'];
    /** Make the application's container diagram, on purpose. */
    onCreateContainer?: (id: string) => void;
    /** The door to the technology landscape (ADR-0020). */
    onShowOnTechnology?: (id: string) => void;
    /** An actor's unit section, as the host draws it (ADR-0036 §3), and whether it leads. */
    unitSection?: ElementInspectorProps['unitSection'];
    /** The way to move the record to another scope (ADR-0012 §10). */
    move?: ElementInspectorProps['move'];
    /** Make a drawing anchored to the element. */
    onCreateDrawing?: (id: string) => void;
  } = {},
) {
  const dia = opts.dia ?? diagram();
  const { actions, updateElement, setDomainGroup, setHostedOn, setUses, setRealises, setMaintainedBy } = makeActions();
  const m = model(el, dia);
  const view = render(
    <ThemeProvider theme={testTheme}>
      <ElementInspector
        element={el}
        model={{
          ...m,
          elements: [...m.elements, ...(opts.others ?? [])],
          relations: opts.relations ?? [],
        }}
        diagram={dia}
        readOnly={opts.readOnly ?? false}
        actions={actions}
        onRequestDelete={vi.fn()}
        onReplace={opts.onReplace}
        owned={opts.owned}
        onOpenDocumentation={opts.onOpenDocumentation}
        onCreateContainer={opts.onCreateContainer}
        offeredBeyond={opts.offeredBeyond}
        leverage={opts.leverage}
        technology={opts.technology}
        parties={opts.parties}
        onShowOnTechnology={opts.onShowOnTechnology}
        unitSection={opts.unitSection}
        move={opts.move}
        onCreateDrawing={opts.onCreateDrawing}
      />
    </ThemeProvider>,
  );
  return { ...view, updateElement, setDomainGroup, setHostedOn, setUses, setRealises, setMaintainedBy };
}

const openTab = (name: 'Properties' | 'Appearance' | 'Comments') => fireEvent.click(screen.getByRole('tab', { name }));
const row = (testId: string) => screen.getByTestId(testId);
const press = (testId: string) => fireEvent.click(within(row(testId)).getByRole('button'));
const says = (testId: string) => row(testId).textContent ?? '';
function typeIn(testId: string, label: string, value: string) {
  press(testId);
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.keyDown(field, { key: 'Enter' });
}
const choose = (testId: string, label: string, value: string) => {
  press(testId);
  chooseValue(screen.getByLabelText(label), value);
};
const pick = (testId: string, option: string | RegExp) => {
  press(testId);
  fireEvent.click(screen.getByRole('option', { name: option }));
};
/** The record's sections, as the page lays them out. */
function renderRecord(el: DesignElement, over: Partial<ElementInspectorProps> = {}) {
  const updateElement = vi.fn();
  const { actions } = makeActions();
  const proxied = new Proxy({ updateElement } as Record<string | symbol, unknown>, { get: (target, prop) => target[prop] ?? (actions as unknown as Record<string | symbol, unknown>)[prop] }) as unknown as EditorActions;
  const dia = diagram();
  render(
    <ThemeProvider theme={testTheme}>
      {recordSectionsOf(el, (key) => (en as Record<string, string>)[key] ?? key).map((section) => (
        <RecordSectionBody
          key={section.id} section={section.id}
          props={{ element: el, model: model(el, dia), diagram: dia, readOnly: false, actions: proxied, onRequestDelete: vi.fn(), ...over }}
        />
      ))}
    </ThemeProvider>,
  );
  return { updateElement };
}

describe('ElementInspector: one shell', () => {
  it('holds the kind, a name that wraps and one line of facts, with tabs under them', () => {
    renderInspector(element({ certainty: 'assumed' }));
    expect(screen.getByRole('heading', { name: 'Webshop' })).toBeDefined();
    expect(screen.getByText('Application')).toBeDefined();
    expect(screen.getByText(/Live · Assumed/)).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Properties' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Appearance' })).toBeDefined();
  });

  it('turns the name into a field on a press, and on a rename request', () => {
    const { updateElement } = renderInspector(element());
    fireEvent.click(screen.getByRole('button', { name: /Change the name/ }));
    const field = screen.getByRole('textbox', { name: 'Change the name' });
    fireEvent.change(field, { target: { value: 'Shop' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(updateElement).toHaveBeenCalledWith('e1', { name: 'Shop' });
  });

  it('the way to the record has one word, and is absent where it cannot go', () => {
    const onOpenDocumentation = vi.fn();
    renderInspector(element(), { onOpenDocumentation });
    fireEvent.click(screen.getByTestId('open-details'));
    expect(onOpenDocumentation).toHaveBeenCalledWith('e1');
    expect(screen.getByTestId('open-details').textContent).toContain(en['record.open']);
    cleanup();
    renderInspector(element());
    expect(screen.queryByTestId('open-details')).toBeNull();
  });

  it('holds Move, and the delete last, in the ⋯', async () => {
    const onMove = vi.fn();
    renderInspector(element(), { move: { label: 'Move…', tip: 'Elsewhere', onMove } });
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
    expect(items.at(-1)).toContain(en['element.removeDelete']);
    fireEvent.click(screen.getByRole('menuitem', { name: /Move…/ }));
    expect(onMove).toHaveBeenCalled();
  });

  it('has no ⋯ read-only', () => {
    renderInspector(element(), { readOnly: true });
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('goes back to Properties when the selection moves to another element', () => {
    const view = renderInspector(element());
    openTab('Appearance');
    view.rerender(
      <ThemeProvider theme={testTheme}>
        <ElementInspector element={element({ id: 'e2', name: 'Other' })} model={model(element({ id: 'e2' }), diagram())} diagram={diagram()} readOnly={false} actions={makeActions().actions} onRequestDelete={vi.fn()} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('tab', { name: 'Properties' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('ElementInspector: rows, not boxes', () => {
  it('reads as text, with no field until a press, and a press writes one change', () => {
    const { updateElement } = renderInspector(element());
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    choose('element-lifecycle', 'Lifecycle', 'retiring');
    expect(updateElement).toHaveBeenCalledWith('e1', { lifecycle: 'retiring' });
  });

  it('says first lines of the description, and writes it with the shared editor on a press', () => {
    renderInspector(element({ description: 'Sells things.' }), { onOpenDocumentation: vi.fn() });
    expect(says('element-description')).toContain('Sells things.');
    expect(screen.getByTestId('open-documentation')).toBeDefined();
    // Named by the words it shows, which a voice user says to press it.
    fireEvent.click(screen.getByRole('button', { name: `${en['inspector.writeDescription']}: Sells things.` }));
    expect(screen.getByRole('button', { name: en['inspector.done'] })).toBeDefined();
  });

  it('offers to add a description where there is none, and nothing to press for a reader', () => {
    renderInspector(element());
    expect(screen.getByText(en['inspector.addDescription'])).toBeDefined();
    cleanup();
    renderInspector(element(), { readOnly: true });
    expect(screen.queryByText(en['inspector.addDescription'])).toBeNull();
  });

  it('takes a category picked or named, and writes nothing on a selection', () => {
    const other = element({ id: 'e2', category: 'Finance' });
    const { updateElement } = renderInspector(element(), { others: [other] });
    expect(updateElement).not.toHaveBeenCalled();
    pick('element-category', 'Finance');
    expect(updateElement).toHaveBeenCalledWith('e1', { category: 'Finance' });
  });
});

describe('ElementInspector: empty stays out of the panel', () => {
  it('leaves an empty owner, vendor and dates out, behind one + that says what it holds', () => {
    renderInspector(element());
    expect(screen.queryByTestId('record-vendor')).toBeNull();
    expect(screen.queryByTestId('record-owner')).toBeNull();
    expect(screen.queryByTestId('record-date-live')).toBeNull();
    expect(screen.getByRole('button', { name: /^\+ Owner, vendor, technology…/ })).toBeDefined();
  });

  it('shows one once filled, and + brings one in open', () => {
    const { updateElement } = renderInspector(element({ vendor: 'Acme' }));
    expect(says('record-vendor')).toContain('Acme');
    fireEvent.click(screen.getByRole('button', { name: /^\+ Owner/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Technology' }));
    const field = screen.getByLabelText('Technology');
    fireEvent.change(field, { target: { value: 'Java' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(updateElement).toHaveBeenCalledWith('e1', { technology: 'Java' });
  });

  it('adds nothing for a reader', () => {
    renderInspector(element(), { readOnly: true });
    expect(screen.queryByRole('button', { name: /^\+ / })).toBeNull();
  });

  it('holds its rule in one place: the record shows all, the panel what is filled', () => {
    const rows = [
      { key: 'a', label: 'A', rule: 'always' as const, filled: false, node: () => null },
      { key: 'b', label: 'B', rule: 'filled' as const, filled: false, node: () => null },
      { key: 'c', label: 'C', rule: 'filled' as const, filled: true, node: () => null },
    ];
    expect(rowsShown(rows, 'panel', new Set()).shown.map((one) => one.key)).toEqual(['a', 'c']);
    expect(rowsShown(rows, 'panel', new Set(['b'])).shown.map((one) => one.key)).toEqual(['a', 'b', 'c']);
    expect(rowsShown(rows, 'record', new Set()).held).toEqual([]);
    expect(addLabel([{ label: 'Owner' }, { label: 'Vendor' }, { label: 'Technology' }, { label: 'Dates' }])).toBe('Owner, vendor, technology…');
  });
});

describe('ElementInspector: the owner of an application is one field (ADR-0036, amended)', () => {
  const team = element({ id: 't1', kind: 'actor', name: 'Warehouse team' });

  it('reads the unit picked, and picking writes the unit', () => {
    const { updateElement } = renderInspector(element({ partyId: 't1' }), { others: [team, element({ id: 't2', kind: 'actor', name: 'Other team' })] });
    expect(says('record-owner')).toContain('Warehouse team');
    expect(screen.queryByTestId('owner-not-a-unit')).toBeNull();
    pick('record-owner', 'Other team');
    expect(updateElement).toHaveBeenCalledWith('e1', { partyId: 't2' });
  });

  it('takes a typed name, and flags it as not a unit', () => {
    const { updateElement } = renderInspector(element({ owner: 'Revenue systems' }), { others: [team] });
    expect(says('record-owner')).toContain('Revenue systems');
    expect(screen.getByTestId('owner-not-a-unit')).toBeDefined();
    press('record-owner');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Somebody' } });
    fireEvent.click(screen.getByRole('option', { name: /Somebody/ }));
    expect(updateElement).toHaveBeenCalledWith('e1', { owner: 'Somebody' });
  });

  it('clears both halves with one press', () => {
    const { updateElement } = renderInspector(element({ partyId: 't1' }), { others: [team] });
    pick('record-owner', 'Nobody');
    expect(updateElement.mock.calls[0][1]).toEqual({ owner: undefined, partyId: undefined });
  });

  it('offers the parties the scopes above keep, under the scope that keeps them, and writes the plain id', () => {
    const { updateElement } = renderInspector(element({ vendor: 'x', partyId: 'far' }), { parties: [{ id: 'far', name: 'Far team', where: 'Acme' }, { id: 'near', name: 'Near team', where: 'Acme' }] });
    expect(says('record-owner')).toContain('Far team');
    pick('record-owner', /Near team/);
    expect(updateElement).toHaveBeenCalledWith('e1', { partyId: 'near' });
  });

  it('shows a party nobody offers by its id rather than a blank', () => {
    renderInspector(element({ partyId: 'gone' }));
    expect(says('record-owner')).toContain('gone');
  });
});

describe('ElementInspector: the assumed mark', () => {
  it('is left out until asked for, says the word, and is written or taken off', () => {
    const { updateElement } = renderInspector(element({ certainty: 'assumed' }));
    expect(says('row-certainty')).toContain('Assumed');
    choose('row-certainty', 'Certainty', '');
    expect(updateElement).toHaveBeenCalledWith('e1', { certainty: undefined });
  });
});

describe('ElementInspector: dates, refused on the row', () => {
  it('reads a day in words, and keeps what was typed where it runs backwards, saying why', () => {
    const { updateElement } = renderInspector(element({ lifecycleDates: { live: '2027-03-01', retired: '2028-01-01' } }));
    expect(says('record-date-live')).toContain('2027');
    press('record-date-retired');
    const field = screen.getByLabelText('Gone on');
    fireEvent.change(field, { target: { value: '2026-01-01' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(updateElement).not.toHaveBeenCalled();
    expect(says('record-date-retired')).toContain(en['field.date.retired']);
    expect(screen.getByText(/run in order/)).toBeDefined();
  });
});

describe('ElementInspector: Replace… (ADR-0010)', () => {
  it('stands beside Replaced by where the host can start one, and nowhere else', () => {
    const onReplace = vi.fn();
    renderInspector(element({ successorId: 'e2' }), { onReplace, others: [element({ id: 'e2', name: 'Next' })] });
    expect(says('record-successor')).toContain('Next');
    fireEvent.click(screen.getByRole('button', { name: 'Replace…' }));
    expect(onReplace).toHaveBeenCalledWith('e1');
    cleanup();
    renderInspector(element({ successorId: 'e2' }), { readOnly: true, onReplace, others: [element({ id: 'e2', name: 'Next' })] });
    expect(screen.queryByRole('button', { name: 'Replace…' })).toBeNull();
  });
});

describe('ElementInspector: an actor as a unit (ADR-0036 §3; unit first, as built 3.6.1)', () => {
  const actor = element({ kind: 'actor', name: 'Dispatch' });
  const section = <div data-testid="unit-section">Roles</div>;

  it('keeps the element\'s order where it does not lead, the section after', () => {
    renderInspector(actor, { unitSection: { section, leads: false } });
    expect(row('unit-section')).toBeDefined();
    expect(screen.queryByTestId('element-fold')).toBeNull();
    expect(row('element-lifecycle').compareDocumentPosition(row('unit-section')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts a unit first, the element\'s own fields folded under it', () => {
    renderInspector(actor, { unitSection: { section, leads: true } });
    expect(row('unit-section').compareDocumentPosition(row('element-fold')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row('element-fold').getAttribute('aria-expanded')).toBe('false');
  });

  it('offers Create drawing in the ⋯ when it leads', () => {
    const onCreateDrawing = vi.fn();
    renderInspector(actor, { unitSection: { section, leads: true }, onCreateDrawing });
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: en['menu.createDrawing'] }));
    expect(onCreateDrawing).toHaveBeenCalledWith('e1');
  });
});

describe('ElementInspector: Appearance', () => {
  it('writes a hex and clears it, the NULL-inherit contract', () => {
    const { updateElement } = renderInspector(element({ accentColor: '#112233' }));
    openTab('Appearance');
    press('element-colour');
    fireEvent.change(screen.getByLabelText(en['field.accentColour']), { target: { value: '#445566' } });
    expect(updateElement).toHaveBeenCalledWith('e1', { accentColor: '#445566' });
  });

  it('opens the icon grid only on a press, for every kind', () => {
    for (const kind of ['application', 'actor', 'platform'] as ElementKind[]) {
      renderInspector(element({ kind }));
      openTab('Appearance');
      press('element-icon');
      expect(screen.getByRole('button', { name: en['inspector.done'] })).toBeDefined();
      cleanup();
    }
  });

  it('offers the icon size only once there is an icon, and clears it back to nothing', () => {
    renderInspector(element());
    openTab('Appearance');
    expect(screen.queryByTestId('element-icon-size')).toBeNull();
    cleanup();
    const { updateElement } = renderInspector(element({ iconKey: 'x', iconSize: 'large' }));
    openTab('Appearance');
    choose('element-icon-size', en['field.iconSize'], '');
    expect(updateElement).toHaveBeenCalledWith('e1', { iconSize: undefined });
  });

  it('offers the figure to an actor, and writes it', () => {
    const { updateElement } = renderInspector(element({ kind: 'actor' }));
    openTab('Appearance');
    choose('element-shape', en['field.shape'], 'figure');
    expect(updateElement).toHaveBeenCalledWith('e1', { shapeVariant: 'figure' });
  });

  it('says where it sits on this view, and files it under a group by name', () => {
    const dia = diagram({ groups: [{ id: 'g1', name: 'Commerce' }], placements: [{ id: 'e1', x: 0, y: 0, zone: 'landscape' }] } as never);
    const { actions } = makeActions();
    const fileUnderGroupNamed = vi.fn();
    const held = new Proxy(actions as object, { get: (target, prop) => (prop === 'fileUnderGroupNamed' ? fileUnderGroupNamed : (target as Record<string | symbol, unknown>)[prop]) }) as EditorActions;
    render(<ThemeProvider theme={testTheme}><ElementInspector element={element()} model={model(element(), dia)} diagram={dia} readOnly={false} actions={held} onRequestDelete={vi.fn()} /></ThemeProvider>);
    openTab('Appearance');
    expect(says('element-zone')).toBeTruthy();
    pick('element-group', 'Commerce');
    expect(fileUnderGroupNamed).toHaveBeenCalledWith(['e1'], 'Commerce');
  });
});

describe('ElementInspector: operational aspects', () => {
  it('are a section where the kind has them, one row each, and no empty tab anywhere', () => {
    renderInspector(element());
    expect(screen.queryByRole('tab', { name: 'Data' })).toBeNull();
    expect(screen.getByRole('heading', { name: en['section.operationalAspects'] })).toBeDefined();
    cleanup();
    renderInspector(element({ kind: 'actor' }));
    expect(screen.queryByRole('heading', { name: en['section.operationalAspects'] })).toBeNull();
  });
});

describe('ElementInspector: a record another scope answers for', () => {
  const owned = { label: 'Acme', fields: ['name', 'description', 'owner', 'vendor', 'technology', 'lifecycleDates', 'category', 'lifecycle'], description: 'From the owner.' };

  it('says once where it is defined, with a way there when there is one', () => {
    const onOpen = vi.fn();
    renderInspector(element(), { owned: { ...owned, onOpen } });
    expect(row('owned-elsewhere').textContent).toContain('Acme');
    fireEvent.click(within(row('owned-elsewhere')).getByRole('button'));
    expect(onOpen).toHaveBeenCalled();
    cleanup();
    renderInspector(element(), { owned });
    expect(within(row('owned-elsewhere')).queryByRole('button')).toBeNull();
  });

  it('shows the owner\'s description and detail, read only', () => {
    renderInspector(element({ description: 'Own.', vendor: 'V' }), { owned });
    expect(says('element-description')).toContain('From the owner.');
    expect(within(row('record-vendor')).queryByRole('button')).toBeNull();
    expect(within(row('element-lifecycle')).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: /Change the name/ })).toBeNull();
  });

  it('says nothing about a record this scope defines', () => {
    renderInspector(element());
    expect(screen.queryByTestId('owned-elsewhere')).toBeNull();
  });
});

describe('The record: the same rows, every field shown', () => {
  it('lays out its sections in order, aspects only for a kind that has them', () => {
    const t = (key: string) => (en as Record<string, string>)[key] ?? key;
    expect(recordSectionsOf(element(), t).map((one) => one.id)).toEqual([...RECORD_SECTIONS]);
    expect(recordSectionsOf(element({ kind: 'actor' }), t).map((one) => one.id)).not.toContain('aspects');
  });

  it('shows the empty ones as a quiet dash, and each may still be pressed', () => {
    const { updateElement } = renderRecord(element());
    expect(says('record-vendor')).toContain('—');
    expect(says('record-owner')).toContain('—');
    typeIn('record-vendor', 'Vendor', 'Acme');
    expect(updateElement).toHaveBeenCalledWith('e1', { vendor: 'Acme' });
  });

  it('writes outside as true or absent, never false, and drops the party with it', () => {
    const { updateElement } = renderRecord(element({ outside: true, partyId: 'x' }));
    choose('record-outside', en['field.outside'], 'no');
    expect(updateElement).toHaveBeenCalledWith('e1', { outside: undefined, partyId: undefined });
  });

  it('asks whether it is ours of an application and an actor, and of nothing else', () => {
    renderRecord(element({ kind: 'platform' }));
    expect(screen.queryByTestId('record-outside')).toBeNull();
    cleanup();
    renderRecord(element({ kind: 'actor' }));
    expect(row('record-outside')).toBeDefined();
  });

  it('lists every line, one line each, and goes to the other end', () => {
    const onNavigate = vi.fn();
    const other = element({ id: 'e2', name: 'Hub' });
    const dia = diagram();
    const updateElement = vi.fn();
    render(
      <ThemeProvider theme={testTheme}>
        <RecordSectionBody section="connected" props={{
          element: element(), diagram: dia, readOnly: false, actions: { updateElement } as never, onRequestDelete: vi.fn(), onNavigate,
          model: { ...model(element(), dia), elements: [element(), other], relations: [{ id: 'c1', type: 'flow', sourceId: 'e1', targetId: 'e2', isBidirectional: false, label: 'asks' }] },
        }} />
      </ThemeProvider>,
    );
    fireEvent.click(within(row('record-lines')).getByRole('button', { name: /Hub, asks/ }));
    expect(onNavigate).toHaveBeenCalledWith('e2');
  });

  it('says which views draw it', () => {
    const dia = diagram({ name: 'Landscape', placements: [{ id: 'e1', x: 0, y: 0 }] } as never);
    render(
      <ThemeProvider theme={testTheme}>
        <RecordSectionBody section="connected" props={{ element: element(), diagram: dia, readOnly: true, actions: {} as never, onRequestDelete: vi.fn(), model: model(element(), dia) }} />
      </ThemeProvider>,
    );
    expect(says('record-views')).toContain('Landscape');
  });
});

describe('ElementInspector: where it runs (ADR-0013)', () => {
  const platform = element({ id: 'p1', kind: 'platform', name: 'OpenShift' });

  it('offers hosting to an application with no containers, and nothing without a platform', () => {
    const { setHostedOn } = renderInspector(element(), { others: [platform] });
    pick('hosted-on', 'OpenShift');
    expect(setHostedOn).toHaveBeenCalledWith('e1', 'p1');
    cleanup();
    renderInspector(element());
    expect(screen.queryByTestId('hosted-on')).toBeNull();
  });

  it('hands the stand-in over with the row for a platform defined elsewhere (ADR-0017)', () => {
    const standIn = element({ id: 'far', kind: 'platform', name: 'Far' });
    const { setHostedOn } = renderInspector(element(), {
      technology: { elsewhere: [{ id: 'far', name: 'Far', kind: 'platform', place: true, where: 'Acme' }], standInFor: () => standIn },
    });
    pick('hosted-on', /Far/);
    expect(setHostedOn).toHaveBeenCalledWith('e1', 'far', standIn);
  });

  it('is read-only where the panel is', () => {
    renderInspector(element(), { others: [platform], readOnly: true });
    expect(within(row('hosted-on')).queryByRole('button')).toBeNull();
  });
});

describe('ElementInspector: what an application uses (ADR-0020)', () => {
  const service = element({ id: 's1', kind: 'platformService', name: 'Database' });
  const another = element({ id: 's2', kind: 'platformService', name: 'Queue' });

  it('reads as names, and ticks several, written as one setUses when the row closes', () => {
    const { setUses } = renderInspector(element(), { others: [service, another] });
    press('element-uses');
    fireEvent.click(screen.getByRole('option', { name: 'Database' }));
    fireEvent.click(screen.getByRole('option', { name: 'Queue' }));
    expect(setUses).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(setUses).toHaveBeenCalledTimes(1);
    expect(setUses).toHaveBeenCalledWith('e1', ['s1', 's2']);
  });

  it('removes one with its ×, and writes the ticks when the panel goes away with the list open', () => {
    const rows = [{ id: 'u1', type: 'uses', sourceId: 'e1', targetId: 's1' }] as never;
    const { setUses, unmount } = renderInspector(element(), { others: [service, another], relations: rows });
    expect(says('element-uses')).toContain('Database');
    press('element-uses');
    fireEvent.click(screen.getByRole('button', { name: /Take out Database/ }));
    unmount();
    expect(setUses).toHaveBeenCalledWith('e1', []);
  });

  it('offers no picker read-only', () => {
    const rows = [{ id: 'u1', type: 'uses', sourceId: 'e1', targetId: 's1' }] as never;
    renderInspector(element(), { others: [service], relations: rows, readOnly: true });
    expect(within(row('element-uses')).queryByRole('button')).toBeNull();
  });

  it('offers the door to the landscape under Leverages, and none where the host has no landscape', () => {
    const onShowOnTechnology = vi.fn();
    renderInspector(element(), { onShowOnTechnology, leverage: { services: [], platforms: [] } as never });
    fireEvent.click(screen.getByTestId('show-on-landscape'));
    expect(onShowOnTechnology).toHaveBeenCalledWith('e1');
    cleanup();
    renderInspector(element());
    expect(screen.queryByTestId('show-on-landscape')).toBeNull();
  });
});

describe('ElementInspector: a platform and a service, authored', () => {
  it('says what a platform is, and writes it', () => {
    const { updateElement } = renderInspector(element({ kind: 'platform' }));
    choose('element-archetype', en['field.platformArchetype'], 'place');
    expect(updateElement).toHaveBeenCalledWith('e1', { platformArchetype: 'place' });
  });

  it('offers what it may sit in and refuses the loop, in words on the option', () => {
    const child = element({ id: 'p2', kind: 'platform', name: 'Child', parentId: 'e1' });
    const { updateElement } = renderInspector(element({ kind: 'platform' }), { others: [child, element({ id: 'p3', kind: 'platform', name: 'Other' })] });
    press('element-part-of');
    expect(screen.getByRole('option', { name: /Child/ }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: 'Other' }));
    expect(updateElement).toHaveBeenCalledWith('e1', { parentId: 'p3' });
  });

  it('writes what a platform delivers, one step a change', () => {
    const { setRealises } = renderInspector(element({ kind: 'platform' }), { others: [element({ id: 's1', kind: 'platformService', name: 'Database' })] });
    press('element-realises');
    fireEvent.click(screen.getByRole('option', { name: 'Database' }));
    expect(setRealises).toHaveBeenCalledWith('e1', ['s1']);
  });

  it('names who maintains it, and moves the row', () => {
    const { setMaintainedBy } = renderInspector(element({ kind: 'platformService' }), { others: [element({ id: 'a1', kind: 'actor', name: 'Ops' })] });
    pick('element-maintained-by', 'Ops');
    expect(setMaintainedBy).toHaveBeenCalledWith('e1', 'a1');
  });

  it('writes shared as true or clears it, and says beside it who uses it from another team', () => {
    const { updateElement } = renderInspector(element({ kind: 'platformService' }), { offeredBeyond: ['Billing'] });
    expect(row('service-shared-derived').textContent).toContain('Billing');
    choose('service-shared', en['field.shared'], 'yes');
    expect(updateElement).toHaveBeenCalledWith('e1', { shared: true });
  });
});

describe('ElementInspector: inside it', () => {
  it('offers a container view for an application that has none, and none read-only', () => {
    const onCreateContainer = vi.fn();
    renderInspector(element(), { onCreateContainer });
    fireEvent.click(within(row('element-container')).getByRole('button', { name: en['inspector.create'] }));
    expect(onCreateContainer).toHaveBeenCalledWith('e1');
    cleanup();
    renderInspector(element(), { onCreateContainer, readOnly: true });
    expect(within(row('element-container')).queryByRole('button')).toBeNull();
  });

  it('offers a drawing on any element', () => {
    const onCreateDrawing = vi.fn();
    renderInspector(element({ kind: 'actor' }), { onCreateDrawing });
    fireEvent.click(within(row('element-drawings')).getByRole('button', { name: en['inspector.create'] }));
    expect(onCreateDrawing).toHaveBeenCalledWith('e1');
  });
});

describe('ElementInspector: as axe reads it', () => {
  it('finds nothing, writing or read-only', async () => {
    renderInspector(element({ vendor: 'x', category: 'y' }), { onOpenDocumentation: vi.fn() });
    expect(await axeFindings()).toEqual([]);
    cleanup();
    renderInspector(element({ vendor: 'x', category: 'y' }), { readOnly: true });
    expect(await axeFindings()).toEqual([]);
  });
});
