// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The theme a picture is made in (ADR-0007): the window's own in the window's
 * mode, and the host's own for the other one — never MUI's default palette
 * while the host has a theme to give.
 */
import { describe, expect, it } from 'vitest';
import { createTheme } from '@mui/material/styles';
import { exportThemeFor } from './useExport';
import { getExportTokens } from './theme/tokens';

const host = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    primary: { main: mode === 'dark' ? '#8e96f2' : '#4f5bd5' },
    background: mode === 'dark' ? { default: '#15171b', paper: '#1e2126' } : { default: '#f4f5f7', paper: '#ffffff' },
  },
});

describe('the theme an export is made in', () => {
  it('is the window’s own when the export is in the window’s mode, or names none', () => {
    const light = host('light');
    expect(exportThemeFor(light, 'light', host)).toBe(light);
    expect(exportThemeFor(light, undefined, host)).toBe(light);
  });

  it('is the host’s theme for the other mode, so the picture wears the host’s palette tokens', () => {
    for (const [window, other] of [['light', 'dark'], ['dark', 'light']] as const) {
      const made = exportThemeFor(host(window), other, host);
      expect(made.palette.mode).toBe(other);
      expect(getExportTokens(made)).toEqual(getExportTokens(host(other)));
      expect(getExportTokens(made)).not.toEqual(getExportTokens(createTheme({ palette: { mode: other } })));
    }
  });

  it('falls back to MUI’s palette for the other mode only where the host has no theme to give', () => {
    const made = exportThemeFor(host('light'), 'dark', undefined);
    expect(getExportTokens(made)).toEqual(getExportTokens(createTheme({ palette: { mode: 'dark' } })));
  });
});
