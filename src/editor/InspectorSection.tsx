// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useId, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';

/**
 * Collapsible inspector section (iteration 3 interface simplification): the
 * long stacked form becomes scannable groups. No field is removed — collapsed
 * sections carry a badge so state stays visible. Mount with a key per element
 * so defaults recompute on selection change.
 */
export function InspectorSection({
  title,
  badge,
  note,
  testId,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Small counter shown next to the title (e.g. "3/5" aspects set). */
  badge?: string;
  /** What the section holds, said quietly after the title while it is folded and open alike. */
  note?: string;
  testId?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <Box>
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
        data-testid={testId}
        aria-controls={id}
        sx={{
          width: '100%',
          justifyContent: 'flex-start',
          gap: 0.75,
          py: 0.5,
          borderRadius: 1,
          color: 'text.secondary',
        }}
        aria-expanded={open}
      >
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          style={{
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 120ms',
            flexShrink: 0,
          }}
        >
          <path
            d="M9 5l7 7-7 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* The same small capitals every panel's section wears (`SectionHeading`). */}
        <Typography component="span" sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.4 }}>
          {title}
        </Typography>
        {note && (
          <Typography variant="caption" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {note}
          </Typography>
        )}
        {badge && (
          <Typography variant="caption" sx={{ ml: 'auto', mr: 0.5 }}>
            {badge}
          </Typography>
        )}
      </ButtonBase>
      <Collapse in={open} unmountOnExit={false} id={id}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pt: 0.5, pb: 1 }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}
