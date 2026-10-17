// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One treatment for every screen that shows a record's properties or asks
 * for a form of fields — the board's inspector, the documentation page's
 * column, the operating model's, the technology landscape's, the people
 * page's, the business sheet's, the readers' front matter and edit fields,
 * and every dialog that is a form — said once, so the screens agree with
 * each other without each saying `size="small"` on every field.
 *
 * `CompactForms` is a theme over the host's: every text field, select,
 * autocomplete, switch and checkbox under it is the small one, the labels and
 * helper lines are a size down, and a field a person may only read — disabled
 * because the session is read-only or because another scope answers for it
 * (ADR-0012 §3) — keeps its words in the page's ink behind a dashed outline,
 * rather than greying out as a control that is broken would. The companions
 * are the words and the room around a field: a section's heading, the small
 * label over a value nobody types, the value itself, a term and its value in
 * a reader's front matter, fields in a column at the one gap, and fields side
 * by side where there is room. `FieldsDialog` is a dialog that is a form.
 */
import { useMemo, type ElementType, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Dialog, { type DialogProps } from '@mui/material/Dialog';
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
      MuiRadio: { defaultProps: { size: 'small' } },
      MuiToggleButtonGroup: { defaultProps: { size: 'small' } },
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
      MuiDialogContentText: { styleOverrides: { root: { fontSize: 14 } } },
    },
  }), [outer]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

/** A section's heading in a panel: small capitals in the second ink, with room above it. */
export function SectionHeading({ children, sx, testId, id, component = 'div' }: {
  children: ReactNode; sx?: SxProps<Theme>; testId?: string; id?: string; component?: ElementType;
}) {
  return (
    <Typography
      component={component}
      id={id}
      data-testid={testId}
      sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.4, ...sx }}
    >
      {children}
    </Typography>
  );
}

/** The small label over a value nobody types: what a derived line or a list of chips is called — and a help line under a field. */
export function FieldLabel({ children, sx, component = 'div', testId }: { children: ReactNode; sx?: SxProps<Theme>; component?: ElementType; testId?: string }) {
  return (
    <Typography component={component} data-testid={testId} sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.4, ...sx }}>
      {children}
    </Typography>
  );
}

/** The value under a `FieldLabel`, in the page's ink; `quiet` for a nothing. */
export function FieldText({ children, quiet, sx, testId, component = 'div' }: {
  children: ReactNode; quiet?: boolean; sx?: SxProps<Theme>; testId?: string; component?: ElementType;
}) {
  return (
    <Typography component={component} data-testid={testId} sx={{ fontSize: 13, lineHeight: 1.4, color: quiet ? 'text.secondary' : 'text.primary', ...sx }}>
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

/**
 * A term and its value in a reader's front matter — a `dl` laid out as two
 * columns, the term in the label's ink and size, the value in the page's.
 * A full-page reader keeps the list where a panel stacks the label over the
 * value: the reader has the width, and a column of terms is how a record's
 * facts are read at a glance.
 */
export function Term({ children }: { children: ReactNode }) {
  return <FieldLabel component="dt" sx={{ pt: '3px' }}>{children}</FieldLabel>;
}

export function Value({ children, testId }: { children: ReactNode; testId?: string }) {
  return <Box component="dd" sx={{ m: 0 }} data-testid={testId}>{children}</Box>;
}

/** Fields one under the other, at the one gap every panel keeps between them. */
export function Fields({ children, gap = 1.25, sx, testId, guide }: {
  children: ReactNode; gap?: number; sx?: SxProps<Theme>; testId?: string; guide?: string;
}) {
  return (
    <Box data-testid={testId} data-guide={guide} sx={{ display: 'flex', flexDirection: 'column', gap, ...sx }}>
      {children}
    </Box>
  );
}

/**
 * Fields side by side where there is room for `min` px each, one under the
 * other where there is not — a panel beside a canvas stacks what a page lays
 * out in two columns, from the same markup.
 */
export function FieldGrid({ children, min = 140, sx, testId }: { children: ReactNode; min?: number; sx?: SxProps<Theme>; testId?: string }) {
  return (
    <Box data-testid={testId} sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 1, ...sx }}>
      {children}
    </Box>
  );
}

/** A dialog that is a form: the same fields as a panel's, under its title and above its actions. */
export function FieldsDialog({ children, ...rest }: DialogProps) {
  return <Dialog {...rest}><CompactForms>{children}</CompactForms></Dialog>;
}
