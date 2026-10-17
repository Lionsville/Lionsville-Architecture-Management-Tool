// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import { CompactForms, FieldGrid, FieldsDialog, Term, Value } from './CompactForms';

/**
 * One treatment for every screen that shows properties or asks for a form
 * (3.7.0): the theme makes the fields small wherever it is worn, a dialog that
 * is a form wears it too, and the companions are the same markup everywhere.
 */

afterEach(() => cleanup());

const small = (label: string) =>
  screen.getByLabelText(label).closest('.MuiInputBase-root')?.classList.contains('MuiInputBase-sizeSmall') ?? false;

describe('CompactForms', () => {
  it('makes every field under it the small one, without the field saying so', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <TextField label="Outside" />
        <CompactForms><TextField label="Inside" /></CompactForms>
      </ThemeProvider>,
    );
    expect(small('Outside')).toBe(false);
    expect(small('Inside')).toBe(true);
  });

  it('a dialog that is a form wears the same treatment', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <FieldsDialog open aria-label="A form"><TextField label="Name" /></FieldsDialog>
      </ThemeProvider>,
    );
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(small('Name')).toBe(true);
  });

  it('lays a reader\'s front matter out as terms and values, and fields side by side where there is room', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <dl><Term>Status</Term><Value testId="status">Accepted</Value></dl>
        <FieldGrid testId="pair" min={150}><span>a</span><span>b</span></FieldGrid>
      </ThemeProvider>,
    );
    expect(screen.getByText('Status').tagName).toBe('DT');
    expect(screen.getByTestId('status').tagName).toBe('DD');
    expect(getComputedStyle(screen.getByTestId('pair')).gridTemplateColumns).toBe('repeat(auto-fit, minmax(150px, 1fr))');
  });
});
