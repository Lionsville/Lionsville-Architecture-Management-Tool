import { nodeMaxSize, nodeMinSize } from '../../model/placement';
import type { NodeFigure } from '../../model/kinds';
import type { Layer7Zone } from '../../model/types';
import type { ElementNodeData } from './nodeData';

/**
 * The resize limits a node's NodeResizer reads. Production gets them from
 * `buildNodes`, which knows the diagram's geometry; a test rendering a node
 * in isolation has no diagram, so it takes the default board's bands.
 */
export function testResizeLimits(
  figure: NodeFigure,
  zone: Layer7Zone = 'landscape',
): ElementNodeData['resizeLimits'] {
  return { min: nodeMinSize(figure), max: nodeMaxSize(figure, zone) };
}
