// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { summarise } from '../model/activity';
import { fromArrays } from '../model/normalised';
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
      el('wms', 'application'), el('crm', 'application'),
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

describe('setHostedOn with a stand-in (ADR-0017)', () => {
  const azure = { id: 'azure', kind: 'platform' as const, name: 'Azure Cloud', ref: 'platforms', lifecycle: 'live' as const, isManaged: false, aspects: {} };

  it('writes the stand-in and the row as one step, and not the stand-in twice', () => {
    const { result, host } = renderEditorState({ ...model(), elements: [...model().elements, el('api', 'component')] }, { activeDiagramId: 'l7' });
    act(() => result.current.actions.setHostedOn('api', 'azure', azure));
    expect(host.current.model.elements.some((one) => one.id === 'azure' && one.ref === 'platforms')).toBe(true);
    expect(rows(host.current.model)).toEqual(['hostedOn:api>azure']);
    act(() => host.current.history.undo());
    expect(host.current.model.elements.some((one) => one.id === 'azure')).toBe(false);
    expect(rows(host.current.model)).toEqual([]);
    // Moving a row onto it brings it too; once held, it is not made again.
    act(() => result.current.actions.setHostedOn('api', 'openshift'));
    act(() => result.current.actions.setHostedOn('api', 'azure', azure));
    expect(rows(host.current.model)).toEqual(['hostedOn:api>azure']);
    const held = host.current.model.elements.filter((one) => one.id === 'azure').length;
    act(() => result.current.actions.setHostedOn('api', 'openshift'));
    act(() => result.current.actions.setHostedOn('api', 'azure', azure));
    expect(host.current.model.elements.filter((one) => one.id === 'azure').length).toBe(held);
  });
});

describe('setUses (ADR-0020)', () => {
  const bus = { id: 'ent-bus', kind: 'platformService' as const, name: 'Enterprise bus', ref: 'platforms', lifecycle: 'live' as const, isManaged: false, aspects: {} };

  it('creates and removes as one step, undoes as one step, and leaves another application\'s rows alone', () => {
    const { result, host } = renderEditorState(model([
      { id: 'u0', type: 'uses', sourceId: 'crm', targetId: 'containers' },
      { id: 'u1', type: 'uses', sourceId: 'wms', targetId: 'registry', validFrom: '2027-01-01' },
    ]), { activeDiagramId: 'l7' });
    const steps = () => host.current.commands.length;
    const before = steps();
    act(() => result.current.actions.setUses('wms', ['containers', 'registry', 'openshift']));
    expect(rows(host.current.model)).toEqual([
      'uses:crm>containers', 'uses:wms>registry@2027-01-01', 'uses:wms>containers', 'uses:wms>openshift',
    ]);
    expect(steps()).toBe(before + 1);
    act(() => result.current.actions.setUses('wms', ['openshift']));
    expect(rows(host.current.model)).toEqual(['uses:crm>containers', 'uses:wms>openshift']);
    act(() => host.current.history.undo());
    expect(rows(host.current.model)).toEqual([
      'uses:crm>containers', 'uses:wms>registry@2027-01-01', 'uses:wms>containers', 'uses:wms>openshift',
    ]);
    // Saying the same thing is not a step.
    const same = steps();
    act(() => result.current.actions.setUses('wms', ['registry', 'containers', 'openshift']));
    expect(steps()).toBe(same);
  });

  it('writes the stand-in in the same step as the row, and not twice', () => {
    const { result, host } = renderEditorState(model(), { activeDiagramId: 'l7' });
    act(() => result.current.actions.setUses('wms', ['ent-bus'], [bus]));
    expect(host.current.model.elements.some((one) => one.id === 'ent-bus' && one.ref === 'platforms')).toBe(true);
    expect(rows(host.current.model)).toEqual(['uses:wms>ent-bus']);
    act(() => host.current.history.undo());
    expect(host.current.model.elements.some((one) => one.id === 'ent-bus')).toBe(false);
    expect(rows(host.current.model)).toEqual([]);
    act(() => result.current.actions.setUses('wms', ['ent-bus'], [bus]));
    act(() => result.current.actions.setUses('crm', ['ent-bus'], [bus]));
    expect(host.current.model.elements.filter((one) => one.id === 'ent-bus')).toHaveLength(1);
    expect(rows(host.current.model)).toEqual(['uses:wms>ent-bus', 'uses:crm>ent-bus']);
  });

  it('refuses a wrong target as a value and writes the rest', () => {
    const { result, host } = renderEditorState(model(), { activeDiagramId: 'l7' });
    let answer!: { refused: string[] };
    // An actor is not something to use; an id nobody holds and no stand-in
    // was handed for is a row about nothing this scope can draw.
    act(() => { answer = result.current.actions.setUses('wms', ['ops', 'containers', 'ghost']); });
    expect(answer).toEqual({ refused: ['ops', 'ghost'] });
    expect(rows(host.current.model)).toEqual(['uses:wms>containers']);
    // The source has to be an application or a container.
    act(() => { answer = result.current.actions.setUses('ops', ['containers']); });
    expect(answer).toEqual({ refused: ['containers'] });
    expect(rows(host.current.model)).toEqual(['uses:wms>containers']);
  });

  it('is one Activity line, naming the application and the count', () => {
    const { result, host } = renderEditorState(model(), { activeDiagramId: 'l7' });
    const before = fromArrays(host.current.model);
    act(() => result.current.actions.setUses('wms', ['containers', 'ent-bus'], [bus]));
    expect(summarise([host.current.commands.at(-1)!], before)).toEqual({ key: 'activity.usesSet', name: 'wms', count: 2 });
  });
});
