import Autocomplete from '@mui/material/Autocomplete';
import { placedNodes } from '../model/placement';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { EditorOwnership } from './props';
import type { DesignDiagram, DesignElement, DesignModel, ElementId, NodeIconSize, NodeShapeVariant } from '../model/types';
import type { MarkdownRenderOptions } from '../documentation/documentation';
import { aspectConfigFor, derivedPlatformAspect } from '../model/aspects';
import { hostingOf, mayBeHosted } from '../model/hosting';
import { describeLeverage, leverageOf } from '../model/leverage';
import { wouldCycle } from '../model/tree';
import type { LeverageLine } from '../model/leverage';
import { PLATFORM_ARCHETYPES, PLATFORM_ARCHETYPE_LABEL, platformArchetypeOf } from '../model/relations';
import type { PlatformArchetype } from '../model/types';
import { LogoGrid } from './nodes/LogoGrid';
import { zoneLabel } from '../model/zones';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/strings';
import { fieldEdit } from '../model/commands';
import type { EditorActions } from './useEditorState';
import { AspectsEditor } from './AspectsEditor';
import { ColorField } from './ColorField';
import { InspectorSection } from './InspectorSection';
import { MarkdownField } from '../documentation/ui/MarkdownField';
import { ElementRecord, recordSummary } from './ElementRecord';

const LIFECYCLES: DesignElement['lifecycle'][] = ['planned', 'live', 'retiring', 'retired'];

/**
 * Shape-variant options (U6a). The empty option writes `undefined` → NULL →
 * inherit each kind's current shape, exactly like the connection style controls'
 * "default" choice. No explicit default token is ever stored.
 */
const SHAPE_VARIANT_OPTIONS: { value: NodeShapeVariant | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'option.default' },
  { value: 'rounded', labelKey: 'option.rounded' },
  { value: 'sharp', labelKey: 'option.sharp' },
  { value: 'subtle', labelKey: 'option.subtle' },
];

/**
 * Icon size (Phase 3). The empty option writes `undefined` → NULL → the header
 * mark every node has always drawn, so an element that never touched this reads
 * exactly as before.
 */
const ICON_SIZE_OPTIONS: { value: NodeIconSize | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'option.iconSmall' },
  { value: 'large', labelKey: 'option.iconLarge' },
];

/**
 * Shape options for a kind. Actors add the D11 Box↔Stickman choice (`figure`);
 * every other kind keeps rounded/sharp/subtle and never sees `figure`.
 */
export function shapeOptionsFor(
  kind: DesignElement['kind'],
): { value: NodeShapeVariant | ''; labelKey: StringKey }[] {
  return kind === 'actor'
    ? [...SHAPE_VARIANT_OPTIONS, { value: 'figure' as const, labelKey: 'option.stickman' as const }]
    : SHAPE_VARIANT_OPTIONS;
}

/** The one table lives in the model; re-exported so this file's callers keep one import. */
import { kindLabel } from '../model/kinds';
export { kindLabel };

