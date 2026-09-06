// @vitest-environment jsdom
import { memo, useMemo, useRef } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlow, type NodeTypes } from '@xyflow/react';
import { apply, fromArrays, toArrays } from '../../model';
import type { HostModel } from '../../model/fromInterchange';
import { connection, diagram, element, model, placement } from '../../model/testFixtures';
import { buildNodes } from '../graph';
import type { ElementNode, ElementNodeProps } from './nodeData';
import { installReactFlowMocks } from '../reactFlowTestSetup';

/**
 * The point of handing back the objects that did not change: React Flow passes
 * them straight through, and a `React.memo`'d node component does not run.
 *
 * `graph.identity.test.ts` pins the objects. This pins the consequence, which
 * is the thing anybody actually cares about — that renaming one element
 * repaints one box and not the board — and it pins it through React Flow rather
 * than around it, because "the same object reaches the component" is a claim
 * about React Flow and not about the derive.
 *
 * The counting node stands in for the seven real ones. It is memoised exactly
 * as they are and does nothing else, so what it counts is how often React
 * decided a node's props had changed.
 */

const renders = new Map<string, number>();

const CountingNode = memo(function CountingNode({ id, data }: ElementNodeProps) {
  renders.set(id, (renders.get(id) ?? 0) + 1);
  return <div data-testid={`node-${id}`}>{data.element.name}</div>;
});

const nodeTypes: NodeTypes = { application: CountingNode };

const host: HostModel = model({
  elements: [element('a', { name: 'Alpha' }), element('b', { name: 'Beta' }), element('c', { name: 'Gamma' })],
  connections: [connection('a-b', 'a', 'b')],
  diagrams: [diagram('landscape', {
    placements: [
      placement('a', { x: 0, y: 0 }),
      placement('b', { x: 400, y: 0 }),
      placement('c', { x: 800, y: 0 }),
    ],
  })],
});

/** The canvas's own derive, in miniature: the previous list feeds the next one. */
function Board({ host: current }: { host: HostModel }) {
  const last = useRef<ElementNode[]>([]);
  const nodes = useMemo(() => {
    const next = buildNodes({
      model: current, diagram: current.diagrams[0], readOnly: false, edgeColor: '#888',
    }, last.current);
    last.current = next;
    return next;
  }, [current]);
  return (
    <div style={{ width: 800, height: 600 }}>
      <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
    </div>
  );
}

function renamed(id: string, name: string): HostModel {
  const result = apply(fromArrays(host), { type: 'element.update', id, patch: { name } });
  if (!result.ok) throw new Error(`the reducer refused: ${result.reason}`);
  return toArrays(result.model);
}

beforeAll(() => installReactFlowMocks());

describe('what a change repaints', () => {
  it('renders only the node whose element changed', () => {
    const view = render(<Board host={host} />);
    expect(view.getByTestId('node-b').textContent).toBe('Beta');
    const before = new Map(renders);
    expect(before.size).toBe(3);

    view.rerender(<Board host={renamed('b', 'Beta 2')} />);

    expect(view.getByTestId('node-b').textContent).toBe('Beta 2');
    expect(renders.get('b')).toBeGreaterThan(before.get('b') as number);
    expect(renders.get('a')).toBe(before.get('a'));
    expect(renders.get('c')).toBe(before.get('c'));
  });
});
