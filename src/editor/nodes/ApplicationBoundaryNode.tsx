// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { memo, useContext } from 'react';
import { useStrings } from '../../i18n/LanguageContext';
import { PageState } from '../../widgets/kit/PageState';
import { Zone } from '../../widgets/kit/Zone';
import { ContainerBoardContext } from '../canvas/containerBoard';
import { iconSlotSize, NodeIcon, NodeShell } from './NodeShell';
import type { ElementNodeProps } from './nodeData';

/**
 * On a container diagram, the application itself renders as the C4 boundary: the kit's
 * dashed zone, with its name first and top left, since it names what is being looked
 * at. It is a real node (selectable, and lines from the context attach to its sides) but
 * sits behind everything by a negative z-index set in graph building.
 *
 * Its own logo belongs on the frame around it. It takes no resizer, as the diagram sizes
 * it, and no selection ring: it recolours its edge instead, because a ring round a whole
 * diagram would read as a frame round the containers.
 *
 * The inside lets the pointer through: this node can end up painted over its children
 * while selected, and must not swallow a press meant for them. Only the head is
 * pressed, so the handles are the shell's, outside the zone. Empty, the inside says
 * what goes here and offers the first step.
 */
export const ApplicationBoundaryNode = memo(function ApplicationBoundaryNode({
  data,
  selected,
}: ElementNodeProps) {
  const { t } = useStrings();
  const { element } = data;
  return (
    <NodeShell
      element={element}
      selected={selected}
      readOnly={data.readOnly}
      showLifecycle={data.showLifecycle}
      phase={data.phase}
      selectionRing={false}
    >
      <Zone
        kind="boundary"
        name={element.name}
        className="lv-boundary"
        data-testid="boundary-fill"
        data-selected={selected || undefined}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...(element.accentColor ? { '--zone-edge': element.accentColor } as React.CSSProperties : {}) }}
        headProps={{ style: { pointerEvents: 'auto', width: 'fit-content' }, ...{ 'data-testid': 'boundary-title' } as object }}
        aside={(
          <>
            <NodeIcon element={element} size={iconSlotSize(element, 16)} />
            {`[${t('c4.application')}]`}
          </>
        )}
      >
        {data.c4Empty && <EmptyBoundary name={element.name} />}
      </Zone>
    </NodeShell>
  );
});

/** What a new diagram is for and its first step, where a person can take it. Holds its size, as the name does. */
function EmptyBoundary({ name }: { name: string }) {
  const { t } = useStrings();
  const { onAddContainer } = useContext(ContainerBoardContext);
  return (
    <div className="lv-boundary__empty nodrag nopan" data-testid="empty-boundary">
      <PageState
        state="empty"
        compact
        title={t('c4.emptyTitle', { name })}
        body={onAddContainer ? t('c4.emptyHow', { name }) : t('c4.emptyRead')}
        {...(onAddContainer ? { action: { label: t('c4.emptyAdd'), onPress: onAddContainer, dataGuide: 'board.addContainer' } } : {})}
      />
    </div>
  );
}
