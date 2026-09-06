import { useState, type ReactNode } from 'react';
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
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Small counter shown next to the title (e.g. "3/5" aspects set). */
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box>
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
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
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.6 }}>
          {title}
        </Typography>
        {badge && (
          <Typography variant="caption" sx={{ ml: 'auto', mr: 0.5 }}>
            {badge}
          </Typography>
        )}
      </ButtonBase>
      <Collapse in={open} unmountOnExit={false}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 0.5, pb: 1 }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}
