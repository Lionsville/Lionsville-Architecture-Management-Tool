// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The panel for one line: the same shell and rows as an element's. Properties says
 * what the line is, and Appearance how it is drawn, its Route said there once.
 *
 * Style rows follow the NULL-inherit contract (U4b): the default choice writes
 * `undefined`, so the line keeps inheriting what the board draws by default and no
 * explicit default ever lands in a file. A value reads as what is in force, with
 * *(default)* where nobody chose it.
 *
 * A route is per view while the line is the model's, which is why this takes the
 * diagram: which of them owns the route, how many bends, and which side each end
 * leaves from are facts about this view.
 */
import { useState } from 'react';
import type {
  AttachSide,
  DesignConnection,
  DesignDiagram,
  DesignModel,
  EdgeArrowhead,
  EdgeLineStyle,
  EdgeRouting,
} from '../model/types';
import { routeFor, routeSource, type AttachSidesPatch } from '../model/routes';
import { candidateInterfaces, isContainerLine, protocolsOf, refinementsOf } from '../model/refines';
import { formatDay } from '../i18n/dates';
import type { Language } from '../i18n/languages';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey, Translate } from '../i18n/strings';
import { Button } from '../widgets/kit/Button';
import { PropertyRow, PropertyRows, Select, TextInput } from '../widgets/kit/Field';
import type { RowEditor } from '../widgets/kit/Field';
import { MoreMenu } from '../widgets/kit/Menu';
import { Panel, PanelLink, PanelSection } from '../widgets/kit/Panel';
import { ColorField } from './ColorField';
import { certaintyRow } from './inspector/elementRows';
import { DASH, RowSet, pickEdit } from './inspector/rowTools';
import type { RowSpec } from './inspector/rowTools';
import type { EditorActions } from './useEditorState';
import './inspector/inspector.css';

export const LINE_STYLE_OPTIONS: { value: EdgeLineStyle | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'option.solidDefault' },
  { value: 'dashed', labelKey: 'option.dashed' },
  { value: 'dotted', labelKey: 'option.dotted' },
];
const ROUTING_OPTIONS: { value: EdgeRouting | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'option.smoothDefault' },
  { value: 'orthogonal', labelKey: 'shape.orthogonal' },
  { value: 'straight', labelKey: 'shape.straight' },
  { value: 'curved', labelKey: 'shape.curved' },
];
const ARROWHEAD_OPTIONS: { value: EdgeArrowhead | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'option.default' },
  { value: 'arrow', labelKey: 'option.arrow' },
  { value: 'none', labelKey: 'common.none' },
];
/** Attach sides: the empty option is Automatic, stored as no side. */
const ATTACH_SIDE_OPTIONS: { value: AttachSide | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'side.auto' },
  { value: 'top', labelKey: 'side.top' },
  { value: 'right', labelKey: 'side.right' },
  { value: 'bottom', labelKey: 'side.bottom' },
  { value: 'left', labelKey: 'side.left' },
];

const options = <V extends string>(list: readonly { value: V; labelKey: StringKey }[], t: Translate) =>
  list.map((one) => ({ value: one.value as string, label: t(one.labelKey) }));
const said = <V extends string>(list: readonly { value: V; labelKey: StringKey }[], value: string | undefined, t: Translate) => {
  const one = list.find((option) => option.value === (value ?? ''));
  return one ? t(one.labelKey) : value ?? '';
};

/** *Always*, the state an undated line is really in, or its window in words. */
export function validWords(connection: Pick<DesignConnection, 'validFrom' | 'validUntil'>, language: Language, t: Translate): string {
  const { validFrom, validUntil } = connection;
  if (!validFrom && !validUntil) return t('inspector.always');
  return `${validFrom ? formatDay(validFrom, language) : t('inspector.noStart')} – ${validUntil ? formatDay(validUntil, language) : t('inspector.noEnd')}`;
}

/** The two days of a window, written as they are typed; nothing waits on the other. */
export function ValidEditor({ editor, connection, onWrite, t }: {
  editor: RowEditor;
  connection: Pick<DesignConnection, 'validFrom' | 'validUntil'>;
  onWrite(patch: Partial<Pick<DesignConnection, 'validFrom' | 'validUntil'>>): void;
  t: Translate;
}) {
  return (
    <div
      className="inspector-aspect"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) editor.cancel(); }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); editor.cancel(); } }}
    >
      <TextInput autoFocus type="date" data-fit aria-label={t('field.validFrom')} value={connection.validFrom ?? ''} onChange={(event) => onWrite({ validFrom: event.target.value || undefined })} />
      <TextInput type="date" data-fit aria-label={t('field.validUntil')} value={connection.validUntil ?? ''} onChange={(event) => onWrite({ validUntil: event.target.value || undefined })} />
    </div>
  );
}