export interface ElementInspectorProps {
  element: DesignElement;
  model: DesignModel;
  diagram: DesignDiagram;
  readOnly: boolean;
  actions: EditorActions;
  onRequestDelete(): void;
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode;
  /**
   * Opens the host's logo-upload flow. Absent = the icon picker shows no upload
   * tile, which is the correct state for a host with no library to add to.
   */
  onRequestLogoUpload?(): void;
  /**
   * "Rename" (node menu, F2): focus the Name field and select its text. Keyed
   * by element id so a request for another element is ignored, and handled
   * once per nonce so a re-render never steals focus back.
   */
  renameRequest?: { id: string; nonce: number };
  /**
   * Opens the documentation page for this element. Absent = no expand button
   * beside the description, which is the state inside the page itself.
   */
  onOpenDocumentation?(elementId: ElementId): void;
  /**
   * Start a replacement of this element (ADR-0010): the host opens its dialog.
   * Absent = no Replace… button, which is read-only mode and a host with no
   * plans.
   */
  onReplace?(elementId: ElementId): void;
  /** The page shows the description as the page; it must not show it twice. */
  hideDescription?: boolean;
  /**
   * `tabs` (default) is the panel beside the canvas, where width is scarce.
   * `stacked` lays the three tabs out one under the other, for the
   * documentation page, where it is height that is plentiful.
   */
  layout?: 'tabs' | 'stacked';
  /**
   * Another scope answers for this record (ADR-0012 §10): a stand-in, drawn
   * here and defined there.
   *
   * The fields it names are shown read-only with a line saying where they are
   * answered for and a way to go there. Which fields those are is handed in
   * rather than known here — the editor may not know a scope tree exists, and
   * a list kept in two places is a field greyed out on this panel that an
   * agent is allowed to write.
   *
   * Absent is the ordinary case and means this scope answers for everything.
   */
  owned?: {
    /** What to call the owning scope: its path, or the word for the organisation. */
    label: string;
    fields: readonly string[];
    /** Open it. Absent where the host cannot — a test, or a page with nowhere to go. */
    onOpen?(): void;
    /**
     * The owner's description, shown in place of this record's own when
     * `fields` names `description`: maintained where the thing is defined,
     * read here. Absent while the owner has not been read, or has none.
     */
    description?: string;
  };
  /**
   * Ask to move this record to another scope (ADR-0012 §10).
   *
   * A button and a word for it, and nothing else: which gestures are on offer
   * and what each would write are the host's, because a panel that knew would
   * know what a scope tree is. Absent where there is nothing to offer.
   */
  move?: {
    label: string;
    tip: string;
    onMove(): void;
  };
  /**
   * For a platform service: who uses it from outside the team that maintains
   * it, by name (ADR-0014) — the derived answer the *Shared* tick shows beside
   * itself where nobody has ticked. Absent where the host has no tree to read.
   */
  offeredBeyond?: readonly string[];
  /** The technology the rest of the organisation defines, for *Hosted on* (ADR-0017). */
  technology?: EditorOwnership['technology'];
  /**
   * Make this application's container diagram. Offered as a button on the
   * General tab of an application that has none, because a view is made on
   * purpose: a double-click on the card only OPENS one (`doubleClick.ts`),
   * and a card with nothing inside gives no hint — this button is the hint.
   * Absent where the host cannot, and under `readOnly`.
   */
  onCreateContainer?(elementId: ElementId): void;
  /**
   * For an application or a container: what it leverages, as the host works
   * it out over the whole tree (ADR-0014). Absent = read off this scope's own
   * rows, which is the answer a shell with no tree can give.
   */
  leverage?: LeverageLine;
}

/** Tab label with an optional "set values" dot (mirrors the InspectorSection "●" badge). */
function TabLabel({ text, dot }: { text: string; dot: boolean }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      {text}
      {dot && (
        <Box component="span" aria-hidden sx={{ fontSize: 9, lineHeight: 1, color: 'primary.main' }}>
          ●
        </Box>
      )}
    </Box>
  );
}

/**
 * Element property form (U7a): a tabbed inspector — General / Appearance / Data.
 * The header (kind + Name) and the Delete action stay outside the tabs, always
 * visible. Tab selection is per-selection in-memory state and resets to General
 * when the selected element id changes.
 *
 * **Two layouts, and the record is what differs.** Beside the canvas (`tabs`)
 * the panel holds what a person sets while drawing — name, category, phase,
 * the short description, the placement — and the owner's detail (vendor,
 * owner, dates, successor, whose it is) is one line and a way to the page.
 * On the page (`stacked`) the record is laid out in full above the rest
 * (`ElementRecord.tsx` says why it moved). The fields are the same fields
 * and reach the model the same way; only where they are typed differs.
 */
