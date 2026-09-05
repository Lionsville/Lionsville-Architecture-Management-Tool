import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { TidyOptions } from '../layout/tidy';
import type { DesignDiagram } from '../types';
import { TidySettingsPanel } from './TidySettingsPanel';
import { useStrings } from '../i18n/LanguageContext';
import type { EditorActions } from './useEditorState';

export interface DomainGroupInspectorProps {
  /** The selected group's name — domain groups are keyed by name, not by id. */
  name: string;
  diagram: DesignDiagram;
  readOnly: boolean;
  actions: EditorActions;
  /** Runs the per-group tidy; absent read-only or when the host supplies none. */
  onTidy?(name: string): void;
  /**
   * The per-group tidy settings — the SAME state the right-click menu's popover
   * edits, so the two entry points can never disagree about how a group is
   * tidied.
   */
  tidyOptions: TidyOptions;
  onTidyOptionsChange?(options: TidyOptions): void;
}

/**
 * Property panel for a selected domain group. Groups are layout rects in
 * `layoutConfig`, not model rows, so this is deliberately small: rename, member
 * count, tidy, remove. It exists mainly so a group is as easy to inspect and
 * get rid of as a node — the right-click menu on a box is precise but hard to
 * find, and the name pill is a small target to aim a gesture at.
 */
export function DomainGroupInspector(props: DomainGroupInspectorProps) {
  const { t } = useStrings();
  const { name, diagram, readOnly, actions } = props;
  // Local draft so typing doesn't rename on every keystroke (a rename rewrites
  // every member's `domainGroup`); committed on blur/Enter like the canvas one.
  const [draft, setDraft] = useState(name);
  const [seenName, setSeenName] = useState(name);
  if (seenName !== name) {
    setSeenName(name);
    setDraft(name);
  }

  const members = diagram.placements.filter((p) => p.domainGroup === name).length;
  const commitRename = () => {
    if (draft.trim() === name) return;
    actions.renameDomainGroup(name, draft);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        {t('section.domainGroup')}
      </Typography>
      <TextField
        label={t('field.name')}
        size="small"
        fullWidth
        value={draft}
        disabled={readOnly}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitRename}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitRename();
          // Escape reverts the draft here rather than deselecting the group —
          // the editor's Escape shortcut still fires from anywhere else.
          if (event.key === 'Escape') {
            event.stopPropagation();
            setDraft(name);
          }
        }}
      />
      <Typography variant="body2" color="text.secondary">
        {members === 1
          ? t('group.membersOne', { count: members })
          : t('group.membersOther', { count: members })}
      </Typography>
      {!readOnly && (
        <>
          {props.onTidy && (
            <>
              <Divider />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                {t('section.tidyGroup')}
              </Typography>
              {/* The same controls the right-click menu opens, on the same
                  state — direction, density and manual routes, then Apply.
                  "Pin group placements" stays out: a per-group tidy already
                  leaves the box where it is. */}
              <TidySettingsPanel
                width="100%"
                options={props.tidyOptions}
                onChange={(next) => props.onTidyOptionsChange?.(next)}
                applyLabel={t('group.tidyApply', { name })}
                onApply={() => props.onTidy?.(name)}
              />
            </>
          )}
          <Divider />
          <Button
            color="error"
            variant="outlined"
            size="small"
            onClick={() => actions.removeDomainGroup(name)}
          >
            {t('group.remove')}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {t('group.removeNote')}
          </Typography>
        </>
      )}
    </Box>
  );
}
