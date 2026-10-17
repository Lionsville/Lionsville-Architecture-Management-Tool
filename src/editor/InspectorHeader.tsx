// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The element inspector above its tabs: the kind and the name, and the three
 * strips that are about the whole record rather than one of its groups —
 * where it is defined, where it could move, and its record in one line. Where
 * a unit leads the inspector, the moves on the whole record are a *⋯* menu
 * beside the name instead (`ElementMore`).
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { DesignElement, DesignModel, ElementId } from '../model/types';
import { kindLabel } from '../model/kinds';
import { useStrings } from '../i18n/LanguageContext';
import { recordSummary } from './ElementRecord';
import type { InspectorField } from './elementInspectorFacts';
import type { ElementInspectorProps } from './ElementInspectorProps';
import type { AnsweredBy, PartyElsewhere } from './props';
import { usePersonNames } from '../people/ui/names';

const STRIP = { px: 1, py: 0.75, borderRadius: 1, bgcolor: 'action.hover' } as const;

/** The kind, the way to the page beside it, and the name — with `more` beside it where there is one. */
export function InspectorHeader({ field, stacked, nameRef, onOpenDocumentation, more }: {
  field: InspectorField;
  stacked: boolean;
  nameRef: RefObject<HTMLInputElement | null>;
  onOpenDocumentation?(elementId: ElementId): void;
  more?: ReactNode;
}) {
  const { t } = useStrings();
  const { element } = field;
  const name = (
    <TextField
      label={t('field.name')}
      value={element.name}
      fullWidth
      disabled={field.readOnly || field.owned('name')}
      inputRef={nameRef}
      onChange={(e) => field.typed('name', { name: e.target.value })}
    />
  );
  return (
    <Box sx={{ pb: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="overline" color="text.secondary">
          {kindLabel(element.kind, t)}
        </Typography>
        {/* The way to the page, beside the kind rather than in the record
            strip below: it is about the whole thing, and a link among the
            facts read as one of them. Only beside the canvas — on the page
            itself there is nowhere further to go. */}
        {!stacked && onOpenDocumentation && (
          <Tooltip title={t('record.openTip')}>
            {/* A span takes the tooltip's label, so the button's name stays its own text. */}
            <span>
              <Button
                size="small"
                data-testid="open-details"
                sx={{ fontSize: 11, minWidth: 0, px: 0.5, py: 0, whiteSpace: 'nowrap', textTransform: 'none' }}
                onClick={() => onOpenDocumentation(element.id)}
              >
                {t('record.open')} ›
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>
      {more ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{name}{more}</Box> : name}
    </Box>
  );
}

/**
 * *Move…* and *Create drawing*, in a *⋯* menu beside the name: where a unit
 * leads the inspector, what is done to the whole record steps aside for the
 * unit rather than stand between the name and it. Nothing, where neither is
 * offered — read-only, or a host that offers neither.
 */
export function ElementMore({ inspector }: { inspector: ElementInspectorProps }) {
  const { t } = useStrings();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { element, readOnly } = inspector;
  const move = readOnly ? undefined : inspector.move;
  const onCreateDrawing = readOnly ? undefined : inspector.onCreateDrawing;
  if (!move && !onCreateDrawing) return null;
  const choose = (then: () => void) => () => { setAnchor(null); then(); };
  return (
    <>
      <Tooltip title={t('inspector.more')}>
        <IconButton
          size="small"
          aria-label={t('inspector.more')}
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          data-testid="inspector-more"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ color: 'text.secondary', fontSize: 16, width: 30, height: 30, flexShrink: 0 }}
        >
          ⋯
        </IconButton>
      </Tooltip>
      <Menu
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { dense: true, 'aria-label': t('inspector.more') } }}
      >
        {move && (
          // The tip said on hover beside the canvas is said here, under the word: a menu has no hover to wait for.
          <MenuItem data-testid="move-record" onClick={choose(move.onMove)} sx={{ maxWidth: 300 }}>
            <ListItemText
              primary={move.label}
              secondary={move.tip}
              slotProps={{ primary: { sx: { fontSize: 13 } }, secondary: { sx: { fontSize: 11, whiteSpace: 'normal' } } }}
            />
          </MenuItem>
        )}
        {onCreateDrawing && (
          <MenuItem data-testid="create-drawing" onClick={choose(() => onCreateDrawing(element.id))}>
            <ListItemText primary={t('menu.createDrawing')} slotProps={{ primary: { sx: { fontSize: 13 } } }} />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

/**
 * Drawn here, defined there (ADR-0012 §3). Above the tabs, because it is about
 * the whole record rather than about one of its groups, and because everything
 * below it that is greyed out is greyed out for this reason.
 */
export function OwnedElsewhere({ owned }: { owned: NonNullable<ElementInspectorProps['owned']> }) {
  const { t } = useStrings();
  return (
    <Box data-testid="owned-elsewhere" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', ...STRIP }}>
      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
        {t('standIn.definedIn', { scope: owned.label })}
      </Typography>
      {owned.onOpen && (
        <Button size="small" onClick={owned.onOpen}>
          {t('standIn.open', { scope: owned.label })}
        </Button>
      )}
    </Box>
  );
}

/**
 * Where this record is answered for, when it is answered for here and could be
 * somewhere else (ADR-0012 §10). Beside the stand-in strip rather than inside
 * it: the strip is about a record this scope does not own, and this is about
 * one it does.
 */
export function MoveRecord({ move }: { move: NonNullable<ElementInspectorProps['move']> }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
      <MoveButton move={move} />
    </Box>
  );
}

function MoveButton({ move }: { move: NonNullable<ElementInspectorProps['move']> }) {
  return (
    <Tooltip title={move.tip}>
      <Button
        size="small"
        color="inherit"
        data-testid="move-record"
        sx={{ fontSize: 11, minWidth: 0, px: 1, flexShrink: 0 }}
        onClick={move.onMove}
      >
        {move.label}
      </Button>
    </Tooltip>
  );
}

/**
 * The record, as the panel beside the canvas shows it: one line, outside the
 * tabs because it is about the whole record, like the name above it. The way
 * to the page, where the fields are, is *Details ›* beside the kind above —
 * the one link; an empty record says so and no more. *Move…*, where it is
 * offered, sits at the end of this line rather than on a line of its own.
 */
export function RecordSummaryLine({ element, model, parties, answeredBy, move }: {
  element: DesignElement;
  model: DesignModel;
  parties?: readonly PartyElsewhere[];
  answeredBy?: AnsweredBy;
  move?: ElementInspectorProps['move'];
}) {
  const { t } = useStrings();
  // Who answers for it reads through the register: a name, or a pseudonym once forgotten (ADR-0036 §8).
  const names = usePersonNames();
  const summary = recordSummary(element, model, t, parties, { names, ...(answeredBy ? { answeredBy } : {}) });
  return (
    <Box data-testid="record-summary" sx={{ display: 'flex', alignItems: 'center', gap: 1, ...STRIP }}>
      <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
        {summary.length ? summary.join(' · ') : t('record.empty')}
      </Typography>
      {move && <MoveButton move={move} />}
    </Box>
  );
}

/**
 * A tab's label, with the Data tab's `n/m` beside it — the counter its
 * section already shows, so "3/5" reads the same in both places. The dot the
 * three tabs used to carry meant "has values" and was explained nowhere;
 * General and Appearance carry nothing now, because nothing there counts.
 */
function TabLabel({ text, count }: { text: string; count?: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      {text}
      {count && (
        // Out of the tab's accessible name: the section inside says the same
        // count to a screen reader, and "Data0/5" is not a tab's name.
        <Box component="span" data-testid="tab-count" aria-hidden sx={{ fontSize: 10, lineHeight: 1, color: 'text.secondary' }}>
          {count}
        </Box>
      )}
    </Box>
  );
}

/** General / Appearance / Data, beside the canvas. */
export function InspectorTabs({ value, onChange, dataCount }: {
  value: number;
  onChange(tab: number): void;
  dataCount?: string;
}) {
  const { t } = useStrings();
  return (
    <Tabs
      value={value}
      onChange={(_e, tab: number) => onChange(tab)}
      variant="fullWidth"
      // Tight letter-spacing and padding before a label clips: at a narrow
      // panel the tabs read ‹PPEARANCE otherwise.
      sx={{ minHeight: 40, mb: 0.5, '& .MuiTab-root': { minHeight: 40, py: 0.5, px: 0.5, minWidth: 0, letterSpacing: 0, fontSize: 11.5 } }}
    >
      <Tab label={<TabLabel text={t('tab.general')} />} />
      <Tab label={<TabLabel text={t('tab.appearance')} />} />
      <Tab label={<TabLabel text={t('tab.data')} count={dataCount} />} />
    </Tabs>
  );
}
