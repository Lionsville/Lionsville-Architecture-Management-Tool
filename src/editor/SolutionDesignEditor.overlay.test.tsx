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

const open = () => fireEvent.click(screen.getByLabelText('Colour by'));
/** A choice by its group's words: the *Platform* overlay and the *Platform* aspect column share a name and not a group. */
const choose = (label: string, group = 'What it stands on') =>
  fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('menuitem', { name: label }));
/**
 * What a card is wearing, as the class Emotion hashed its style into: two
 * cards in the same band share it and two in different bands do not, which is
 * the whole of what the overlay promises. Read this way rather than off
 * `getComputedStyle`, whose CSS parser drops a gradient value.
 */
const wash = (id: string) =>
  document.querySelector(`.react-flow__node[data-id="${id}"]`)
    ?.firstElementChild?.firstElementChild?.className ?? '';

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
    expect(legend.getAttribute('aria-label')).toBe('Legend: coloured by Platform');
    expect(within(screen.getByTestId('overlay-legend-openshift')).getByText('OpenShift')).toBeTruthy();
    expect(screen.getByTestId('overlay-legend-openshift').textContent).toBe('1OpenShift2');
    expect(screen.getByTestId('overlay-legend-none').textContent).toContain('On nothing yet');
    expect(screen.getByLabelText('Colour by').textContent).toBe('Platform');
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
    expect(screen.getByTestId('overlay-legend-value:Warehouse').textContent).toBe('1Warehouse2');
    expect(screen.getByTestId('overlay-legend-unset').textContent).toContain('Not set');
    open();
    fireEvent.click(screen.getByTestId('colour-by-aspect-dr'));
    await measured();
    expect(screen.getByLabelText('Colour by').textContent).toBe('Disaster recovery');
    expect(screen.getByTestId('overlay-legend-atRisk').textContent).toBe('1At risk1');
    expect(screen.getByTestId('overlay-legend-unset').textContent).toBe('2Not set3');
  });

  it('keeps the answer on the view', async () => {
    const { host } = renderEditor();
    await measured();
    open();
    choose('Technology lifecycle');
    await measured();
    expect(host.current.model.diagrams[0].colourBy).toBe('technologyLifecycle');
  });

  it('colours the cards that stand on one platform or offering and fades the rest (ADR-0020)', async () => {
    const { host } = renderEditor();
    await measured();
    open();
    fireEvent.click(screen.getByTestId('colour-by-one-openshift'));
    await measured();
    expect(host.current.model.diagrams[0].colourBy).toBe('one:openshift');
    // Both on the cluster wear its wash; the one on nothing is faded, not washed.
    expect(wash('wms')).toBe(wash('portal'));
    expect(wash('crm')).not.toBe(wash('wms'));
    expect(within(screen.getByTestId('overlay-legend-openshift')).getByText('OpenShift')).toBeTruthy();
    expect(screen.getByTestId('overlay-legend-none').textContent).toContain('Not standing on it');
    expect(screen.getByLabelText('Colour by').textContent).toBe('OpenShift');
  });

  it('is not offered on a view that is not a landscape', async () => {
    const held = model();
    held.diagrams.push(laidOut({ id: 'cd', kind: 'container', name: 'WMS', applicationElementId: 'wms', placements: [{ id: 'wms', x: 0, y: 0 }] }));
    renderEditor({ model: held, activeDiagramId: 'cd' });
    await measured();
    expect(screen.queryByLabelText('Colour by')).toBeNull();
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
