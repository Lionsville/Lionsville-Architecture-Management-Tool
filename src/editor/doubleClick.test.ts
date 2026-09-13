import { describe, expect, it, vi } from 'vitest';
import { doubleClickTarget } from './doubleClick';
import type { DesignElement } from '../model';

const element = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over,
});

const model = {
  elements: [
    element('erp'),
    element('wms', { ref: 'acme/logistics' }),
    element('ghost', { ref: 'nowhere' }),
    element('ops', { kind: 'actor' }),
  ],
  diagrams: [
    { id: 'l7', kind: 'layer7' as const, name: 'L', members: [], geometry: { nodes: [] } },
    { id: 'cd-erp', kind: 'container' as const, name: 'ERP', applicationElementId: 'erp', members: [], geometry: { nodes: [] } },
  ],
};

describe('doubleClickTarget', () => {
  it('opens the container diagram an application has, or makes one', () => {
    expect(doubleClickTarget(model, 'erp', undefined)).toEqual({ kind: 'container', diagramId: 'cd-erp' });
    expect(doubleClickTarget({ ...model, diagrams: [] }, 'erp', undefined)).toEqual({ kind: 'newContainer' });
  });

  it('shows a stand-in where it is defined, and never makes a container diagram here for it', () => {
    const show = vi.fn();
    const ownership = { ownerOf: (id: string) => (id === 'wms' ? { label: 'acme/logistics', fields: [], onShow: show } : undefined) };
    const target = doubleClickTarget(model, 'wms', ownership);
    expect(target?.kind).toBe('owner');
    if (target?.kind === 'owner') target.show();
    expect(show).toHaveBeenCalled();
  });

  it('falls through for a stand-in nobody can show, and opens a page for everything else', () => {
    expect(doubleClickTarget(model, 'ghost', { ownerOf: () => undefined })).toEqual({ kind: 'newContainer' });
    expect(doubleClickTarget(model, 'ops', undefined)).toEqual({ kind: 'documentation' });
    expect(doubleClickTarget(model, 'nope', undefined)).toBeUndefined();
  });
});
