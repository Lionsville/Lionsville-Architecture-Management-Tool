// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One treatment for every panel that shows a record's properties beside a
 * picture or a list — the board's inspector, the operating model's, the
 * technology landscape's, the people page's — said once, so the panels agree
 * with each other without each saying `size="small"` on every field.
 *
 * `CompactForms` is a theme over the host's: every text field, select,
 * autocomplete, switch and checkbox under it is the small one, the labels and
 * helper lines are a size down, and a field a person may only read — disabled
 * because the session is read-only or because another scope answers for it
 * (ADR-0012 §3) — keeps its words in the page's ink behind a dashed outline,
 * rather than greying out as a control that is broken would. The three
 * companions are the words around a field: a section's heading, the small
 * label over a value nobody types, and the value itself.
 */
import { useMemo, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider, useTheme, type SxProps, type Theme } from '@mui/material/styles';

export function CompactForms({ children }: { children: ReactNode }) {
  const outer = useTheme();
  const theme = useMemo(() => createTheme(outer, {
    components: {
      MuiTextField: { defaultProps: { size: 'small', margin: 'none' } },
      MuiFormControl: { defaultProps: { size: 'small' } },
      MuiAutocomplete: { defaultProps: { size: 'small' } },
      MuiSwitch: { defaultProps: { size: 'small' } },
      MuiCheckbox: { defaultProps: { size: 'small' } },
      MuiInputBase: {
        styleOverrides: {
          root: { fontSize: 13 },
          input: {
            '&.Mui-disabled': { WebkitTextFillColor: outer.palette.text.primary },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderStyle: 'dashed' },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { fontSize: 13, '&.Mui-disabled': { color: outer.palette.text.secondary } },
        },
      },
      MuiFormHelperText: { styleOverrides: { root: { fontSize: 11, marginTop: 2, marginLeft: 6, marginRight: 6 } } },
      MuiFormControlLabel: { styleOverrides: { label: { fontSize: 13 } } },
      MuiMenuItem: { styleOverrides: { root: { fontSize: 13, minHeight: 32 } } },
      MuiChip: { defaultProps: { size: 'small' } },
    },
  }), [outer]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

/** A section's heading in a panel: small capitals in the second ink, with room above it. */
export function SectionHeading({ children, sx, testId }: { children: ReactNode; sx?: SxProps<Theme>; testId?: string }) {
  return (
    <Typography
      component="div"
      data-testid={testId}
      sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.4, ...sx }}
    >
      {children}
    </Typography>
  );
}

/** The small label over a value nobody types: what a derived line or a list of chips is called. */
export function FieldLabel({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Typography component="div" sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.4, ...sx }}>
      {children}
    </Typography>
  );
}

/** The value under a `FieldLabel`, in the page's ink; `quiet` for a nothing. */
export function FieldText({ children, quiet, sx, testId }: { children: ReactNode; quiet?: boolean; sx?: SxProps<Theme>; testId?: string }) {
  return (
    <Typography component="div" data-testid={testId} sx={{ fontSize: 13, lineHeight: 1.4, color: quiet ? 'text.secondary' : 'text.primary', ...sx }}>
      {children}
    </Typography>
  );
}

/** A label and its value, stacked, as one block. */
export function ReadField({ label, children, testId }: { label: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <Box data-testid={testId}>
      <FieldLabel>{label}</FieldLabel>
      <FieldText>{children}</FieldText>
    </Box>
  );
}
