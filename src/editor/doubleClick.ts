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
 *
 * A double-click OPENS and never makes. It used to seed a container diagram
 * for an application that had none, which is a new view in the model made by
 * a gesture that reads as "look inside" — and the first thing a person did
 * with the view they had not asked for was look for a way to delete it. An
 * application with nothing inside answers `undefined` here: the menu's
 * *Create container diagram* and the inspector's button are where one is
 * made, on purpose, and both go through the same command.
 */
import { refinementsOf } from '../model';
import type { DesignDiagram, DesignElement, ElementId, Relation } from '../model';
import type { EditorOwnership } from './props';

export type DoubleClickTarget =
  | { kind: 'documentation' }
  | { kind: 'owner'; show: () => void }
  | { kind: 'container'; diagramId: string }
  /** A platform's report (ADR-0013): what would be left standing if it went. */
  | { kind: 'platformReport'; platformId: ElementId }
  /** A service's report (ADR-0014): what would be stranded if it were withdrawn. */
  | { kind: 'serviceReport'; serviceId: ElementId };

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
  // And the offering's, from the other side (ADR-0014): who leans on it.
  if (element.kind === 'platformService') return { kind: 'serviceReport', serviceId: elementId };
  if (element.kind !== 'application') return { kind: 'documentation' };
  if (element.ref !== undefined) {
    const show = ownership?.ownerOf(elementId)?.onShow;
    if (show) return { kind: 'owner', show };
  }
  const existing = model.diagrams.find(
    (d) => d.kind === 'container' && d.applicationElementId === elementId,
  );
  return existing ? { kind: 'container', diagramId: existing.id } : undefined;
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
 * has somewhere to go. Neither: nothing, for the reason a double-click on the
 * card makes nothing — a view is made on purpose, from the menu or the
 * inspector, never as the side effect of looking for one.
 *
 * Only on a landscape. On a container diagram a double-click on a line adds a
 * bend, which is what it has always done and what a line being drawn there
 * needs.
 */
export type LineDoubleClickTarget =
  | { kind: 'container'; diagramId: string; select: readonly string[] };

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
  return undefined;
}
