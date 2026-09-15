// @vitest-environment jsdom
/**
 * The two rows a platform team writes from the inspector (ADR-0014 §2.8):
 * what a platform realises, and who maintains a service or a platform. Each
 * as one step, moving a row rather than replacing it, so a window on it
 * rides along and one undo puts it back.
 */
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { laidOut } from '../model/testFixtures';
import { renderEditorState } from './testing/editorHost';
import type { DesignModel, Relation } from '../model/types';

const el = (id: string, kind: DesignModel['elements'][number]['kind']) =>
  ({ id, kind, name: id, lifecycle: 'live' as const, isManaged: true, aspects: {} });

function model(relations: Relation[] = []): DesignModel {
  return {
    name: 'Platforms',
    elements: [
      el('openshift', 'platform'), el('containers', 'platformService'), el('registry', 'platformService'),
      el('platform-team', 'actor'), el('ops', 'actor'),
    ],
    relations,
    diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [{ id: 'openshift', x: 0, y: 0 }] })],
  };
}
const rows = (held: DesignModel) => held.relations.map((r) => `${r.type}:${r.sourceId}>${r.targetId}${r.validFrom ? '@' + r.validFrom : ''}`);

describe('setRealises', () => {
  it('writes the services named, takes off the ones no longer named, leaves a kept row as it was, as one step', () => {
    const { result, host } = renderEditorState(model([
      { id: 'r1', type: 'realises', sourceId: 'openshift', targetId: 'containers', validFrom: '2027-01-01' },
    ]), { activeDiagramId: 'l7' });
    act(() => result.current.actions.setRealises('openshift', ['containers', 'registry']));
    expect(rows(host.current.model)).toEqual(['realises:openshift>containers@2027-01-01', 'realises:openshift>registry']);
    act(() => result.current.actions.setRealises('openshift', ['registry']));
    expect(rows(host.current.model)).toEqual(['realises:openshift>registry']);
    act(() => host.current.history.undo());
    expect(rows(host.current.model)).toEqual(['realises:openshift>containers@2027-01-01', 'realises:openshift>registry']);
    // Saying the same thing is not a step.
    const before = host.current.commands.length;
    act(() => result.current.actions.setRealises('openshift', ['containers', 'registry']));
    expect(host.current.commands.length).toBe(before);
  });
});

describe('setMaintainedBy', () => {
  it('writes one assigned row, moves it to another actor, and takes it off', () => {
    const { result, host } = renderEditorState(model(), { activeDiagramId: 'l7' });
    act(() => result.current.actions.setMaintainedBy('containers', 'platform-team'));
    expect(rows(host.current.model)).toEqual(['assigned:platform-team>containers']);
    act(() => result.current.actions.setMaintainedBy('containers', 'ops'));
    expect(rows(host.current.model)).toEqual(['assigned:ops>containers']);
    act(() => result.current.actions.setMaintainedBy('containers', undefined));
    expect(rows(host.current.model)).toEqual([]);
  });
});
