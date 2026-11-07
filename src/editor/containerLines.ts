// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a container diagram draws, as data: its lines by number, and what its key has
 * to explain. From the graph the canvas draws, so the Lines list, the numbers on the
 * canvas, the key and the export cannot disagree. Nothing here is kept.
 */
import type { DesignDiagram, DesignModel, Relation } from '../model/types';
import { hasDocumentation, shortDescription } from '../documentation/documentation';
import { buildEdges, buildNodes } from './graph';

export type DiagramLine = {
  readonly id: string;
  readonly number: number;
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly protocol?: string;
  readonly validFrom?: string;
  readonly validUntil?: string;
  /** It reaches the application and names no container yet. */
  readonly unlanded: boolean;
  readonly assumed: boolean;
};

const graphArgs = (model: DesignModel, diagram: DesignDiagram, day: string | undefined) => ({
  model, diagram, readOnly: true, edgeColor: '', showLifecycle: false, ...(day ? { asOfDay: day } : {}),
});

/** The lines a container diagram draws on a day, in their numbers' order. */
export function diagramLines(model: DesignModel, diagram: DesignDiagram, day: string | undefined): DiagramLine[] {
  const nameOf = new Map(model.elements.map((one) => [one.id, one.name]));
  const relationOf = new Map<string, Relation>(model.relations.map((one) => [one.id, one]));
  return buildEdges(graphArgs(model, diagram, day)).flatMap((edge) => {
    const number = edge.data?.number;
    if (number === undefined) return [];
    const relation = relationOf.get(edge.id);
    return [{
      id: edge.id,
      number,
      from: nameOf.get(edge.source) ?? edge.source,
      to: nameOf.get(edge.target) ?? edge.target,
      ...(edge.data?.label ? { label: edge.data.label } : {}),
      ...(edge.data?.protocol ? { protocol: edge.data.protocol } : {}),
      ...(relation?.validFrom ? { validFrom: relation.validFrom } : {}),
      ...(relation?.validUntil ? { validUntil: relation.validUntil } : {}),
      unlanded: edge.data?.unlanded === true,
      assumed: relation?.certainty === 'assumed',
    }];
  });
}

export type ContainerFacts = {
  readonly containers: number;
  readonly around: number;
  readonly lines: number;
  readonly description?: string;
  readonly drawn: ReadonlySet<'container' | 'store' | 'application' | 'person' | 'platform' | 'unlanded' | 'line'>;
};

/** What is drawn on a day: the counts its head says, and what its key explains. */
export function containerFacts(model: DesignModel, diagram: DesignDiagram, day: string | undefined): ContainerFacts {
  const drawn = new Set<ContainerFacts['drawn'] extends ReadonlySet<infer K> ? K : never>();
  let containers = 0;
  let around = 0;
  for (const node of buildNodes(graphArgs(model, diagram, day))) {
    const { element } = node.data;
    if (element.id === diagram.applicationElementId) continue;
    if (element.kind === 'component') {
      containers += 1;
      drawn.add(element.shapeVariant === 'store' ? 'store' : 'container');
    } else {
      around += 1;
      drawn.add(element.kind === 'actor' ? 'person' : element.kind === 'platform' || element.kind === 'platformService' ? 'platform' : 'application');
    }
  }
  const lines = diagramLines(model, diagram, day);
  for (const line of lines) drawn.add(line.unlanded ? 'unlanded' : 'line');
  const application = model.elements.find((one) => one.id === diagram.applicationElementId);
  const description = application?.description && !hasDocumentationOnly(application.description) ? shortDescription(application.description) : undefined;
  return { containers, around, lines: lines.length, drawn, ...(description ? { description } : {}) };
}

const hasDocumentationOnly = (text: string) => hasDocumentation(text) && !shortDescription(text);
