// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseDragPayload, type DragPayload } from './DiagramCanvas';

/**
 * Drag-payload parsing. Current payloads are JSON `{ kind, iconKey?, name? }` for
 * an element and `{ kind: 'domainGroup', name?, color? }` for a group. Two kinds
 * of old payload must still work: one from a tab opened before the palette recut
 * (which may carry `accentColor`/`shapeVariant`), and a legacy bare-kind string,
 * which degrades to an unseeded add.
 */

/** Narrow to the element branch, failing loudly rather than silently skipping. */
function asElement(payload: DragPayload) {
  if (payload.target !== 'element') throw new Error(`expected an element, got ${payload.target}`);
  return payload;
}

function asGroup(payload: DragPayload) {
  if (payload.target !== 'domainGroup') throw new Error(`expected a group, got ${payload.target}`);
  return payload;
}

describe('parseDragPayload', () => {
  it('parses a seeded payload from the tray', () => {
    const out = asElement(
      parseDragPayload(JSON.stringify({ kind: 'application', iconKey: 'salesforce', name: 'CRM' })),
    );
    expect(out.kind).toBe('application');
    expect(out.seed?.iconKey).toBe('salesforce');
    expect(out.seed?.name).toBe('CRM');
  });

  it('parses a bare kind payload (closed row) → kind only', () => {
    const out = asElement(parseDragPayload(JSON.stringify({ kind: 'actor' })));
    expect(out.kind).toBe('actor');
    expect(out.seed).toEqual({ iconKey: undefined, name: undefined });
  });

  it('refuses a payload with no kind rather than guessing one', () => {
    expect(parseDragPayload(JSON.stringify({ iconKey: 'database' })).target).toBe('none');
  });

  /**
   * A domain group is its own target, not a seventh element kind. The union is
   * what stops a group's colour reaching `addElement`, so what matters here is
   * that the group branch is chosen AND that it carries no element fields.
   */
  it('parses a domain group with its name and colour', () => {
    const out = asGroup(
      parseDragPayload(JSON.stringify({ kind: 'domainGroup', name: 'Commerce', color: '#2f6fdb' })),
    );
    expect(out.seed).toEqual({ name: 'Commerce', color: '#2f6fdb' });
    expect(out).not.toHaveProperty('kind');
  });

  it('parses an untouched domain group row (no seed fields set)', () => {
    const out = asGroup(parseDragPayload(JSON.stringify({ kind: 'domainGroup' })));
    expect(out.seed).toEqual({ name: undefined, color: undefined });
  });

  it('never lets a group payload carry a logo through', () => {
    const out = asGroup(
      parseDragPayload(JSON.stringify({ kind: 'domainGroup', iconKey: 'salesforce' })),
    );
    expect(out.seed).not.toHaveProperty('iconKey');
  });
});
