// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ExportDialog, type ExportOptions } from './ExportDialog';
import { LARGE_EXPORT_MEGAPIXELS } from './exportPng';

afterEach(() => cleanup());

const options: ExportOptions = { theme: 'light', showLabels: false, titleBlock: true, legend: true };

function open(over: Partial<Parameters<typeof ExportDialog>[0]> = {}) {
  const onChange = vi.fn<(next: ExportOptions) => void>();
  const onExport = vi.fn();
  const onClose = vi.fn();
  render(
    <ThemeProvider theme={createTheme()}>
      <ExportDialog
        open
        options={options}
        onChange={onChange}
        previewBusy={false}
        size={{ width: 2000, height: 1200, megapixels: 2 }}
        exporting={false}
        onExport={onExport}
        onClose={onClose}
        {...over}
      />
    </ThemeProvider>,
  );
  return { onChange, onExport, onClose };
}

describe('ExportDialog', () => {
  it('hands every choice back whole, so the caller never merges', () => {
    const { onChange } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...options, theme: 'dark' });
    fireEvent.click(screen.getByLabelText('Line labels'));
    expect(onChange).toHaveBeenLastCalledWith({ ...options, showLabels: true });
    fireEvent.click(screen.getByLabelText('Legend'));
    expect(onChange).toHaveBeenLastCalledWith({ ...options, legend: false });
    fireEvent.click(screen.getByLabelText('Title block'));
    expect(onChange).toHaveBeenLastCalledWith({ ...options, titleBlock: false });
  });

  it('has nowhere to put a legend without the strip', () => {
    open({ options: { ...options, titleBlock: false } });
    const legend = screen.getByLabelText('Legend') as HTMLInputElement;
    expect(legend.disabled).toBe(true);
    expect(legend.checked).toBe(false);
  });

  it('says what the bitmap will measure, and asks twice when it is large', () => {
    open();
    expect(screen.getByText('2000 × 1200 pixels, about 2 megapixels.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Export' })).toBeDefined();
    cleanup();
    open({ size: { width: 9000, height: 8000, megapixels: LARGE_EXPORT_MEGAPIXELS + 1 } });
    expect(screen.getByRole('button', { name: 'Export anyway' })).toBeDefined();
    expect(screen.getByText(/That is a large image/)).toBeDefined();
  });

  it('shows the preview once there is one, and says so until then', () => {
    open();
    expect(screen.getByRole('status').textContent).toBe('Drawing the preview…');
    cleanup();
    open({ preview: 'blob:preview' });
    expect((screen.getByAltText('Preview of the export') as HTMLImageElement).src).toBe('blob:preview');
  });

  it('holds still while the export runs', () => {
    const { onExport, onClose } = open({ exporting: true });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onExport).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('exports and closes on its two buttons', () => {
    const { onExport, onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