export function ElementInspector(props: ElementInspectorProps) {
  const { element, readOnly, actions } = props;
  const { t } = useStrings();
  /**
   * Is this field the owning scope's to answer for? A stand-in's caches and
   * the owner's detail both come through `owned.fields`, so this panel greys
   * out exactly what a write from anywhere else would be refused.
   */
  const owned = (field: string) => props.owned?.fields.includes(field) ?? false;
  const update = (patch: Partial<Omit<DesignElement, 'id' | 'kind'>>) =>
    actions.updateElement(element.id, patch);
  /**
   * A text field: every keystroke reaches the model — the card on the canvas is
   * drawn from it — but the run of them is one undo step (see `fieldEdit`).
   */
  const typed = (field: string, patch: Partial<Omit<DesignElement, 'id' | 'kind'>>) =>
    actions.updateElement(element.id, patch, fieldEdit(element.id, field));

  // Reset to the first tab whenever the selected element changes (the tabbed
  // equivalent of the old `key={element.id}` section-default remount).
  const [activeTab, setActiveTab] = useState(0);
  const [seenId, setSeenId] = useState(element.id);
  if (seenId !== element.id) {
    setSeenId(element.id);
    setActiveTab(0);
  }

  const nameRef = useRef<HTMLInputElement>(null);
  const { renameRequest } = props;
  const handledRenameNonce = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!renameRequest || renameRequest.id !== element.id) return;
    if (handledRenameNonce.current === renameRequest.nonce) return;
    handledRenameNonce.current = renameRequest.nonce;
    if (readOnly) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [renameRequest, element.id, readOnly]);

  const placement = placedNodes(props.diagram).find((p) => p.id === element.id);
  const isLayer7Landscape = props.diagram.kind === 'layer7' && placement?.zone === 'landscape';
  const isLayer7Placement = Boolean(placement) && props.diagram.kind === 'layer7';
  // Names, not ids: this field is what a person types, and the action resolves
  // a name to the group it belongs to (ADR-0012 §6).
  const groups = props.diagram.groups ?? [];
  const knownGroups = groups.map((group) => group.name);
  const groupName = groups.find((group) => group.id === placement?.group)?.name ?? '';
  const aspectConfig = aspectConfigFor(props.diagram);
  const knownCategories = [
    ...new Set(props.model.elements.map((e) => e.category).filter((c): c is string => Boolean(c))),
  ];
  const isBoundaryApp =
    props.diagram.kind === 'container' && props.diagram.applicationElementId === element.id;
  // A definition this scope draws the inside of, with no inside drawn yet. A
  // stand-in's inside is the owning scope's business (ADR-0012 §3).
  const offerContainer = Boolean(props.onCreateContainer)
    && !readOnly
    && element.kind === 'application'
    && element.ref === undefined
    && !props.model.diagrams.some((d) => d.kind === 'container' && d.applicationElementId === element.id);

  const setAspectCount = aspectConfig.filter((entry) => element.aspects[entry.key]).length;
  // What the rows say about the platform where nobody typed it (ADR-0013),
  // said beside the editor rather than put into it: the field stays empty,
  // which is what makes the derived answer the one shown.
  const derivedPlatform = aspectConfig.some((entry) => entry.key === 'platform')
    ? derivedPlatformAspect(element, props.model)
    : undefined;
  // Where it runs, and what it could run on (ADR-0013, redone). The platforms
  // this scope holds, definitions and stand-ins both: a shared cluster is
  // drawn here and defined in the platform scope. The places first (ADR-0014):
  // a container sits in a namespace or on a machine, and a broker is offered
  // after them rather than refused, because binding to one is legal.
  const isPlace = (held: DesignElement) => platformArchetypeOf(held) === 'place';
  const platforms = props.model.elements
    .filter((held) => held.kind === 'platform')
    .sort((a, b) => Number(isPlace(b)) - Number(isPlace(a)));
  // And the platforms the rest of the organisation defines (ADR-0017), the
  // places first likewise, so a container can be hosted on a cloud its
  // landscape has never drawn; choosing one writes the stand-in.
  const heldIds = new Set(props.model.elements.map((held) => held.id));
  const platformsElsewhere = (props.technology?.elsewhere ?? [])
    .filter((one) => one.kind === 'platform' && !heldIds.has(one.id))
    .sort((a, b) => Number(b.place) - Number(a.place));
  const hosting = hostingOf(props.model, element.id);
  const nameOfPlatform = (id: ElementId) => props.model.elements.find((held) => held.id === id)?.name ?? id;
  // What it leverages (ADR-0014): the services it uses and the platforms
  // behind them, derived and never typed here. The host's answer where it has
  // a tree to read, this scope's own rows otherwise.
  const leverage = element.kind === 'application' || element.kind === 'component'
    ? props.leverage ?? describeLeverage(
      leverageOf(props.model, element.id),
      (id) => props.model.elements.find((held) => held.id === id)?.name,
    )
    : undefined;
  // The technology layer's own controls (ADR-0014 §2.8). What a platform or
  // a service sits in is the same kind's tree, over this scope's own records
  // — a stand-in sits on the owner's tree and is not offered one here — with
  // a loop shown and refused rather than hidden, as the sheet's inspector
  // does. What a platform realises, and who maintains either, are rows.
  const isTechnology = element.kind === 'platform' || element.kind === 'platformService';
  const kin = isTechnology
    ? props.model.elements.filter((held) => held.kind === element.kind && held.id !== element.id && held.ref === undefined)
    : [];
  const services = props.model.elements.filter((held) => held.kind === 'platformService');
  const realised = props.model.relations
    .filter((row) => row.type === 'realises' && row.sourceId === element.id)
    .map((row) => services.find((held) => held.id === row.targetId))
    .filter((held): held is DesignElement => held !== undefined);
  const actors = props.model.elements.filter((held) => held.kind === 'actor');
  const maintainer = props.model.relations.find((row) => row.type === 'assigned' && row.targetId === element.id)?.sourceId ?? '';
  const leverageText = leverage === undefined ? '' : [
    ...leverage.services.map((one) => `${one.platforms.length
      ? `${one.name} (${one.platforms.map((platform) => platform.name).join(', ')})`
      : one.name}${one.implied ? ` ${t('field.leveragesImplied')}` : ''}`),
    ...leverage.platforms.map((one) => one.name),
  ].join(' · ');
  const showAspects = element.kind === 'application';

  const generalHasValues = Boolean(
    element.description || element.category || element.isManaged || placement?.group,
  );
  const summary = recordSummary(element, props.model, t);
  const appearanceHasValues = Boolean(
    element.accentColor || element.shapeVariant || element.iconKey || element.iconSize,
  );
  const dataHasValues = setAspectCount > 0;

  const stacked = props.layout === 'stacked';
  const show = (tab: number) => stacked || activeTab === tab;
  const sectionTitle = (text: string) =>
    stacked ? (
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {text}
      </Typography>
    ) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="overline" color="text.secondary">
            {kindLabel(element.kind, t)}
          </Typography>
          {/* The way to the page, beside the kind rather than in the record
              strip below: it is about the whole thing, and a link among the
              facts read as one of them. Only beside the canvas — on the page
              itself there is nowhere further to go. */}
          {!stacked && props.onOpenDocumentation && (
            <Button
              size="small"
              data-testid="open-details"
              sx={{ fontSize: 11, minWidth: 0, px: 0.5, py: 0, whiteSpace: 'nowrap', textTransform: 'none' }}
              onClick={() => props.onOpenDocumentation?.(element.id)}
            >
              {t('record.open')} ›
            </Button>
          )}
        </Box>
        <TextField
          label={t('field.name')}
          value={element.name}
          fullWidth
          disabled={readOnly || owned('name')}
          inputRef={nameRef}
          onChange={(e) => typed('name', { name: e.target.value })}
        />
      </Box>

      {/* Drawn here, defined there (ADR-0012 §3). Above the tabs, because it
          is about the whole record rather than about one of its groups, and
          because everything below it that is greyed out is greyed out for
          this reason. */}
      {props.owned && (
        <Box
          data-testid="owned-elsewhere"
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
            px: 1, py: 0.75, borderRadius: 1, bgcolor: 'action.hover',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {t('standIn.definedIn', { scope: props.owned.label })}
          </Typography>
          {props.owned.onOpen && (
            <Button size="small" onClick={props.owned.onOpen}>
              {t('standIn.open', { scope: props.owned.label })}
            </Button>
          )}
        </Box>
      )}

      {/* Where this record is answered for, when it is answered for here and
          could be somewhere else (ADR-0012 §10). Beside the stand-in strip
          rather than inside it: the strip is about a record this scope does
          not own, and this is about one it does. */}
      {!readOnly && props.move && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Tooltip title={props.move.tip}>
            <Button
              size="small"
              color="inherit"
              data-testid="move-record"
              sx={{ fontSize: 11, minWidth: 0, px: 1 }}
              onClick={props.move.onMove}
            >
              {props.move.label}
            </Button>
          </Tooltip>
        </Box>
      )}

      {/* The record, as the panel beside the canvas shows it: one line and a
          way to the page, where the fields are. Outside the tabs because it
          is about the whole record, like the name above it. */}
      {!stacked && (
        <Box
          data-testid="record-summary"
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 1, py: 0.75, borderRadius: 1, bgcolor: 'action.hover',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
            {summary.length ? summary.join(' · ') : t('record.empty')}
          </Typography>
        </Box>
      )}

      {stacked && sectionTitle(t('record.title'))}
      {stacked && (
        <ElementRecord
          element={element}
          model={props.model}
          readOnly={readOnly}
          actions={actions}
          owned={owned}
          onReplace={props.onReplace}
        />
      )}

      {!stacked && <Tabs
        value={activeTab}
        onChange={(_e, value: number) => setActiveTab(value)}
        variant="fullWidth"
        sx={{ minHeight: 40, mb: 0.5, '& .MuiTab-root': { minHeight: 40, py: 0.5, minWidth: 0 } }}
      >
        <Tab label={<TabLabel text={t('tab.general')} dot={generalHasValues} />} />
        <Tab label={<TabLabel text={t('tab.appearance')} dot={appearanceHasValues} />} />
        <Tab label={<TabLabel text={t('tab.data')} dot={dataHasValues} />} />
      </Tabs>}

      {sectionTitle(t('tab.general'))}
      {show(0) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* What it is (ADR-0014): a place, a service or a network. A
              service when unsaid, which is what the select shows — a wrong
              place draws a box nobody asked for, a wrong service draws
              nothing. */}
          {element.kind === 'platform' && (
            <TextField
              select
              label={t('field.platformArchetype')}
              value={platformArchetypeOf(element)}
              disabled={readOnly || owned('platformArchetype')}
              helperText={t('field.platformArchetypeHelp')}
              onChange={(e) => update({ platformArchetype: e.target.value as PlatformArchetype })}
            >
              {PLATFORM_ARCHETYPES.map((archetype) => (
                <MenuItem key={archetype} value={archetype}>{t(PLATFORM_ARCHETYPE_LABEL[archetype])}</MenuItem>
              ))}
            </TextField>
          )}

          {/* Offered for use beyond the team that maintains it (ADR-0014).
              Explicit, because organisations draw this line differently; and
              where nobody has ticked, the rows still say — shown beside the
              tick as a sentence, never written into the field, so a value
              somebody typed wins and is left as typed. */}
          {element.kind === 'platformService' && (
            <Box data-testid="service-shared">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={element.shared === true}
                    disabled={readOnly || owned('shared')}
                    onChange={(e) => update({ shared: e.target.checked ? true : undefined })}
                  />
                }
                label={<Typography variant="caption">{t('field.shared')}</Typography>}
              />
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }} data-testid="service-shared-derived">
                {element.shared
                  ? t('field.sharedHelp')
                  : props.offeredBeyond === undefined
                    ? t('field.sharedHelp')
                    : props.offeredBeyond.length > 0
                      ? t('field.sharedDerived', { names: props.offeredBeyond.join(', ') })
                      : t('field.sharedWithin')}
              </Typography>
            </Box>
          )}

          {isTechnology && element.ref === undefined && (
            <TextField
              select
              fullWidth
              label={t('field.partOf')}
              value={element.parentId ?? ''}
              disabled={readOnly || owned('parentId')}
              slotProps={{ htmlInput: { 'data-testid': 'element-part-of' } }}
              onChange={(e) => update({ parentId: e.target.value === '' ? undefined : e.target.value })}
            >
              <MenuItem value="">{t('field.partOfNothing')}</MenuItem>
              {kin.map((candidate) => {
                const loops = wouldCycle(props.model.elements, element.id, candidate.id);
                return (
                  <MenuItem key={candidate.id} value={candidate.id} disabled={loops}>
                    {candidate.name}
                    {loops && (
                      <Typography component="span" sx={{ fontSize: 10, color: 'text.secondary', ml: 1 }}>
                        {t('field.parentCycle')}
                      </Typography>
                    )}
                  </MenuItem>
                );
              })}
            </TextField>
          )}

          {element.kind === 'platform' && services.length > 0 && (
            <Autocomplete
              multiple
              options={services}
              getOptionLabel={(held) => held.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={realised}
              disabled={readOnly}
              onChange={(_e, value) => actions.setRealises(element.id, value.map((held) => held.id))}
              renderInput={(params) => (
                <TextField {...params} label={t('field.realises')} helperText={t('field.realisesHelp')} />
              )}
              data-testid="element-realises"
            />
          )}

          {isTechnology && actors.length > 0 && (
            <TextField
              select
              fullWidth
              label={t('field.maintainedBy')}
              value={maintainer}
              disabled={readOnly}
              slotProps={{ htmlInput: { 'data-testid': 'element-maintained-by' } }}
              onChange={(e) => actions.setMaintainedBy(element.id, e.target.value || undefined)}
            >
              <MenuItem value="">{t('field.maintainedByNone')}</MenuItem>
              {actors.map((actor) => (
                <MenuItem key={actor.id} value={actor.id}>{actor.name}</MenuItem>
              ))}
            </TextField>
          )}

          {/* Where it runs (ADR-0013, redone). A container says it; an
              application with containers is told what they say, because it is
              not deployed anywhere itself; one with no containers — an outside
              system, a SaaS service, a bought package — says it too, which is
              the only sentence anybody can write about it. */}
          {(element.kind === 'component' || element.kind === 'application') && (platforms.length > 0 || platformsElsewhere.length > 0) && (
            mayBeHosted(props.model.elements, element.id) ? (
              <Box>
                <TextField
                  select
                  fullWidth
                  label={t('field.hostedOn')}
                  value={hosting.platformIds[0] ?? ''}
                  disabled={readOnly || owned('hostedOn')}
                  helperText={hosting.platformIds.length > 1
                    ? t('field.hostedOnSeveral', { count: String(hosting.platformIds.length - 1) })
                    : t('field.hostedOnHelp')}
                  onChange={(e) => {
                    const chosen = e.target.value || undefined;
                    const standIn = chosen !== undefined && !heldIds.has(chosen) ? props.technology?.standInFor(chosen) : undefined;
                    if (standIn) actions.setHostedOn(element.id, chosen, standIn);
                    else actions.setHostedOn(element.id, chosen);
                  }}
                  inputProps={{ 'data-testid': 'hosted-on' }}
                >
                  <MenuItem value="">{t('common.none')}</MenuItem>
                  {platforms.map((platform) => (
                    <MenuItem key={platform.id} value={platform.id}>{platform.name}</MenuItem>
                  ))}
                  {platformsElsewhere.length > 0 && <ListSubheader>{t('field.hostedOnElsewhere')}</ListSubheader>}
                  {platformsElsewhere.map((platform) => (
                    <MenuItem key={platform.id} value={platform.id} data-testid={`hosted-on-elsewhere-${platform.id}`}>
                      {platform.name}
                      <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>{platform.where}</Typography>
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            ) : (
              <Box data-testid="element-runs-on">
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('field.runsOn')}</Typography>
                <Typography sx={{ fontSize: 13 }}>
                  {hosting.platformIds.length === 0
                    ? t('field.runsOnNothing')
                    : t('field.runsOnContainers', {
                      names: hosting.platformIds.map((id) => nameOfPlatform(id)).join(', '),
                      count: String(hosting.containers),
                    })}
                </Typography>
              </Box>
            )
          )}

          {/* Read only, and derived (ADR-0014): the consumer says which
              service it uses, the platform team says what realises it, and
              nobody types the platform on the application. */}
          {leverage !== undefined && leverageText !== '' && (
            <Box data-testid="element-leverages">
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('field.leverages')}</Typography>
              <Typography sx={{ fontSize: 13 }}>{leverageText}</Typography>
            </Box>
          )}

          {element.kind === 'application' && (
            <Autocomplete
              freeSolo
              options={knownCategories}
              value={element.category ?? ''}
              disabled={readOnly || owned('category')}
              onInputChange={(_e, value) => update({ category: value || undefined })}
              renderInput={(params) => <TextField {...params} label={t('field.category')} />}
            />
          )}

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              select
              label={t('field.lifecycle')}
              value={element.lifecycle}
              sx={{ flex: 1 }}
              disabled={readOnly || owned('lifecycle')}
              onChange={(e) => update({ lifecycle: e.target.value as DesignElement['lifecycle'] })}
            >
              {LIFECYCLES.map((lifecycle) => (
                <MenuItem key={lifecycle} value={lifecycle}>
                  {t(`lifecycle.${lifecycle}` as StringKey)}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={element.isManaged}
                  disabled={readOnly || owned('isManaged')}
                  onChange={(e) => update({ isManaged: e.target.checked })}
                />
              }
              label={<Typography variant="caption">{t('field.managed')}</Typography>}
            />
          </Box>

          {!props.hideDescription && (
            <MarkdownField
              value={(owned('description') ? props.owned?.description : element.description) ?? ''}
              disabled={readOnly || owned('description')}
              onChange={(value) => typed('description', { description: value || undefined })}
              renderMarkdown={props.renderMarkdown}
              onOpenDocumentation={
                props.onOpenDocumentation ? () => props.onOpenDocumentation?.(element.id) : undefined
              }
            />
          )}

          {isLayer7Placement && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {t('field.placement')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('field.zone', { name: placement?.zone ? zoneLabel(placement.zone, t) : '—' })}
              </Typography>
              {isLayer7Landscape && (
                <Autocomplete
                  freeSolo
                  options={knownGroups}
                  value={groupName}
                  disabled={readOnly}
                  onInputChange={(_e, value) =>
                    actions.fileUnderGroupNamed([element.id], value || undefined)
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('field.domainGroup')}
                      placeholder={t('field.domainGroupPlaceholder')}
                      sx={{ mt: 1 }}
                    />
                  )}
                />
              )}
            </Box>
          )}

          {offerContainer && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {t('field.noContainer')}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => props.onCreateContainer?.(element.id)}
              >
                {t('menu.createContainer')}
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Appearance is how this scope DRAWS the thing — a colour, a shape, a
          mark on a card — and stays beside the canvas, where the card is. The
          page is about what the thing is, and a colour picker on it would be
          a control for a drawing you cannot see. */}
      {!stacked && show(1) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <ColorField
            label={t('field.accentColour')}
            ariaLabel={t('field.accentColour')}
            value={element.accentColor}
            readOnly={readOnly}
            onChange={(value) => update({ accentColor: value })}
          />

          <TextField
            select
            label={t('field.shape')}
            value={element.shapeVariant ?? ''}
            fullWidth
            size="small"
            disabled={readOnly}
            onChange={(e) =>
              update({
                shapeVariant: e.target.value === '' ? undefined : (e.target.value as NodeShapeVariant),
              })
            }
          >
            {shapeOptionsFor(element.kind).map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {t(o.labelKey)}
              </MenuItem>
            ))}
          </TextField>

          {/* Icon picker (Phase 3): EVERY kind carries a mark now — the vendor
              gate that used to sit here was about the `vendor` text field, not
              about whether an actor or an input channel can have an icon, and
              conflating the two left four of the seven node kinds unable to
              show one. The None tile writes `undefined` → NULL → no logo. */}
          <LogoGrid
            label={t('field.icon')}
            value={element.iconKey}
            disabled={readOnly}
            onChange={(iconKey) => update({ iconKey })}
            onRequestUpload={props.onRequestLogoUpload}
            maxHeight={220}
          />

          {/* Size sits next to the picker rather than in the grid: it is a
              property of how this element draws, like Shape, and it applies
              whether the mark came from the library or from an upload. */}
          <TextField
            select
            label={t('field.iconSize')}
            value={element.iconSize ?? ''}
            fullWidth
            size="small"
            disabled={readOnly || !element.iconKey}
            helperText={element.iconKey ? undefined : t('field.iconFirst')}
            onChange={(e) =>
              update({
                iconSize: e.target.value === '' ? undefined : (e.target.value as NodeIconSize),
              })
            }
          >
            {ICON_SIZE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {t(o.labelKey)}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      )}

      {sectionTitle(t('tab.data'))}
      {show(2) && (
        /* key per element: Data-tab section open/closed defaults recompute on selection change */
        <Box key={element.id} sx={{ display: 'flex', flexDirection: 'column' }}>
          {showAspects && (
            <InspectorSection
              title={t('section.operationalAspects')}
              badge={`${setAspectCount}/${aspectConfig.length}`}
              defaultOpen
            >
              <AspectsEditor
                aspects={element.aspects}
                config={aspectConfig}
                disabled={readOnly}
                onChange={(aspects) => update({ aspects })}
              />
              {derivedPlatform && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 1 }} data-testid="derived-platform">
                  {derivedPlatform.status === 'none'
                    ? t('aspect.derivedNone')
                    : t('aspect.derivedFrom', { status: t(`aspect.${derivedPlatform.status}` as StringKey), name: derivedPlatform.note })}
                </Typography>
              )}
            </InspectorSection>
          )}

          {!showAspects && (
            <Typography variant="caption" color="text.secondary" sx={{ pt: 1 }}>
              {t('element.noData')}
            </Typography>
          )}
        </Box>
      )}

      {!readOnly && (
        <>
          <Divider />
          <Button color="error" variant="outlined" size="small" onClick={props.onRequestDelete}>
            {isBoundaryApp ? t('element.deleteApplication') : t('element.removeDelete')}
          </Button>
        </>
      )}
    </Box>
  );
}
