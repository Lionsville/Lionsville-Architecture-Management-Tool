import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  DesignDiagram,
  DesignElement,
  DesignModel,
  ElementId,
  MarkdownRenderOptions,
  NodeIconSize,
  NodeShapeVariant,
  ParameterSpec,
} from '../types';
import { aspectConfigFor } from '../model/aspects';
import { LogoGrid } from '../nodes/LogoGrid';
import { zoneLabel } from '../model/zones';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey, Translate } from '../i18n/strings';
import type { EditorActions } from './useEditorState';
import { AspectsEditor } from './AspectsEditor';
import { ColorField } from './ColorField';
import { InspectorSection } from './InspectorSection';
import { MarkdownField } from './MarkdownField';
import { ParametersEditor } from './ParametersEditor';

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

const KIND_LABEL_KEYS: Record<DesignElement['kind'], StringKey> = {
  actor: 'kind.actor',
  application: 'kind.application',
  externalSystem: 'kind.externalSystem',
  inputChannel: 'kind.inputChannel',
  managementTool: 'kind.managementTool',
  component: 'kind.component',
};

/** An element kind's name, in the given language (English when none is given). */
export function kindLabel(kind: DesignElement['kind'], translate: Translate): string {
  return translate(KIND_LABEL_KEYS[kind]);
}

export interface ElementInspectorProps {
  element: DesignElement;
  model: DesignModel;
  diagram: DesignDiagram;
  readOnly: boolean;
  parameterSpecs: ParameterSpec[];
  actions: EditorActions;
  onRequestDelete(): void;
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode;
  extras?: ReactNode;
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
  /** The page shows the description as the page; it must not show it twice. */
  hideDescription?: boolean;
  /**
   * `tabs` (default) is the panel beside the canvas, where width is scarce.
   * `stacked` lays the three tabs out one under the other, for the
   * documentation page, where it is height that is plentiful.
   */
  layout?: 'tabs' | 'stacked';
}

function showVendor(kind: DesignElement['kind']): boolean {
  return kind === 'application' || kind === 'managementTool' || kind === 'externalSystem';
}

function showTechnology(kind: DesignElement['kind']): boolean {
  return kind === 'application' || kind === 'component';
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
 * visible. Nothing persisted was dropped from the iteration-3 accordion; the
 * concerns were regrouped: identity/status/prose + layer7 placement in General,
 * the U6 colour/shape/logo controls in Appearance, and aspects/parameters plus
 * the host `extras` slot in Data. Tab selection is per-selection in-memory state
 * and resets to General when the selected element id changes.
 */
export function ElementInspector(props: ElementInspectorProps) {
  const { element, readOnly, actions } = props;
  const { t } = useStrings();
  const update = (patch: Partial<Omit<DesignElement, 'id' | 'kind'>>) =>
    actions.updateElement(element.id, patch);

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

  const placement = props.diagram.placements.find((p) => p.elementId === element.id);
  const isLayer7Landscape = props.diagram.kind === 'layer7' && placement?.zone === 'landscape';
  const isLayer7Placement = Boolean(placement) && props.diagram.kind === 'layer7';
  const knownGroups = (props.diagram.layoutConfig?.domainGroups ?? []).map((g) => g.name);
  const aspectConfig = aspectConfigFor(props.diagram);
  const knownCategories = [
    ...new Set(props.model.elements.map((e) => e.category).filter((c): c is string => Boolean(c))),
  ];
  const isBoundaryApp =
    props.diagram.kind === 'container' && props.diagram.applicationElementId === element.id;

  const setAspectCount = aspectConfig.filter((entry) => element.aspects[entry.key]).length;
  const setParameterCount = props.parameterSpecs.filter(
    (spec) => element.parameters[spec.key] !== undefined && element.parameters[spec.key] !== '',
  ).length;

  const showAspects = element.kind === 'application';
  const showParameters = props.parameterSpecs.length > 0;

  const generalHasValues = Boolean(
    element.description ||
      element.vendor ||
      element.technology ||
      element.category ||
      element.isManaged ||
      placement?.domainGroup,
  );
  const appearanceHasValues = Boolean(
    element.accentColor || element.shapeVariant || element.iconKey || element.iconSize,
  );
  const dataHasValues = setAspectCount > 0 || setParameterCount > 0;

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
        <Typography variant="overline" color="text.secondary">
          {kindLabel(element.kind, t)}
        </Typography>
        <TextField
          label={t('field.name')}
          value={element.name}
          fullWidth
          disabled={readOnly}
          inputRef={nameRef}
          onChange={(e) => update({ name: e.target.value })}
        />
      </Box>

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
          {element.kind === 'application' && (
            <Autocomplete
              freeSolo
              options={knownCategories}
              value={element.category ?? ''}
              disabled={readOnly}
              onInputChange={(_e, value) => update({ category: value || undefined })}
              renderInput={(params) => <TextField {...params} label={t('field.category')} />}
            />
          )}

          {showVendor(element.kind) && (
            <TextField
              label={t('field.vendor')}
              value={element.vendor ?? ''}
              fullWidth
              disabled={readOnly}
              onChange={(e) => update({ vendor: e.target.value || undefined })}
            />
          )}

          {showTechnology(element.kind) && (
            <TextField
              label={t('field.technology')}
              value={element.technology ?? ''}
              fullWidth
              disabled={readOnly}
              onChange={(e) => update({ technology: e.target.value || undefined })}
            />
          )}

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              select
              label={t('field.lifecycle')}
              value={element.lifecycle}
              sx={{ flex: 1 }}
              disabled={readOnly}
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
                  disabled={readOnly}
                  onChange={(e) => update({ isManaged: e.target.checked })}
                />
              }
              label={<Typography variant="caption">{t('field.managed')}</Typography>}
            />
          </Box>

          {!props.hideDescription && (
            <MarkdownField
              value={element.description ?? ''}
              disabled={readOnly}
              onChange={(value) => update({ description: value || undefined })}
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
                  value={placement?.domainGroup ?? ''}
                  disabled={readOnly}
                  onInputChange={(_e, value) =>
                    actions.setDomainGroup(element.id, value || undefined)
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
        </Box>
      )}

      {sectionTitle(t('tab.appearance'))}
      {show(1) && (
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
            </InspectorSection>
          )}

          {showParameters && (
            <InspectorSection
              title={t('section.parameters')}
              badge={`${setParameterCount}/${props.parameterSpecs.length}`}
              defaultOpen
            >
              <ParametersEditor
                specs={props.parameterSpecs}
                parameters={element.parameters}
                disabled={readOnly}
                onChange={(parameters) => update({ parameters })}
              />
            </InspectorSection>
          )}

          {props.extras}

          {!showAspects && !showParameters && !props.extras && (
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
