// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ReactNode } from 'react';
import Tooltip from '@mui/material/Tooltip';
import type { Translate } from '../../i18n';
import { useStrings } from '../../i18n/LanguageContext';
import { KIND_LABEL_KEYS } from '../../model/kinds';
import type { DesignElement, Lifecycle } from '../../model/types';
import { Card } from '../../widgets/kit/Card';
import { hasDocumentation, shortDescription } from '../../documentation/documentation';
import { shapeRadiusFor, type NodeShapeKind } from '../theme/elementStyle';
import { AspectBadgeRow } from './AspectBadgeRow';
import { BlockGlyph, DocGlyph, WarningGlyph } from './glyphs';
import { lifecycleWord } from './LifecycleBadge';
import { iconSlotSize, NodeIcon, NodeShell, usesBodyIcon } from './NodeShell';
import { shownDescription, type ElementNodeProps } from './nodeData';

/**
 * Every kind on a board, drawn as one thing: the kit's Card, which says more as the
 * reader comes closer. Far off a name and its marks; from 70% what it does; from 120%
 * what it is made by. A neutral fill and edge, with colour only for status and the one
 * lens that is up. What a person set by hand as its accent stays, as the thin rail.
 *
 * A kind differs by what it adds, not by what it looks like: its band says what it is.
 */
export function BoardTile({ data, selected, shape, outside, sub, about, statuses, figure }: Pick<ElementNodeProps, 'data' | 'selected'> & {
  shape: NodeShapeKind;
  /** It belongs to nobody here: told by a dashed edge. */
  outside?: boolean;
  /** Said from the middle distance, above the description. */
  sub?: ReactNode;
  /** Said only near. */
  about?: ReactNode;
  /** Whether this kind carries the board's status columns. */
  statuses?: boolean;
  /** Stands in the logo's place where this kind has a mark of its own. */
  figure?: ReactNode;
}) {
  const { t } = useStrings();
  const { element, note } = data;
  // A lens asks about what the board's status columns are on: the applications.
  const overlay = statuses ? data.overlay : undefined;
  const overlayFaded = statuses ? data.overlayFaded : undefined;
  const description = shortDescription(shownDescription(data));
  const large = usesBodyIcon(element);
  const phase = data.phase ?? element.lifecycle;
  const retired = data.showLifecycle && phase === 'retired';
  const corner = cornerMarks(overlay ? data : { ...data, overlay: undefined }, t);
  const marks = tileMarks(data, phase, statuses === true, t);
  const type = sub ?? contextTile(data, t);
  const lens = overlay
    ? { '--lv-lens-wash': overlay.tint, '--lv-lens-ink': overlay.ink, '--lv-lens-on': overlay.on } as React.CSSProperties
    : undefined;
  return (
    <NodeShell
      element={element}
      selected={selected}
      readOnly={data.readOnly}
      showLifecycle={false}
      phase={phase}
      resizeLimits={data.resizeLimits}
      selectionRing={false}
    >
      <Card
        className={tileClass(shape, outside === true)}
        name={element.name}
        title={element.name}
        data-lens={overlay ? true : undefined}
        style={{ ...lens, '--lv-corner': corner.length, borderRadius: shapeRadiusFor(shape, element.shapeVariant, Boolean(description)) } as React.CSSProperties}
        selected={selected}
        dimmed={retired || overlayFaded === true}
        planned={phase === 'planned' && data.showLifecycle}
        {...(overlay ? { rail: overlay.ink } : element.accentColor ? { rail: element.accentColor } : {})}
        lead={tileLead(element, figure, large)}
        sub={type || description ? (
          <>
            {type}
            {description && <span className="lv-tile__description">{type ? ' ' : ''}{description}</span>}
          </>
        ) : undefined}
        about={about || note ? <>{note?.from}{note && about ? ' · ' : ''}{about}</> : undefined}
        marks={marks}
        {...c4Attributes(data, shape)}
      />
      {corner.length > 0 && <span className="lv-tile__corner" style={lens}>{corner}</span>}
    </NodeShell>
  );
}