export function ConnectionInspector({
  connection,
  model,
  diagram,
  readOnly,
  actions,
  onResetRoute,
  onSetRouteSides,
  onRequestDelete,
  onOpenLanding,
}: {
  connection: DesignConnection;
  model: DesignModel;
  diagram: DesignDiagram;
  readOnly: boolean;
  actions: EditorActions;
  /** The editor owns it: with live routing off it has to run the pass and amend it into the reset's undo step. Absent hides the button. */
  onResetRoute?(connectionId: string): void;
  /** The editor owns it for the same reason. Absent, the sides only read. */
  onSetRouteSides?(connectionId: string, sides: AttachSidesPatch): void;
  /** Ask the editor to confirm first. Absent, it deletes straight away, as the menu and the Delete key do. */
  onRequestDelete?(connectionId: string): void;
  /** *Open* beside the detail: go where this interface lands (ADR-0013). */
  onOpenLanding?(connectionId: string): void;
}) {
  const { t, language } = useStrings();
  const name = (id: string) => model.elements.find((e) => e.id === id)?.name ?? '?';
  const update = (patch: Partial<Omit<DesignConnection, 'id'>>) => actions.updateConnection(connection.id, patch);
  const [tab, setTab] = useState<'properties' | 'appearance'>('properties');
  const [help, setHelp] = useState<string>();
  const [seenId, setSeenId] = useState(connection.id);
  if (seenId !== connection.id) {
    setSeenId(connection.id);
    setTab('properties');
  }

  const route = routeFor(diagram, connection.id);
  const routeStatus: 'none' | 'auto' | 'manual' = route ? routeSource(route) : 'none';
  const bendCount = route?.waypoints.length ?? 0;
  const bends = bendCount === 1 ? t('route.bendsOne') : t('route.bendsOther', { count: bendCount });
  const badge = { none: t('route.none'), auto: t('route.auto'), manual: t('route.manual') }[routeStatus];

  return (
    <Panel
      kind={t('section.connection')}
      name={`${name(connection.sourceId)} ${connection.isBidirectional ? '↔' : '→'} ${name(connection.targetId)}`}
      facts={[connection.certainty ? t(`certainty.${connection.certainty}` as StringKey) : undefined, badge, bendCount > 0 ? bends : undefined].filter(Boolean).join(' · ')}
      actions={!readOnly && (
        <MoreMenu
          label={t('inspector.more')} size="small"
          items={[{
            label: t('route.deleteConnection'), final: true,
            onSelect: () => (onRequestDelete ? onRequestDelete(connection.id) : actions.deleteConnection(connection.id)),
          }]}
        />
      )}
      tabs={[{ value: 'properties', label: t('inspector.properties') }, { value: 'appearance', label: t('tab.appearance') }]}
      tab={tab}
      onTab={(next) => setTab(next as 'properties' | 'appearance')}
      help={help}
    >
      <div key={connection.id}>
        {tab === 'properties' && (
          <RowSet rows={connectionRows({ connection, model, name, update, onOpenLanding, language, t })} surface="panel" readOnly={readOnly} onHelp={setHelp} />
        )}
        {tab === 'appearance' && (
          <ConnectionAppearance
            connection={connection} route={route} routeStatus={routeStatus} badge={badge} bends={bends} readOnly={readOnly} actions={actions} update={update}
            onHelp={setHelp} onResetRoute={onResetRoute} onSetRouteSides={onSetRouteSides}
          />
        )}
      </div>
    </Panel>
  );
}

