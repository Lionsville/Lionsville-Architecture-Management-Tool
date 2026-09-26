// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it, vi } from 'vitest';
import type { DesignElement, DesignModel, Relation } from '../model/types';
import { translator } from '../i18n/strings';
import type { LeverageLine } from '../model/leverage';
import type { EditorActions } from './useEditorState';
import {
  hostingChoices, inspectorField, leverageFor, leverageText, offersContainer, sharedNote,
  standInsFor, technologyChoices, usesChoices, type InspectorTechnology,
} from './elementInspectorFacts';

const t = translator('en');

function el(id: string, kind: DesignElement['kind'], over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind, name: id.toUpperCase(), lifecycle: 'live', isManaged: false, aspects: {}, ...over };
}

function row(id: string, type: Relation['type'], sourceId: string, targetId: string): Relation {
  return { id, type, sourceId, targetId } as Relation;
}

function model(elements: DesignElement[], relations: Relation[] = []): DesignModel {
  return { name: 'M', diagrams: [], elements, relations };
}

describe('the inspector field scope', () => {
  it('greys out exactly the fields the owning scope answers for, and none without one', () => {
    const actions = { updateElement: vi.fn() } as unknown as EditorActions;
    const owned = inspectorField(el('a', 'application'), model([]), false, actions, ['name']);
    expect(owned.owned('name')).toBe(true);
    expect(owned.owned('lifecycle')).toBe(false);
    expect(inspectorField(el('a', 'application'), model([]), false, actions, undefined).owned('name')).toBe(false);
  });

  it('folds typing into one step per field and writes a pick as a plain step', () => {
    const updateElement = vi.fn();
    const field = inspectorField(el('a', 'application'), model([]), false, { updateElement } as unknown as EditorActions, undefined);
    field.update({ lifecycle: 'retiring' });
    field.typed('name', { name: 'B' });
    expect(updateElement.mock.calls[0]).toEqual(['a', { lifecycle: 'retiring' }]);
    expect(updateElement.mock.calls[1][0]).toBe('a');
    expect(updateElement.mock.calls[1][2]).toBeDefined();
  });
});

describe('what Hosted on offers', () => {
  it('lists the places before the services, here and elsewhere, and never what this scope holds twice', () => {
    const service = el('svc', 'platform', { platformArchetype: 'service' });
    const place = el('ns', 'platform', { platformArchetype: 'place' });
    const technology: InspectorTechnology = {
      elsewhere: [
        { id: 'broker', name: 'Broker', kind: 'platform', place: false, where: 'ops' },
        { id: 'cloud', name: 'Cloud', kind: 'platform', place: true, where: 'ops' },
        { id: 'ns', name: 'Namespace', kind: 'platform', place: true, where: 'ops' },
        { id: 'offer', name: 'Offer', kind: 'platformService', place: false, where: 'ops' },
      ],
      standInFor: () => undefined,
    };
    const choices = hostingChoices(model([service, place, el('app', 'application')]), technology);
    expect(choices.platforms.map((one) => one.id)).toEqual(['ns', 'svc']);
    expect(choices.elsewhere.map((one) => one.id)).toEqual(['cloud', 'broker']);
  });
});

describe('the stand-ins a write needs', () => {
  it('asks only for what this scope does not hold, and drops what nobody can describe', () => {
    const standInFor = vi.fn((id: string) => (id === 'far' ? el('far', 'platformService', { ref: 'x/far' }) : undefined));
    expect(standInsFor(['here', 'far', 'unknown'], new Set(['here']), standInFor).map((one) => one.id)).toEqual(['far']);
    expect(standInFor).not.toHaveBeenCalledWith('here');
    expect(standInsFor(['far'], new Set(), undefined)).toEqual([]);
  });
});

describe('what Leverages says', () => {
  it('is nothing for a kind that runs nowhere, and the host’s answer where it has one', () => {
    const given = { services: [], platforms: [{ id: 'p', name: 'P' }] };
    expect(leverageFor(el('x', 'actor'), model([]), given)).toBeUndefined();
    expect(leverageFor(el('a', 'application'), model([]), given)).toBe(given);
  });

  it('reads this scope’s own rows where the host has no tree', () => {
    const m = model(
      [el('a', 'application'), el('s', 'platformService'), el('p', 'platform')],
      [row('r1', 'uses', 'a', 's'), row('r2', 'realises', 'p', 's')],
    );
    expect(leverageText(leverageFor(m.elements[0], m, undefined), t)).toBe('S (P)');
  });

  it('names each service with the platforms behind it, marks the implied, then the platforms used directly', () => {
    const line: LeverageLine = {
      services: [
        { id: 's', name: 'Queue', platforms: [{ id: 'p', name: 'Cluster' }, { id: 'q', name: 'Cloud' }] },
        { id: 'i', name: 'Mail', platforms: [], implied: true },
      ],
      platforms: [{ id: 'd', name: 'Disk' }],
    };
    expect(leverageText(line, t)).toBe(`Queue (Cluster, Cloud) · Mail ${t('field.leveragesImplied')} · Disk`);
    expect(leverageText(undefined, t)).toBe('');
  });
});

