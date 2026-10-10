// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Copy link* on a record's bar (ADR-0033, amended). Shown whenever the page
 * can ask for a link, including when the record is read-only: the control
 * says why there is no link, the way *Share with a Link…* does, rather than
 * disappearing.
 */
import Button from '@mui/material/Button'

export function CopyLinkButton({ label, onCopy }: { label: string; onCopy: () => void }) {
  return (
    <Button size="small" onClick={onCopy} data-testid="copy-link">{label}</Button>
  )
}