/** How it is drawn, and its Route, said once. */
function ConnectionAppearance({ connection, route, routeStatus, badge, bends, readOnly, actions, update, onHelp, onResetRoute, onSetRouteSides }: {
  connection: DesignConnection;
  route: ReturnType<typeof routeFor>;
  routeStatus: 'none' | 'auto' | 'manual';
  badge: string;
  bends: string;
  readOnly: boolean;
  actions: EditorActions;
  update(patch: Partial<Omit<DesignConnection, 'id'>>): void;
  onHelp(help: string | undefined): void;
  onResetRoute: ((connectionId: string) => void) | undefined;
  onSetRouteSides: ((connectionId: string, sides: AttachSidesPatch) => void) | undefined;
}) {
  const { t } = useStrings();
  return (
<>
            <PropertyRows readOnly={readOnly} onHelp={onHelp}>
              <PropertyRow
                label={t('field.colour')} data-testid="connection-colour" value={connection.color ?? ''} empty={t('option.default')}
                edit={() => <ColorField label={t('field.colour')} ariaLabel={t('field.edgeColour')} value={connection.color} readOnly={false} onChange={(value) => update({ color: value })} />}
              />
              <PropertyRow
                label={t('field.lineStyle')} data-testid="connection-style" value={said(LINE_STYLE_OPTIONS, connection.lineStyle, t)}
                edit={{ options: options(LINE_STYLE_OPTIONS, t) }}
                onCommit={(value) => update({ lineStyle: value === '' ? undefined : value as EdgeLineStyle })}
              />
              <PropertyRow
                label={t('field.arrowheads')} data-testid="connection-arrowheads" help={t('field.directionHelp')}
                value={connection.sourceArrowhead || connection.targetArrowhead
                  ? `${said(ARROWHEAD_OPTIONS, connection.sourceArrowhead, t)} · ${said(ARROWHEAD_OPTIONS, connection.targetArrowhead, t)}`
                  : t('field.arrowheadsFollow')}
                edit={(editor) => (
                  <div
                    className="inspector-aspect"
                    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) editor.cancel(); }}
                    onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); editor.cancel(); } }}
                  >
                    <Select
                      autoFocus data-fit aria-label={t('field.source')} value={connection.sourceArrowhead ?? ''} options={options(ARROWHEAD_OPTIONS, t)}
                      onChange={(event) => update({ sourceArrowhead: event.target.value === '' ? undefined : event.target.value as EdgeArrowhead })}
                    />
                    <Select
                      data-fit aria-label={t('field.target')} value={connection.targetArrowhead ?? ''} options={options(ARROWHEAD_OPTIONS, t)}
                      onChange={(event) => update({ targetArrowhead: event.target.value === '' ? undefined : event.target.value as EdgeArrowhead })}
                    />
                  </div>
                )}
              />
            </PropertyRows>
            <div data-testid="route-section" className="inspector-section">
              <PanelSection title={t('section.route')}>
                <p className="inspector-note">
                  <span data-testid="route-badge">{badge}</span>{', '}
                  <span data-testid="route-bends">{bends}{route?.pinned ? ` · ${t('route.pinned')}` : ''}</span>.{' '}
                  {{ none: t('route.noteNone'), auto: t('route.noteAuto'), manual: t('route.noteManual') }[routeStatus]}
                </p>
                <PropertyRows readOnly={readOnly} onHelp={onHelp}>
                  <PropertyRow
                    label={t('field.routing')} data-testid="connection-routing" help={t('field.routingHelp')} value={said(ROUTING_OPTIONS, connection.routing, t)}
                    edit={{ options: options(ROUTING_OPTIONS, t) }}
                    onCommit={(value) => update({ routing: value === '' ? undefined : value as EdgeRouting })}
                  />
                  <PropertyRow
                    label={t('field.leavesFrom')} data-testid="route-leaves" value={said(ATTACH_SIDE_OPTIONS, route?.sourceSide, t)} readOnly={!onSetRouteSides}
                    edit={{ options: options(ATTACH_SIDE_OPTIONS, t) }}
                    onCommit={(value) => onSetRouteSides?.(connection.id, { sourceSide: value === '' ? undefined : value as AttachSide })}
                  />
                  <PropertyRow
                    label={t('field.arrivesAt')} data-testid="route-arrives" value={said(ATTACH_SIDE_OPTIONS, route?.targetSide, t)} readOnly={!onSetRouteSides}
                    edit={{ options: options(ATTACH_SIDE_OPTIONS, t) }}
                    onCommit={(value) => onSetRouteSides?.(connection.id, { targetSide: value === '' ? undefined : value as AttachSide })}
                  />
                </PropertyRows>
                {!readOnly && (
                  <div className="inspector-actions">
                    {routeStatus !== 'manual'
                      ? <Button size="small" onClick={() => actions.setRouteSource(connection.id, 'manual')}>{t('route.pin')}</Button>
                      : <Button size="small" onClick={() => actions.setRouteSource(connection.id, 'auto')}>{t('route.unpin')}</Button>}
                    {onResetRoute && <Button size="small" variant="quiet" onClick={() => onResetRoute(connection.id)}>{t('route.resetToAutomatic')}</Button>}
                  </div>
                )}
              </PanelSection>
            </div>
          </>
  );
}

