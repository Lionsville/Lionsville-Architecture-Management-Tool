import { describe, expect, it } from 'vitest';
import { connection, element, model } from './testFixtures';
import {
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

describe('deletionSummary', () => {
  it('counts the selection', () => {
    expect(
      deletionSummary(board, { elementIds: ['e1'], connectionIds: ['c2'], domainGroups: ['Sales'] }),
    ).toMatchObject({ elements: 1, connections: 1, domainGroups: 1 });
  });

  it('counts the connections that die with an endpoint', () => {
    // e2 sits between both connections, so both go with it.
    expect(
      deletionSummary(board, { elementIds: ['e2'], connectionIds: [], domainGroups: [] })
        .cascadingConnections,
    ).toBe(2);
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

  it('ignores duplicate ids in the selection', () => {
    expect(
      deletionSummary(board, { elementIds: ['e1', 'e1'], connectionIds: [], domainGroups: [] })
        .elements,
    ).toBe(1);
  });

  it('is empty for an empty selection', () => {
    expect(deletionSummary(board, { elementIds: [], connectionIds: [], domainGroups: [] })).toEqual(
      summary(),
    );
  });
});

describe('needsDeleteConfirmation', () => {
  it('asks before deleting a connection', () => {
    expect(needsDeleteConfirmation(summary({ connections: 1 }))).toBe(true);
  });

  it('asks before a multi-selection', () => {
    expect(needsDeleteConfirmation(summary({ elements: 2 }))).toBe(true);
    expect(needsDeleteConfirmation(summary({ elements: 1, domainGroups: 1 }))).toBe(true);
  });

  it('does not ask for a lone element — its own dialog asks a better question', () => {
    expect(needsDeleteConfirmation(summary({ elements: 1 }))).toBe(false);
  });

  it('does not ask for group boxes alone — the members survive', () => {
    expect(needsDeleteConfirmation(summary({ domainGroups: 3 }))).toBe(false);
  });

  it('does not ask for nothing', () => {
    expect(needsDeleteConfirmation(summary())).toBe(false);
  });
});

describe('describeDeletion', () => {
  it('names one kind', () => {
    expect(describeDeletion(summary({ elements: 1 }))).toBe('1 element');
    expect(describeDeletion(summary({ connections: 2 }))).toBe('2 connections');
  });

  it('joins two kinds with "and"', () => {
    expect(describeDeletion(summary({ elements: 3, connections: 1 }))).toBe(
      '3 elements and 1 connection',
    );
  });

  it('joins three kinds with commas and a final "and"', () => {
    expect(describeDeletion(summary({ elements: 2, connections: 1, domainGroups: 1 }))).toBe(
      '2 elements, 1 connection and 1 group',
    );
  });

  it('says "nothing" for an empty summary', () => {
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
