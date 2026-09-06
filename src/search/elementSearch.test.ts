import { describe, expect, it } from 'vitest';
import { searchElements } from './elementSearch';
import { diagram, element, model, placement } from '../model/testFixtures';

const board = model({
  diagrams: [
    diagram('d1', {
      name: 'Landscape',
      placements: [placement('a'), placement('b'), placement('c')],
    }),
    diagram('d2', { name: 'Other landscape', placements: [placement('d')] }),
  ],
  elements: [
    element('a', { name: 'Reisinformatie', category: 'Travel' }),
    element('b', { name: 'Betaal-API', vendor: 'Adyen' }),
    element('c', { name: 'Kaartverkoop', technology: 'Kafka' }),
    element('d', { name: 'Reisplanner', category: 'Travel' }),
    element('e', { name: 'Orphan service' }),
  ],
});

const ids = (query: string, active = 'd1') =>
  searchElements(board, query, active).map((hit) => hit.id);

describe('searchElements', () => {
  it('returns nothing for a blank query', () => {
    expect(searchElements(board, '', 'd1')).toEqual([]);
    expect(searchElements(board, '   ', 'd1')).toEqual([]);
  });

  it('matches on the name', () => {
    expect(ids('reisinformatie')).toEqual(['a']);
  });

  it('matches on category, vendor and technology', () => {
    expect(ids('adyen')).toEqual(['b']);
    expect(ids('kafka')).toEqual(['c']);
    expect(ids('travel')).toEqual(['a', 'd']);
  });

  it('folds case and accents', () => {
    expect(ids('RÉISINFORMATIE')).toEqual(['a']);
  });

  it('narrows on a second token rather than widening', () => {
    expect(ids('reis planner')).toEqual(['d']);
  });

  it('puts elements on the active diagram first', () => {
    // Both are "Travel"; 'a' is on d1 and 'd' is on d2.
    expect(ids('travel', 'd1')).toEqual(['a', 'd']);
    expect(ids('travel', 'd2')).toEqual(['d', 'a']);
  });

  it('prefers a name that starts with the query', () => {
    expect(ids('reis')).toEqual(['a', 'd']);
  });

  it('reports the diagram a hit will be focused on', () => {
    const [hit] = searchElements(board, 'reisplanner', 'd1');
    expect(hit.diagramId).toBe('d2');
    expect(hit.diagramName).toBe('Other landscape');
    expect(hit.onActiveDiagram).toBe(false);
  });

  it('marks a hit on the active diagram', () => {
    const [hit] = searchElements(board, 'reisinformatie', 'd1');
    expect(hit.onActiveDiagram).toBe(true);
    expect(hit.diagramId).toBe('d1');
  });

  it('still finds an element placed on no diagram, and ranks it last', () => {
    const hits = searchElements(board, 'e', 'd1');
    expect(hits.map((h) => h.id)).toContain('e');
    expect(hits[hits.length - 1].id).toBe('e');
    expect(hits[hits.length - 1].diagramId).toBeUndefined();
  });

  it('joins the detail line from the fields that are set', () => {
    const [hit] = searchElements(board, 'betaal', 'd1');
    expect(hit.detail).toBe('Adyen');
    const [plain] = searchElements(board, 'orphan', 'd1');
    expect(plain.detail).toBeUndefined();
  });

  it('honours the limit', () => {
    expect(searchElements(board, 'a', 'd1', 2)).toHaveLength(2);
  });

  it('returns nothing when nothing matches', () => {
    expect(ids('zzzzqqq')).toEqual([]);
  });
});
