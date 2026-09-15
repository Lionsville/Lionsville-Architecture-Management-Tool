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
import { refinementsOf } from '../model';
import type { DesignDiagram, DesignElement, ElementId, Relation } from '../model';
import type { EditorOwnership } from './props';

export type DoubleClickTarget =
  | { kind: 'documentation' }
  | { kind: 'owner'; show: () => void }
  | { kind: 'container'; diagramId: string }
  | { kind: 'newContainer' }
  /** A platform's report (ADR-0013): what would be left standing if it went. */
  | { kind: 'platformReport'; platformId: ElementId };

export function doubleClickTarget(
  model: { elements: readonly DesignElement[]; diagrams: readonly DesignDiagram[] },
  elementId: ElementId,
  ownership: Pick<EditorOwnership, 'ownerOf'> | undefined,
): DoubleClickTarget | undefined {
  const element = model.elements.find((e) => e.id === elementId);
  if (!element) return undefined;
  // What is inside a platform is what stands on it (ADR-0013). A report and
  // not a view: it is derived from the rows this scope holds, whoever defines
  // the platform, so there is nothing to make and nothing to find.
  if (element.kind === 'platform') return { kind: 'platformReport', platformId: elementId };
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


/**
 * What a double-click on a LINE opens (ADR-0013, redone).
 *
 * The way down. A landscape draws the functional interface; where it arrives
 * is a level below, and the line itself is the way there — the container
 * diagram of the application it points TO, with its landings selected, so the
 * question "where does this actually arrive" is one gesture rather than a hunt
 * through the tabs.
 *
 * The target first because that is where an interface lands — the source calls
 * and the target answers — and the source second rather than nowhere, since a
 * line whose target has no container diagram and whose source has one still
 * has somewhere to go. Neither: an offer to make the target's, which is what a
 * double-click on the application itself would give.
 *
 * Only on a landscape. On a container diagram a double-click on a line adds a
 * bend, which is what it has always done and what a line being drawn there
 * needs.
 */
export type LineDoubleClickTarget =
  | { kind: 'container'; diagramId: string; select: readonly string[] }
  | { kind: 'newContainer'; applicationId: ElementId };

export function lineDoubleClickTarget(
  model: {
    elements: readonly DesignElement[];
    relations: readonly Relation[];
    diagrams: readonly DesignDiagram[];
  },
  diagram: Pick<DesignDiagram, 'kind'>,
  relationId: string,
): LineDoubleClickTarget | undefined {
  if (diagram.kind !== 'layer7') return undefined;
  const relation = model.relations.find((c) => c.id === relationId);
  if (!relation || relation.type !== 'flow') return undefined;
  const select = refinementsOf(model.relations, relationId).map((row) => row.id);
  const containerFor = (id: ElementId) =>
    model.diagrams.find((d) => d.kind === 'container' && d.applicationElementId === id);
  for (const end of [relation.targetId, relation.sourceId]) {
    const view = containerFor(end);
    if (view) return { kind: 'container', diagramId: view.id, select };
  }
  // A record another scope answers for is not ours to open up (ADR-0012 §3):
  // a container diagram made here would be a second one about somebody else's
  // application, which is the rule a double-click on the card already obeys.
  for (const end of [relation.targetId, relation.sourceId]) {
    const element = model.elements.find((e) => e.id === end);
    if (element?.kind === 'application' && element.ref === undefined) {
      return { kind: 'newContainer', applicationId: end };
    }
  }
  return undefined;
}
