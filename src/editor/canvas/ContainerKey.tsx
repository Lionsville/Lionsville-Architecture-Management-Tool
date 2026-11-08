// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { Panel } from '@xyflow/react';
import { useStrings } from '../../i18n/LanguageContext';
import { badgeLegend } from '../../model/aspects';
import { KeyStrip, type KeyValue } from '../../widgets/kit/KeyStrip';
import { Mark } from '../../widgets/kit/Mark';
import { ASPECT_STATUS_LABEL } from '../aspectLegend';
import { STATUS_MARK } from '../nodes/AspectBadgeRow';
import { containerFacts } from '../containerLines';
import type { DesignDiagram, DesignModel } from '../../model/types';

/** What a sample of each thing looks like: the same tokens as the thing, so the key cannot drift from it. */
const box = (shape: string) => <span className="lv-key-box" data-shape={shape} aria-hidden="true" />;
const line = (dashed: boolean) => (
  <svg className="lv-key-line" width="28" height="10" aria-hidden="true">
    <line x1="1" y1="5" x2="21" y2="5" strokeDasharray={dashed ? '5 3' : undefined} />
    <path d="M28 5 L20 1.5 L20 8.5 Z" />
  </svg>
);

/**
 * The notation of this diagram, generated from what it draws (C4 asks every diagram
 * for one): what a box is and what a line is, and nothing that is not there. A strip on
 * the canvas, so that it travels with a picture; Show takes it down.
 */
export function containerKeyValues(
  model: DesignModel,
  diagram: DesignDiagram,
  day: string | undefined,
  t: ReturnType<typeof useStrings>['t'],
  shows: { deployment: boolean },
): KeyValue[] {
  const { drawn } = containerFacts(model, diagram, day);
  const row = (id: string, label: string, sample: KeyValue['sample']): KeyValue => ({ id, label, sample });
  return [
    ...(drawn.has('container') ? [row('container', t('key.container'), box('container'))] : []),
    ...(drawn.has('store') ? [row('store', t('key.store'), box('store'))] : []),
    ...(drawn.has('application') ? [row('application', t('key.application'), box('context'))] : []),
    ...(drawn.has('person') ? [row('person', t('key.person'), box('person'))] : []),
    ...(drawn.has('platform') ? [row('platform', t('key.platform'), box('context'))] : []),
    row('boundary', t('key.boundary'), box('boundary')),
    ...(shows.deployment ? [row('deployment', t('key.deployment'), box('deployment'))] : []),
    ...(drawn.has('line') ? [row('line', t('key.line'), line(false))] : []),
    ...(drawn.has('unlanded') ? [row('unlanded', t('key.unlanded'), line(true))] : []),
  ];
}

export function ContainerKey({ model, diagram, day, showDeployment, showStatus }: {
  model: DesignModel;
  diagram: DesignDiagram;
  day: string | undefined;
  showDeployment: boolean;
  /** The boxes carry their status marks, asked for: the key then says what they mean. */
  showStatus: boolean;
}) {
  const { t } = useStrings();
  const legend = showStatus ? badgeLegend(diagram) : undefined;
  const status: KeyValue[] = legend && legend.columns.length > 0
    ? [...legend.statuses, 'unset' as const].map((one) => ({
      id: one,
      label: one === 'unset' ? t('overlay.unset') : t(ASPECT_STATUS_LABEL[one]),
      shown: <Mark kind={STATUS_MARK[one]} />,
    }))
    : [];
  return (
    <Panel position="bottom-right" data-canvas-float="" style={{ maxWidth: 'calc(100% - 420px)' }}>
      <KeyStrip
        all
        data-testid="container-key"
        data-guide="board.key"
        values={[...containerKeyValues(model, diagram, day, t, { deployment: showDeployment }), ...status]}
        {...(status.length > 0 ? { note: t('board.keyColumns', { columns: legend?.columns.map((column) => column.label).join(', ') ?? '' }) } : {})}
      />
    </Panel>
  );
}
