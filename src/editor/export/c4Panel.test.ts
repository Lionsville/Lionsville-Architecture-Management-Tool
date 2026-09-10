import { describe, expect, it } from 'vitest';
import { laidOut } from '../../model/testFixtures';
import { translator } from '../../i18n';
import type { DesignDiagram, DesignModel } from '../../model/types';
import { c4PanelFor } from './c4Panel';

const t = translator('en');
const today = new Date(2026, 8, 8);

const wms = {
  id: 'wms', kind: 'application', name: 'Warehouse Management', lifecycle: 'active',
  isManaged: true, aspects: {},
  description: 'Runs every warehouse.\n\nAnd a second paragraph nobody needs in a corner.',
} as unknown as DesignModel['elements'][number];

const model = {
  name: 'Application landscape', customerName: 'Acme', elements: [wms], connections: [], diagrams: [],
} as unknown as DesignModel;

const container = (over: Partial<DesignDiagram> = {}): DesignDiagram => (laidOut({
  id: 'c1', kind: 'container', name: 'WMS containers', applicationElementId: 'wms', placements: [], ...over,
}));

describe('c4PanelFor', () => {
  it('says nothing on a landscape, which has a title block of its own', () => {
    expect(c4PanelFor(model, { ...container(), kind: 'layer7' }, t, 'en', today)).toBeUndefined();
  });

  it('names the level, the application and where it belongs', () => {
    const panel = c4PanelFor(model, container(), t, 'en', today)!;
    expect(panel.title).toBe('[Container] Warehouse Management');
    expect(panel.scope).toBe('Application landscape · Warehouse Management [Application]');
  });

  it('takes the first paragraph of the application as the sentence', () => {
    expect(c4PanelFor(model, container(), t, 'en', today)!.description).toBe('Runs every warehouse.');
  });

  it('falls back to the C4 sentence when the application says nothing', () => {
    const quiet = { ...model, elements: [{ ...wms, description: undefined }] };
    expect(c4PanelFor(quiet, container(), t, 'en', today)!.description)
      .toBe('The container diagram for Warehouse Management.');
  });

  it('writes the document date in the UI language, and today when there is none', () => {
    // The comma after the weekday differs between ICU versions; the words do not.
    expect(c4PanelFor(model, container({ documentDate: '2023-11-11' }), t, 'en', today)!.date)
      .toMatch(/^Saturday,? 11 November 2023$/);
    expect(c4PanelFor(model, container({ documentDate: '2023-11-11' }), translator('nl'), 'nl', today)!.date)
      .toBe('zaterdag 11 november 2023');
    expect(c4PanelFor(model, container(), t, 'en', today)!.date).toMatch(/^Tuesday,? 8 September 2026$/);
  });

  it('survives an application that is no longer in the model', () => {
    const orphan = c4PanelFor({ ...model, elements: [] }, container(), t, 'en', today)!;
    expect(orphan.title).toBe('[Container] WMS containers');
  });
});
