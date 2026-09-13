/**
 * A scope, edited from the screen it appears on.
 *
 * The same dialog at every level, because every scope is the same document
 * (ADR-0012 §1): the organisation at the root, a domain under it, a landscape
 * under that. What it edits is what a scope says about itself — its name, who
 * its drawings are made out to, what it is, and where the rest of its material
 * lives.
 *
 * **Renaming is not moving.** `acme/rail` is how everything under it is filed
 * and how the last-opened preference points at one; renaming relabels and
 * leaves the address alone. Moving is the separate question *filed under*,
 * which changes the address of this scope and of everything beneath it — save
 * there, remove here, which is the caller's to perform for the same reason a
 * save is.
 *
 * A scope may not be filed under itself or under one of its own descendants,
 * so the field excludes its own subtree; the root has no field at all, because
 * the root is where the tree is and there is nowhere above it.
 *
 * The dialog says what it wants; the caller performs it, because a save is a
 * store operation and not a field edit.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { StringKey, Translate } from '../../i18n'
import { isSafeLinkUrl } from '../../projects/links'
import type { RecordLink } from '../../projects/links'
import { SCOPE_KINDS } from '../../projects/scope'
import type { ScopeKind, ScopeSummary } from '../../projects/scope'
import { parentScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { ScopeSettingsPatch } from '../App'
import { ScopeField } from './ScopeField'

/**
 * What each kind is called. A word for this dialog to offer and never a branch
 * ({@link ScopeKind}) — the screen reads it, nothing switches on it.
 */
export const SCOPE_KIND_LABEL = {
  organisation: 'org.kindOrganisation',
  domain: 'org.kindDomain',
  programme: 'org.kindProgramme',
  team: 'org.kindTeam',
  landscape: 'org.kindLandscape',
} as const satisfies Record<ScopeKind, StringKey>

export type ScopeSettingsDialogProps = {
  /** The scope being edited; the dialog is closed while undefined. */
  target?: ScopeSummary
  /**
   * The tree, for the *filed under* field. Absent means the question is not
   * asked — a caller with no listing to hand cannot offer a move.
   */
  tree?: ScopeSummary
  onSave: (path: ScopePath, patch: ScopeSettingsPatch) => void
  onCancel: () => void
  s: Translate
}

type LinkDraft = RecordLink

export function ScopeSettingsDialog({
  target, tree, onSave, onCancel, s,
}: ScopeSettingsDialogProps) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [description, setDescription] = useState('')
  const [links, setLinks] = useState<LinkDraft[]>([])
  const [kind, setKind] = useState<ScopeKind | ''>('')
  const [parent, setParent] = useState<ScopePath>(ROOT_SCOPE)

  // Reopening on a different scope must not show the previous one's values.
  useEffect(() => {
    if (!target) return
    setName(target.name)
    setClient(target.client ?? '')
    setDescription(target.description ?? '')
    setLinks((target.links ?? []).map((link) => ({ ...link })))
    setKind(target.kind ?? '')
    setParent(parentScope(target.path) ?? ROOT_SCOPE)
  }, [target])

  // The root has nowhere to go, and a listing is what the field is made of.
  const canMove = tree !== undefined && target !== undefined && target.path !== ROOT_SCOPE

  const editLink = (index: number, patch: Partial<LinkDraft>) =>
    setLinks(links.map((link, i) => (i === index ? { ...link, ...patch } : link)))

  const ready = name.trim().length > 0

  return (
    <Dialog open={target !== undefined} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('group.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={s('group.name')}
            helperText={s('group.nameHelp', { path: target?.path || '/' })}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            fullWidth
            size="small"
            label={s('group.client')}
            placeholder={name.trim() || undefined}
            helperText={s('group.clientHelp')}
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            size="small"
            label={s('group.description')}
            placeholder={s('group.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <TextField
            select
            fullWidth
            size="small"
            label={s('org.kind')}
            helperText={s('org.kindHelp')}
            value={kind}
            onChange={(e) => setKind(e.target.value as ScopeKind | '')}
          >
            <MenuItem value="">{s('org.kindNone')}</MenuItem>
            {SCOPE_KINDS.map((one) => (
              <MenuItem key={one} value={one}>{s(SCOPE_KIND_LABEL[one])}</MenuItem>
            ))}
          </TextField>
          {canMove && (
            <ScopeField
              tree={tree}
              value={parent}
              onChange={setParent}
              label={s('org.filedUnder')}
              helperText={s('org.filedUnderHelp')}
              excluding={target.path}
              s={s}
            />
          )}

          <Box>
            <Typography sx={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: 'text.secondary',
            }}>
              {s('group.links')}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1 }}>
              {s('group.linksHelp')}
            </Typography>
            <Stack spacing={1}>
              {links.map((link, index) => {
                // Flagged, not refused: somebody halfway through typing an
                // address has not made a mistake yet. What cannot be rendered is
                // dropped on save, by `normaliseLinks`.
                const bad = link.url.trim().length > 0 && !isSafeLinkUrl(link.url)
                return (
                  <Stack key={index} direction="row" spacing={0.5} alignItems="flex-start">
                    <TextField
                      size="small"
                      label={index === 0 ? s('group.linkLabel') : undefined}
                      value={link.label}
                      sx={{ width: 160 }}
                      onChange={(e) => editLink(index, { label: e.target.value })}
                    />
                    <TextField
                      size="small"
                      label={index === 0 ? s('group.linkUrl') : undefined}
                      placeholder="https://"
                      value={link.url}
                      error={bad}
                      helperText={bad ? s('group.badUrl') : undefined}
                      sx={{ flex: 1 }}
                      onChange={(e) => editLink(index, { url: e.target.value })}
                    />
                    <Tooltip title={s('group.removeLink', { name: link.label || link.url })}>
                      <IconButton
                        size="small"
                        aria-label={s('group.removeLink', { name: link.label || link.url })}
                        onClick={() => setLinks(links.filter((_, i) => i !== index))}
                        sx={{ mt: index === 0 ? 1 : 0 }}
                      >
                        ✕
                      </IconButton>
                    </Tooltip>
                  </Stack>
                )
              })}
            </Stack>
            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() => setLinks([...links, { label: '', url: '' }])}
            >
              {s('group.addLink')}
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={!ready}
          onClick={() => {
            if (!target) return
            // A patch and not a record: a scope also holds a model, decisions
            // and plans this dialog does not show, and the caller reads the
            // scope and writes these fields onto it rather than over it.
            onSave(target.path, {
              name,
              client,
              description,
              links,
              ...(kind ? { kind } : {}),
              ...(canMove && parent !== (parentScope(target.path) ?? ROOT_SCOPE)
                ? { parent }
                : {}),
            })
          }}
        >
          {s('settings.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
