// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The decisions the editor body's hooks make, each asked on its own: what a
 * board shows where a reader chose otherwise, when a request is new, what a
 * failed layout pass says, the note under the auto-route toggle, and what an
 * exported picture calls itself.
 */
import { describe, expect, it } from 'vitest';
import { createTheme } from '@mui/material/styles';
import { laidOut } from '../model/testFixtures';
import { diagramWithRoutes } from '../model/routes';
import type { DesignDiagram, DesignModel } from '../model/types';
import { translator } from '../i18n/strings';
import { LayoutRefused } from '../layout/elkLayout';
import { shownColourBy, shownDeployment } from './useBoardView';
import { isNewRequest } from './useEditorRequests';
import { layoutFailureMessage } from './useLayoutActions';
import { autoRouteNote } from './useRouteActions';
import { pngFilename, titleBlockFor, type TitleBlockContext } from './exportTitleBlock';

const t = translator('en');

function board(over: Partial<DesignDiagram> = {}): DesignDiagram {
  return { ...laidOut({ id: 'd1', kind: 'container', name: 'Shop', applicationElementId: 'a', placements: [] }), ...over };
}

describe('what a board shows', () => {
  it('draws deployment boxes where nobody said otherwise, the stored answer next, the reader’s flip first', () => {
    expect(shownDeployment(undefined, {})).toBe(true);
    expect(shownDeployment(board(), {})).toBe(true);
    expect(shownDeployment(board({ showDeployment: false }), {})).toBe(false);
    expect(shownDeployment(board({ showDeployment: false }), { d1: true })).toBe(true);
    expect(shownDeployment(board(), { other: false })).toBe(true);
  });

  it('colours by the reader’s choice — none included — before the stored one', () => {
    const stored = board({ colourBy: { kind: 'lifecycle' } as never });
    expect(shownColourBy(undefined, {})).toBeUndefined();
    expect(shownColourBy(stored, {})).toEqual({ kind: 'lifecycle' });
    expect(shownColourBy(stored, { d1: 'none' })).toBeUndefined();
    expect(shownColourBy(board(), { d1: { kind: 'platform' } as never })).toEqual({ kind: 'platform' });
  });
});

describe('a request passed as a nonce', () => {
  it('is new unless the same element and nonce were seen, and a re-ask bumps only the nonce', () => {
    expect(isNewRequest(undefined, undefined)).toBe(false);
    expect(isNewRequest(undefined, { id: 'a', nonce: 1 })).toBe(true);
    expect(isNewRequest({ id: 'a', nonce: 1 }, { id: 'a', nonce: 1 })).toBe(false);
    expect(isNewRequest({ id: 'a', nonce: 1 }, { id: 'a', nonce: 2 })).toBe(true);
    expect(isNewRequest({ id: 'a', nonce: 1 }, { id: 'b', nonce: 1 })).toBe(true);
  });
});

describe('what a failed layout pass says', () => {
  it('says nothing about a cancel', () => {
    expect(layoutFailureMessage(new LayoutRefused('cancelled'), 'error.tidy', t)).toBeUndefined();
  });

  it('names the cap for a board past it, whichever pass was running', () => {
    const tooLarge = new LayoutRefused('tooLarge', { count: 900, limit: 500 });
    expect(layoutFailureMessage(tooLarge, 'error.tidyGroupFailed', t))
      .toBe(t('error.tidyTooLarge', { count: 900, limit: 500 }));
  });

  it('gives any other failure the pass’s own sentence', () => {
    expect(layoutFailureMessage(new Error('wasm'), 'error.tidyUnattended', t)).toBe(t('error.tidyUnattended'));
  });
});

describe('the note under the auto-route toggle', () => {
  const route = (relationId: string, source?: 'auto' | 'manual') => ({ relationId, waypoints: [], ...(source ? { source } : {}) });

  it('says a board was over the cap before anything else', () => {
    expect(autoRouteNote(board(), false, new Set(['d1']), t)).toBe(t('note.overCap'));
  });

  it('asks for reclassifying when live routing is on and every stored route predates provenance', () => {
    const old = diagramWithRoutes(board(), [route('r1'), route('r2', 'manual')]);
    expect(autoRouteNote(old, true, new Set(), t)).toBe(t('note.reclassify'));
    expect(autoRouteNote(old, false, new Set(), t)).toBeUndefined();
  });

  it('says nothing where live routing has something to move, or nothing is stored', () => {
    expect(autoRouteNote(diagramWithRoutes(board(), [route('r1'), route('r2', 'auto')]), true, new Set(), t)).toBeUndefined();
    expect(autoRouteNote(board(), true, new Set(), t)).toBeUndefined();
    expect(autoRouteNote(undefined, true, new Set(), t)).toBeUndefined();
  });
});

describe('what an exported picture says about itself', () => {
  const model: DesignModel = { name: 'Acme', diagrams: [], elements: [], relations: [] };
  const context = (over: Partial<TitleBlockContext> = {}): TitleBlockContext => ({
    diagram: board(), model, lookingAt: undefined, host: undefined,
    theme: createTheme(), showLifecycle: false, t, language: 'en', ...over,
  });
  const options = { theme: 'light' as const, showLabels: true, titleBlock: true, legend: false };

  it('has no strip where the picture goes without one, or there is no board', () => {
    expect(titleBlockFor({ ...options, titleBlock: false }, context())).toBeUndefined();
    expect(titleBlockFor(options, context({ diagram: undefined }))).toBeUndefined();
  });

  it('names the client from the board, then the host, then the model', () => {
    expect(titleBlockFor(options, context())?.client).toBe('Acme');
    expect(titleBlockFor(options, context({ host: { client: 'Host', author: 'Ann' } }))?.client).toBe('Host');
    const own = context({ diagram: board({ client: 'Board', author: 'Bob' }), host: { client: 'Host', author: 'Ann' } });
    expect(titleBlockFor(options, own)).toMatchObject({ client: 'Board', author: 'Bob' });
  });

  it('dates the title of a board looked at on another day', () => {
    expect(titleBlockFor(options, context())?.title).toBe('Acme — Shop');
    expect(titleBlockFor(options, context({ lookingAt: '2028-01-01' }))?.title)
      .toBe(`Acme — Shop · ${t('export.asOf', { date: '2028-01-01' })}`);
  });

  it('slugs the file name, with a word for a half that slugs to nothing', () => {
    expect(pngFilename('Acme Logistics', board({ name: 'Order flow!' }))).toBe('acme-logistics-order-flow.png');
    expect(pngFilename('—', board({ name: '' }))).toBe('design-diagram.png');
  });
});
