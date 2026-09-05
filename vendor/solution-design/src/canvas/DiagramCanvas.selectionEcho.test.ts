import { describe, expect, it } from 'vitest';
import { isEchoOfPush } from './DiagramCanvas';

/**
 * The guard against the selection ping-pong: React Flow reports the selection
 * of whatever nodes it was last given, and a push can be one render stale when
 * a host model update lands while a click is in flight. Reported === pushed is
 * React Flow talking about our own nodes; anything else is the user.
 */
describe('isEchoOfPush', () => {
  const nodes = (...ids: string[]) => ids.map((id) => ({ id }));

  it('recognises the exact push, in any order', () => {
    const pushed = { elementIds: new Set(['a', 'b']), connectionIds: new Set(['c#1']) };
    expect(isEchoOfPush({ nodes: nodes('b', 'a'), edges: nodes('c#1') }, pushed)).toBe(true);
  });

  it('is not fooled by a subset, a superset or a different edge set', () => {
    const pushed = { elementIds: new Set(['a', 'b']), connectionIds: new Set<string>() };
    expect(isEchoOfPush({ nodes: nodes('a'), edges: [] }, pushed)).toBe(false);
    expect(isEchoOfPush({ nodes: nodes('a', 'b', 'c'), edges: [] }, pushed)).toBe(false);
    expect(isEchoOfPush({ nodes: nodes('a', 'b'), edges: nodes('c#1') }, pushed)).toBe(false);
  });

  it('treats an empty report against an empty push as an echo too', () => {
    expect(isEchoOfPush({ nodes: [], edges: [] }, { elementIds: new Set<string>(), connectionIds: new Set<string>() })).toBe(true);
  });
});
