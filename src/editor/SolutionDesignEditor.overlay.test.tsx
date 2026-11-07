// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import type { DesignElement, DesignModel, Relation } from '../model/types';

/**
 * The landscape coloured by what its applications stand on (ADR-0013, redone).
 *
 * `model/overlay.test.ts` pins which card falls in which band; what is pinned
 * here is that choosing an overlay tints the cards and names the bands, that
 * it is kept on the view, and that a reader may change it — what a view SHOWS
 * is theirs even where the writing is not.
 */

beforeAll(() => installReactFlowMocks());
const measured = () => act(async () => {});
afterEach(() => cleanup());

const el = (id: string, kind: DesignElement['kind'], over: Partial<DesignElement> = {}): DesignElement =>
  ({ id, kind, name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over });

function model(): DesignModel {
  return {
    name: 'Acme',
    elements: [
      el('wms', 'application', { name: 'WMS' }),
      el('portal', 'application', { name: 'Portal' }),
      el('partner', 'application', { name: 'Partner', outside: true }),
      el('crm', 'application', { name: 'CRM' }),
      el('openshift', 'platform', { name: 'OpenShift' }),
    ],
    relations: [
      { id: 'h1', type: 'hostedOn', sourceId: 'wms', targetId: 'openshift' },
      { id: 'h2', type: 'hostedOn', sourceId: 'portal', targetId: 'openshift' },
    ] as Relation[],
    diagrams: [
      laidOut({
        id: 'l7', kind: 'layer7', name: 'Landscape',
        placements: [
          { id: 'wms', zone: 'landscape', x: 0, y: 0 },
          { id: 'portal', zone: 'landscape', x: 260, y: 0 },
          { id: 'partner', zone: 'externalSystems', x: 520, y: 0 },
          { id: 'crm', zone: 'landscape', x: 780, y: 0 },
          { id: 'openshift', zone: 'management', x: 0, y: 300 },
        ],
      }),
    ],
  };
}

function renderEditor(overrides: Partial<HostedEditorProps> = {}) {
  const host = { current: undefined as unknown as EditorHostState };
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor
          model={model()}
          activeDiagramId="l7"
          onActiveDiagramChange={vi.fn()}
          onCreateContainerDiagram={vi.fn()}
          onCreateLayer7Diagram={vi.fn()}
          {...overrides}
          hostRef={host}
        />
      </div>
    </ThemeProvider>,
  );
  return { ...view, host };
}

const colourWord = () => document.querySelector('[data-guide="board.colour"]') as HTMLElement;
const open = () => fireEvent.click(colourWord());
/** A choice in the one menu. A heading goes before its rows, so the group is the rows after it. */
const choose = (label: string, group = 'What it stands on') => {
  const rows = screen.getAllByRole('menuitemcheckbox');
  const all = [...screen.getByRole('menu').children];
  const words = (one: Element) => one.textContent?.trim();
  const from = all.findIndex((row) => words(row) === group);
  const row = all.slice(from + 1).find((one) => words(one) === label) ?? rows.find((one) => words(one) === label);
  fireEvent.click(row as HTMLElement);
};
const band = (key: string) => screen.getByTestId('overlay-legend').querySelector(`[data-key="${key}"]`) as HTMLElement;
const chooseOne = (name: string) => {
  fireEvent.click(screen.getByRole('menuitem', { name: 'One platform or offering' }));
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name }));
};
/** What a card is wearing: two cards in the same band share it and two in different bands do not. */
const wash = (id: string) => {
  const card = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"] .kit-card`);
  return card ? `${card.style.getPropertyValue('--lv-lens-wash')}|${card.dataset.dimmed ?? ''}` : '';
};

