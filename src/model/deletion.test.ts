import { describe, expect, it } from 'vitest';
import { connection, element, model } from './testFixtures';
import {
  deletableSelection,
  describeDeletion,
  deletionSummary,
  needsDeleteConfirmation,
  type DeletionSummary,
} from './deletion';

const board = model({
  elements: [element('e1'), element('e2'), element('e3')],
  relations: [connection('c1', 'e1', 'e2'), connection('c2', 'e2', 'e3')],
});

const summary = (overrides: Partial<DeletionSummary> = {}): DeletionSummary => ({
  elements: 0,
  connections: 0,
  domainGroups: 0,
  cascadingConnections: 0,
  standIns: 0,
  ...overrides,
});

/**
 * The one element a delete may never take off a container diagram: the
 * application the diagram is about. Every other guard against this is on a
 * path that carries ONE element; a selection walks straight past them.
 */
describe('deletableSelection', () => {
  const view = { kind: 'container' as const, applicationElementId: 'e1' };
  const whole = { elementIds: ['e1', 'e2'], connectionIds: ['c1'], domainGroups: ['Sales'] };

  it('drops the boundary application and keeps the rest of the gesture', () => {
    expect(deletableSelection(whole, view)).toEqual({
      elementIds: ['e2'], connectionIds: ['c1'], domainGroups: ['Sales'],
    });
  });

  it('is the same selection everywhere else, and says so by identity', () => {
    expect(deletableSelection(whole, { kind: 'layer7' })).toBe(whole);
    expect(deletableSelection(whole, undefined)).toBe(whole);
    expect(deletableSelection(whole, { kind: 'container' })).toBe(whole);
    const elsewhere = { ...whole, elementIds: ['e2'] };
    expect(deletableSelection(elsewhere, view)).toBe(elsewhere);
  });

  it('may be asked twice: the path that counts and the path that writes both do', () => {
    const once = deletableSelection(whole, view);
    expect(deletableSelection(once, view)).toBe(once);
  });
});

describe('deletionSummary', () => {
  it('counts the selection and the connections that die with an endpoint, once each', () => {
    expect(
      deletionSummary(board, { elementIds: ['e1'], connectionIds: ['c2'], domainGroups: ['Sales'] }),
    ).toMatchObject({ elements: 1, connections: 1, domainGroups: 1 });
    // e2 sits between both connections, so both go with it.
    expect(
      deletionSummary(board, { elementIds: ['e2'], connectionIds: [], domainGroups: [] })
        .cascadingConnections,
    ).toBe(2);
    expect(
      deletionSummary(board, { elementIds: ['e1', 'e1'], connectionIds: [], domainGroups: [] })
        .elements,
    ).toBe(1);
    expect(deletionSummary(board, { elementIds: [], connectionIds: [], domainGroups: [] })).toEqual(
      summary(),
    );
  });

  it('does not count an explicitly selected connection twice', () => {
    const result = deletionSummary(board, {
      elementIds: ['e1'],
      connectionIds: ['c1'],
      domainGroups: [],
    });
    expect(result.connections).toBe(1);
    expect(result.cascadingConnections).toBe(0);
  });

});

describe('needsDeleteConfirmation', () => {
  it('asks before deleting a connection, and for nothing else', () => {
    expect(needsDeleteConfirmation(summary({ connections: 1 }))).toBe(true);
    expect(needsDeleteConfirmation(summary({ elements: 1 }))).toBe(false);
    expect(needsDeleteConfirmation(summary({ domainGroups: 3 }))).toBe(false);
    expect(needsDeleteConfirmation(summary())).toBe(false);
  });

  it('asks before a multi-selection', () => {
    expect(needsDeleteConfirmation(summary({ elements: 2 }))).toBe(true);
    expect(needsDeleteConfirmation(summary({ elements: 1, domainGroups: 1 }))).toBe(true);
  });

});

describe('describeDeletion', () => {
  it('names one kind', () => {
    expect(describeDeletion(summary({ elements: 1 }))).toBe('1 element');
    expect(describeDeletion(summary({ connections: 2 }))).toBe('2 connections');
  });

  it('joins the kinds into a sentence, and says "nothing" for an empty summary', () => {
    expect(describeDeletion(summary({ elements: 3, connections: 1 }))).toBe(
      '3 elements and 1 connection',
    );
    expect(describeDeletion(summary({ elements: 2, connections: 1, domainGroups: 1 }))).toBe(
      '2 elements, 1 connection and 1 group',
    );
    expect(describeDeletion(summary())).toBe('nothing');
  });

  /**
   * The part of a delete people assume wrong in the other direction
   * (ADR-0012 §3): deleting a stand-in takes this scope's record of the thing,
   * and the thing stays where it is defined. Nobody ever needed reassuring
   * that deleting a definition deletes it, so only this number is drawn.
   */
  it('says how many of them are stand-ins, and what that means', () => {
    expect(describeDeletion(summary({ elements: 3, standIns: 2 }))).toBe(
      '3 elements — 2 of them stand-ins, which stay where they are defined',
    );
    expect(describeDeletion(summary({ elements: 3 }))).toBe('3 elements');
  });
});

describe('deletionSummary — stand-ins', () => {
  it('counts the selected records that only draw what somebody else defines', () => {
    const tree = model({
      elements: [element('e1'), element('erp', { ref: 'acme/retail' })],
      relations: [],
    });
    expect(
      deletionSummary(tree, { elementIds: ['e1', 'erp'], connectionIds: [], domainGroups: [] }),
    ).toMatchObject({ elements: 2, standIns: 1 });
  });
});
