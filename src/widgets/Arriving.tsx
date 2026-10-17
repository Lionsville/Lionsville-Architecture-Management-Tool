// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The frame a part draws while its script is on the way (`lazyPart`'s
 * `fallback`): a page's or a dialog's outline, with a line that says the
 * part is loading. Without one the page a person left stays on screen with
 * no sign that anything was pressed, and a dialog is a faint empty overlay;
 * with one, the press shows at once, and the part fills the frame it lands
 * in.
 */
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import Typography from '@mui/material/Typography'
import { useStrings } from '../i18n/LanguageContext'
import { PageDialog } from './PageDialog'

function Arriving() {
  const { t } = useStrings()
  return (
    <Box role="status" data-testid="arriving" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, flex: 1, minHeight: 160, color: 'text.secondary' }}>
      <CircularProgress size={18} color="inherit" />
      <Typography sx={{ fontSize: 13 }}>{t('common.arriving')}</Typography>
    </Box>
  )
}

/** A page's frame: the window under the host's top bar, as the page will fill it. */
export function ArrivingPage({ topInset = 0 }: { topInset?: number }) {
  const { t } = useStrings()
  return (
    <PageDialog open topInset={topInset} aria-label={t('common.arriving')} transitionDuration={0}>
      <Box sx={{ minHeight: 48, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }} />
      <Arriving />
    </PageDialog>
  )
}

/** A dialog's frame, the size a small dialog is. */
export function ArrivingDialog() {
  const { t } = useStrings()
  return (
    <Dialog open maxWidth="xs" fullWidth aria-label={t('common.arriving')} transitionDuration={0}>
      <Arriving />
    </Dialog>
  )
}

/** The fallback for a page that says when it is up, and where the host's bar is. */
export function arrivingPage(props: { open?: boolean; windowChrome?: { topInset?: number } }) {
  return props.open === false ? null : <ArrivingPage topInset={props.windowChrome?.topInset ?? 0} />
}

/** The fallback for a dialog that says when it is up. */
export function arrivingDialog(props: { open?: boolean }) {
  return props.open === false ? null : <ArrivingDialog />
}