describe('colour by', () => {
  it('starts off: every application card wears the same ground', async () => {
    renderEditor();
    await measured();
    expect(wash('wms')).toBe(wash('portal'));
  });

  it('tints the cards by platform and names the bands in the legend', async () => {
    renderEditor();
    await measured();
    const before = { wms: wash('wms'), partner: wash('partner') };
    open();
    choose('Platform');
    await measured();
    expect(wash('wms')).not.toBe(before.wms);
    // Two cards on the same platform wear the same wash…
    expect(wash('wms')).toBe(wash('portal'));
    // …one that runs on nothing wears the neutral band…
    expect(wash('crm')).not.toBe(wash('wms'));
    // …and a partner system is left exactly as it was: somebody else's
    // deployment is not what this picture is about.
    expect(wash('partner')).toBe(before.partner);
    // The legend stands on the canvas while the overlay is up, with each band's number and count; the button says what the board is coloured by.
    const legend = screen.getByTestId('overlay-legend');
    expect(legend.getAttribute('aria-label')).toBe('Coloured by Platform');
    expect(within(band('openshift')).getByText('OpenShift')).toBeTruthy();
    expect(band('openshift').textContent?.replace(/\s/g, '')).toBe('1OpenShift2');
    expect(band('none').textContent).toContain('On nothing yet');
    expect(colourWord().textContent).toContain('Platform');
    // Every card in a band wears the band's number, so a band is found by reading and not by matching a hue.
    expect(within(document.querySelector('.react-flow__node[data-id="wms"]') as HTMLElement).getByTestId('overlay-tag').textContent).toBe('1');
    expect(within(document.querySelector('.react-flow__node[data-id="crm"]') as HTMLElement).getByTestId('overlay-tag').textContent).toBe('2');
    // Closing the legend takes the overlay off.
    fireEvent.click(within(legend).getByLabelText('Take the colouring off'));
    await measured();
    expect(screen.queryByTestId('overlay-legend')).toBeNull();
    expect(wash('wms')).toBe(before.wms);
  });

  it('colours by what the record says — a category, an aspect column — and names the band for it', async () => {
    const held = model();
    held.elements[0].category = 'Warehouse';
    held.elements[1].category = 'Warehouse';
    held.elements[3].aspects = { dr: { status: 'atRisk' } };
    renderEditor({ model: held });
    await measured();
    open();
    choose('Category', 'What its record says');
    await measured();
    expect(wash('wms')).toBe(wash('portal'));
    expect(wash('crm')).not.toBe(wash('wms'));
    expect(band('value:Warehouse').textContent?.replace(/\s/g, '')).toBe('1Warehouse2');
    expect(band('unset').textContent).toContain('Not set');
    open();
    choose('Disaster recovery', 'An operational aspect');
    await measured();
    expect(colourWord().textContent).toContain('Disaster recovery');
    expect(band('atRisk').textContent?.replace(/\s/g, '')).toBe('1Atrisk1');
    expect(band('unset').textContent?.replace(/\s/g, '')).toBe('2Notset3');
  });

  it('leaves the view as it was until the lens is kept with it (ADR-0027, amended)', async () => {
    const { host } = renderEditor();
    await measured();
    open();
    choose('Technology lifecycle');
    await measured();
    expect(host.current.model.diagrams[0].colourBy).toBeUndefined();
    fireEvent.click(screen.getByTestId('keep-lens'));
    await measured();
    expect(host.current.model.diagrams[0].colourBy).toBe('technologyLifecycle');
    expect(colourWord().textContent).toContain('Technology lifecycle');
    // Kept: nothing is this reader's any more, so there is nothing to keep.
    expect(screen.queryByTestId('keep-lens')).toBeNull();
  });

  it('colours the cards that stand on one platform or offering and fades the rest (ADR-0020)', async () => {
    const { host } = renderEditor();
    await measured();
    open();
    chooseOne('OpenShift');
    await measured();
    expect(host.current.model.diagrams[0].colourBy).toBeUndefined();
    // Both on the cluster wear its wash; the one on nothing is faded, not washed.
    expect(wash('wms')).toBe(wash('portal'));
    expect(wash('crm')).not.toBe(wash('wms'));
    expect(within(band('openshift')).getByText('OpenShift')).toBeTruthy();
    expect(band('none').textContent).toContain('Not standing on it');
    expect(colourWord().textContent).toContain('OpenShift');
  });

  it('is not offered on a view that is not a landscape', async () => {
    const held = model();
    held.diagrams.push(laidOut({ id: 'cd', kind: 'container', name: 'WMS', applicationElementId: 'wms', placements: [{ id: 'wms', x: 0, y: 0 }] }));
    renderEditor({ model: held, activeDiagramId: 'cd' });
    await measured();
    expect(colourWord()).toBeNull();
  });

  it('still works for a reader, who may change what a view shows without writing it', async () => {
    const { host } = renderEditor({ readOnly: true });
    await measured();
    const before = wash('wms');
    open();
    choose('Platform');
    await measured();
    expect(wash('wms')).not.toBe(before);
    // Nothing written: the stored answer is still what everybody else opens on.
    expect(host.current.model.diagrams[0].colourBy).toBeUndefined();
  });
});