/** What a box on a container diagram is, in brackets and on one line: its nature never rests on its colour alone. */
export function TileType({ words }: { words: string }) {
  return <span className="lv-tile__type" title={words}>{`[${words}]`}</span>;
}

/** C4 says *person* where the rest of the product says actor; everything else goes by the name of its kind. */
function contextType(kind: DesignElement['kind'], t: Translate): string {
  return kind === 'actor' ? t('c4.person') : t(KIND_LABEL_KEYS[kind]);
}

function contextTile(data: ElementNodeProps['data'], t: Translate): ReactNode {
  return data.c4Context ? <TileType words={contextType(data.element.kind, t)} /> : undefined;
}

/** What board.css reads off a box on a container diagram. */
function c4Attributes(data: ElementNodeProps['data'], shape: NodeShapeKind) {
  return {
    ...(data.c4Context ? { 'data-context': true } : {}),
    ...(data.element.shapeVariant === 'store' && shape === 'component' ? { 'data-store': true } : {}),
  };
}

/** A dashed edge for what is outside; the bands' short boxes have room for one line far off. */
function tileClass(shape: NodeShapeKind, outside: boolean): string {
  if (outside) return 'lv-tile lv-tile--outside';
  return shape === 'application' ? 'lv-tile' : 'lv-tile lv-tile--low';
}

/** What stays on a tile at every distance: its status columns where its kind has them, and a phase that is not the plain one. */
function tileMarks(data: ElementNodeProps['data'], phase: Lifecycle, statuses: boolean, t: Translate): ReactNode {
  const row = statuses && data.aspectConfig.length > 0;
  const life = data.showLifecycle ? lifecycleWord(phase, t) : undefined;
  const under = data.hasContainerDiagram ? <span className="lv-tile__under">{containersWord(data.containerCount ?? 0, t)}</span> : undefined;
  if (!row && !life && !under) return undefined;
  return (
    <>
      {row && <AspectBadgeRow aspects={data.element.aspects} config={data.aspectConfig} />}
      {life}
      {under}
    </>
  );
}

/** A logo somebody chose, or the kind's own figure; a large one leads at any distance. */
function tileLead(element: ElementNodeProps['data']['element'], figure: ReactNode, large: boolean): ReactNode {
  const icon = (
    <NodeIcon
      element={element}
      size={iconSlotSize(element)}
      fallback={figure ?? (element.kind === 'buildingBlock' ? <BlockGlyph /> : undefined)}
    />
  );
  if (!element.iconKey && !figure && element.kind !== 'buildingBlock') return undefined;
  return <span className="lv-tile__icon" data-large={large || undefined}>{icon}</span>;
}

/** What stays in the corner at every distance: a diagram under it, a document, a finding, the lens's number. */
function cornerMarks(data: ElementNodeProps['data'], t: Translate): ReactNode[] {
  const marks: ReactNode[] = [];
  if (data.overlay) {
    marks.push(
      <span key="lens" className="lv-lens-tag" data-testid="overlay-tag" aria-label={t('node.overlayBand', { index: String(data.overlay.index) })}>
        {data.overlay.index}
      </span>,
    );
  }
  if (data.note?.warning) {
    marks.push(
      <span key="warning" role="img" data-testid="stand-in-warning" title={data.note.warning} aria-label={data.note.warning}>
        <WarningGlyph size={11} />
      </span>,
    );
  }
  if (hasDocumentation(shownDescription(data))) {
    marks.push(<Tooltip key="doc" title={t('node.hasDocumentation')}><span role="img" data-testid="doc-glyph"><DocGlyph /></span></Tooltip>);
  }
  return marks;
}

/** What is under an application with a diagram, in words on the card. */
export function containersWord(count: number, t: Translate): string {
  if (count === 0) return t('node.containersNone');
  return count === 1 ? t('node.containersOne') : t('node.containersMany', { count });
}
