// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * MUI's default theme, as an editor test renders under it, less one thing
 * that costs only in jsdom.
 *
 * Every MUI text field mounts a `GlobalStyles` for the browser's autofill
 * keyframes, and Emotion's `Global` looks for its own style tag with a
 * `document.querySelector` each time one mounts. In a browser that is nothing.
 * In jsdom it is a walk of the whole document per field, and the inspector —
 * a panel of fields, mounted in most editor tests — spent a quarter of its
 * test time there. jsdom does not autofill, so no test can tell the
 * difference.
 *
 * One theme for every render: nothing writes to a theme.
 */
import { createTheme } from '@mui/material/styles';

export const testTheme = createTheme({
  components: { MuiInputBase: { defaultProps: { disableInjectingGlobalStyles: true } } },
});
