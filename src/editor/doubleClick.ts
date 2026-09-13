/**
 * What a double-click on a card opens.
 *
 * What is inside the thing: an application's container diagram, and for
 * everything else its page. The one rule worth a file of its own is the
 * stand-in's — a record another scope answers for is shown THERE, selected,
 * because a container diagram made here would be a second one about somebody
 * else's application, and the owning scope's is the one that says what is
 * inside. A stand-in nobody defines has nowhere to go and falls through to
 * what a definition gets.
 */
import type { DesignDiagram, DesignElement, ElementId } from '../model';
import type { EditorOwnership } from './props';

export type DoubleClickTarget =
  | { kind: 'documentation' }
  | { kind: 'owner'; show: () => void }
  | { kind: 'container'; diagramId: string }
  | { kind: 'newContainer' };

export function doubleClickTarget(
  model: { elements: readonly DesignElement[]; diagrams: readonly DesignDiagram[] },
  elementId: ElementId,
  ownership: Pick<EditorOwnership, 'ownerOf'> | undefined,
): DoubleClickTarget | undefined {
  const element = model.elements.find((e) => e.id === elementId);
  if (!element) return undefined;
  if (element.kind !== 'application') return { kind: 'documentation' };
  if (element.ref !== undefined) {
    const show = ownership?.ownerOf(elementId)?.onShow;
    if (show) return { kind: 'owner', show };
  }
  const existing = model.diagrams.find(
    (d) => d.kind === 'container' && d.applicationElementId === elementId,
  );
  return existing ? { kind: 'container', diagramId: existing.id } : { kind: 'newContainer' };
}
