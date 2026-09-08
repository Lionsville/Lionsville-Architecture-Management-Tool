// @vitest-environment jsdom
/**
 * The inspector's small field offers the same help the page does, without the
 * picture row: the field takes no picture in, so it does not describe one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { MarkdownField } from './MarkdownField';

afterEach(cleanup);

describe('MarkdownField', () => {
  it('opens the markdown help beside the field, without the picture row', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MarkdownField value="" disabled={false} onChange={vi.fn()} />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Markdown help' }));
    const help = within(screen.getByTestId('markdown-help'));
    expect(help.getByText('[[Order Management]]')).toBeTruthy();
    expect(help.queryByText('![caption](../images/file.png)')).toBeNull();
  });
});
