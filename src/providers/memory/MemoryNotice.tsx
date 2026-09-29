// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The standing notice where nothing is kept: this browser refused, and
 * nothing done here outlives the tab. Said all the time rather than once,
 * because the time a person needs it is the moment before they close the tab.
 *
 * Along the bottom rather than above the toolbar: on the desktop that bar is
 * the title bar, and anything pushed above it lands under the traffic lights.
 * A standing strip is as visible and owes the window nothing.
 */
import Alert from '@mui/material/Alert'
import { useStrings } from '../../i18n'
import type { SourceChromeProps } from '../../ports/ProviderParts'

export function MemoryNotice({ current }: SourceChromeProps) {
  const { t: s } = useStrings()
  if (!current) return null
  return (
    <Alert
      severity="warning"
      square
      data-testid="storage-notice"
      sx={{ flex: '0 0 auto', borderRadius: 0, py: 0, fontSize: 12 }}
    >
      {s('shell.keepFailed')}
    </Alert>
  )
}