function connectionRows({ connection, model, name, update, onOpenLanding, language, t }: {
  connection: DesignConnection;
  model: DesignModel;
  name(id: string): string;
  update(patch: Partial<Omit<DesignConnection, 'id'>>): void;
  onOpenLanding: ((connectionId: string) => void) | undefined;
  language: Language;
  t: Translate;
}): RowSpec[] {
    const always = (key: string, label: string, node: RowSpec['node']): RowSpec => ({ key, label, rule: 'always', filled: true, node });
    const held = (id: string) => model.elements.find((e) => e.id === id);
    // Only a flow is drawn on a canvas (ADR-0012 §5), so the line this panel is about is one.
    const isContainer = isContainerLine({ ...connection, type: 'flow' }, held);
    const candidates = isContainer ? candidateInterfaces(model.relations, connection, held) : [];
    const landedOn = connection.refines === undefined ? undefined : model.relations.find((c) => c.id === connection.refines);
    const partOf = (row: (typeof candidates)[number]) => (row.label
      ? t('field.partOfOption', { label: row.label, name: name(row.sourceId) })
      : t('field.partOfUnlabelled', { name: name(row.sourceId) }));
    // What landed on this one (ADR-0013): an interface with landings has no protocol of its own.
    const landings = refinementsOf(model.relations, connection.id);
    const protocols = protocolsOf(model.relations, connection.id);
    const textRow = (key: 'label' | 'protocol' | 'technology', label: string, help?: string, placeholder?: boolean, long?: boolean) => always(key, label, () => (
      <PropertyRow
        label={label} data-testid={`connection-${key}`} value={connection[key] ?? ''} empty={placeholder ? t('inspector.noLabel') : DASH}
        {...(help ? { help } : {})} edit={long ? 'long' : 'text'}
        onCommit={(value) => update({ [key]: value || undefined })}
      />
    ));
    return [
      always('from', t('field.source'), () => <PropertyRow label={t('inspector.from')} data-testid="connection-from" readOnly value={name(connection.sourceId)} />),
      always('to', t('field.target'), () => <PropertyRow label={t('inspector.to')} data-testid="connection-to" readOnly value={name(connection.targetId)} />),
      ...(isContainer ? [always('partOf', t('field.partOf'), () => (
        <PropertyRow
          label={t('field.partOf')} data-testid="connection-part-of" help={t('field.partOfHelp')}
          value={landedOn ? (landedOn.label ?? name(landedOn.sourceId)) : ''} empty={t('field.newInterface')}
          edit={pickEdit({
            label: t('field.partOf'),
            options: [
              ...candidates.map((row) => ({ id: row.id, label: partOf(row) })),
              { id: '', label: landedOn ? t('field.detachFrom', { label: landedOn.label ?? name(landedOn.sourceId) }) : t('field.newInterface') },
            ],
          })}
          onCommit={(id) => update({ refines: id || undefined })}
        />
      ))] : []),
      textRow('label', t('field.label'), t('field.labelHelp'), true, true),
      ...(landings.length > 0
        ? [always('detail', t('field.detail'), () => (
          <PropertyRow
            label={t('field.detail')} data-testid="connection-detail" readOnly
            value={t(landings.length === 1 ? 'field.detailOne' : 'field.detailOther', { count: String(landings.length), protocols: protocols.join(', ') })}
            {...(onOpenLanding ? { display: (
              <>
                {t(landings.length === 1 ? 'field.detailOne' : 'field.detailOther', { count: String(landings.length), protocols: protocols.join(', ') })}{' '}
                <PanelLink onPress={() => onOpenLanding(connection.id)}>{t('field.detailOpen')}</PanelLink>
              </>
            ) } : {})}
          />
        ))]
        : [textRow('protocol', t('field.protocol')), textRow('technology', t('field.technology'), t('field.technologyHelp'))]),
      // The days this line is there (ADR-0009). One with no window follows the elements it joins.
      always('valid', t('inspector.valid'), () => (
        <PropertyRow
          label={t('inspector.valid')} data-testid="connection-valid" field="validUntil" value={validWords(connection, language, t)}
          edit={(editor) => <ValidEditor editor={editor} connection={connection} onWrite={update} t={t} />}
        />
      )),
      always('direction', t('field.direction'), () => (
        <PropertyRow
          label={t('field.direction')} data-testid="connection-direction" help={t('field.directionHelp')}
          value={connection.isBidirectional ? t('field.bidirectional') : t('field.oneWay')}
          edit={{ options: [{ value: 'oneway', label: t('field.oneWay') }, { value: 'bidirectional', label: t('field.bidirectional') }] }}
          onCommit={(value) => update({ isBidirectional: value === 'bidirectional' })}
        />
      )),
      certaintyRow(t, 'panel', connection.certainty, false, (certainty) => update({ certainty })),
    ];
  }