describe('the technology controls', () => {
  it('offers a platform its own kind as a parent, never itself or a stand-in, and reads its rows', () => {
    const self = el('p1', 'platform');
    const m = model(
      [self, el('p2', 'platform'), el('p3', 'platform', { ref: 'x/p3' }), el('s1', 'platformService'), el('team', 'actor')],
      [row('r1', 'realises', 'p1', 's1'), row('r2', 'assigned', 'team', 'p1')],
    );
    const choices = technologyChoices(self, m);
    expect(choices.isTechnology).toBe(true);
    expect(choices.kin.map((one) => one.id)).toEqual(['p2']);
    expect(choices.realised.map((one) => one.id)).toEqual(['s1']);
    expect(choices.maintainer).toBe('team');
  });

  it('offers an application no parent and no maintainer', () => {
    const choices = technologyChoices(el('a', 'application'), model([el('a', 'application')]));
    expect(choices.isTechnology).toBe(false);
    expect(choices.kin).toEqual([]);
    expect(choices.maintainer).toBe('');
  });
});

describe('the sentence beside Shared', () => {
  it('is the help where somebody ticked it or there is no tree to read', () => {
    expect(sharedNote(true, ['Web'], t)).toBe(t('field.sharedHelp'));
    expect(sharedNote(undefined, undefined, t)).toBe(t('field.sharedHelp'));
  });

  it('says who uses it from outside, or that nobody does', () => {
    expect(sharedNote(undefined, ['Web', 'Shop'], t)).toBe(t('field.sharedDerived', { names: 'Web, Shop' }));
    expect(sharedNote(undefined, [], t)).toBe(t('field.sharedWithin'));
  });
});

describe('what the Uses picker offers', () => {
  const technology: InspectorTechnology = {
    elsewhere: [
      { id: 'shared', name: 'Shared', kind: 'platformService', place: false, where: 'ops', shared: true },
      { id: 'private', name: 'Private', kind: 'platformService', place: false, where: 'ops' },
      { id: 'broker', name: 'Broker', kind: 'platform', place: false, where: 'ops' },
      { id: 'cloud', name: 'Cloud', kind: 'platform', place: true, where: 'ops' },
    ],
    standInFor: () => undefined,
  };

  it('lists this scope’s offerings and service platforms, then what others share and every service platform', () => {
    const app = el('a', 'application');
    const m = model([app, el('s', 'platformService'), el('svc', 'platform', { platformArchetype: 'service' }), el('ns', 'platform', { platformArchetype: 'place' })]);
    const uses = usesChoices(app, m, technology, t);
    expect(uses.usable.map((one) => `${one.group}:${one.id}`)).toEqual(['here:s', 'here:svc', 'elsewhere:shared', 'elsewhere:broker']);
  });

  it('offers nothing to a kind that uses nothing', () => {
    expect(usesChoices(el('x', 'actor'), model([el('x', 'actor')]), technology, t).usable).toEqual([]);
  });

  it('reads the rows as written, and labels a pill from elsewhere with where it comes from', () => {
    const app = el('a', 'application');
    const m = model([app, el('s', 'platformService')], [row('r1', 'uses', 'a', 's'), row('r2', 'uses', 'a', 'shared')]);
    const uses = usesChoices(app, m, technology, t);
    expect(uses.usesIds).toEqual(['s', 'shared']);
    expect(uses.pillLabel('s')).toBe('S');
    expect(uses.pillLabel('shared')).toBe(`Shared · ${t('field.usesShared')} · ops`);
    expect(uses.pillLabel('gone')).toBe('gone');
  });
});

describe('the container offer', () => {
  it('is made to an application this scope defines with no container diagram yet', () => {
    const app = el('a', 'application');
    expect(offersContainer(app, model([app]))).toBe(true);
    expect(offersContainer(el('a', 'application', { ref: 'x/a' }), model([]))).toBe(false);
    expect(offersContainer(el('c', 'component'), model([]))).toBe(false);
    const drawn = { ...model([app]), diagrams: [{ id: 'd', kind: 'container', applicationElementId: 'a' }] } as unknown as DesignModel;
    expect(offersContainer(app, drawn)).toBe(false);
  });
});
