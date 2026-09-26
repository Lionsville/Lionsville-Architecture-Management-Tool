// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The board as a picture: the export dialog with its live preview, the
 * export itself, and the capture a host asks for without a dialog
 * (ADR-0007).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { getNodesBounds, useReactFlow } from '@xyflow/react';
import { createTheme, type Theme } from '@mui/material/styles';
import type { DesignDiagram, Rect } from '../model/types';
import { canvasRect } from '../model/zones';
import { unionRects } from '../model/placement';
import { exportBitmapSize, exportDiagramPng, exportFooterHeight } from './export/exportPng';
import type { ExportOptions } from './export/ExportDialog';
import { getExportTokens } from './theme/tokens';
import { EditorRefused, type SolutionDesignEditorProps } from './props';
import { pngFilename, titleBlockFor, type TitleBlockContext } from './exportTitleBlock';

/**
 * The preview's long edge, in image pixels. Enough to judge a sheet, and a
 * fraction of the export's cost: the ratio is what every dimension multiplies
 * by, so a thousand-pixel preview of a six-thousand-pixel sheet is one
 * thirty-sixth of the work.
 */
const PREVIEW_LONG_EDGE = 1000;
/** How long a choice has to hold before the preview is drawn again. */
const PREVIEW_DEBOUNCE_MS = 150;

/**
 * Resolves once the browser has laid out and painted whatever render is
 * pending.
 *
 * Two frames rather than one: the first fires before the pending render has
 * been committed to the screen, the second after. Anything that reads the DOM
 * expecting to see a state change it just requested has to wait for the second
 * one. Falls back to a task where there are no frames at all, which is a test
 * environment rather than a browser.
 */
export function painted(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface ExportArgs {
  props: Pick<SolutionDesignEditorProps, 'logos' | 'exportTitleBlock'>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  theme: Theme;
  showEdgeLabels: boolean;
  /** Everything the title block reads but the theme, which is the export's own. */
  titleBlock: Omit<TitleBlockContext, 'theme'>;
  reportLayoutError(message: string, cause: unknown): void;
}

/**
 * The export dialog. While it is open the board is drawn the way the picture
 * will be — under the chosen theme, with or without every label, every
 * element mounted — so the capture, the preview and what shows behind the
 * dialog are one thing.
 */
export function useExportDialog(args: ExportArgs) {
  const { theme, titleBlock, reportLayoutError } = args;
  const { diagram, t } = titleBlock;
  const [exportOptions, setExportOptions] = useState<ExportOptions | undefined>(undefined);
  // Its own flag rather than the layout's `busy`: it neither commits nor
  // conflicts with a layout pass. All it owes the user is a spinner on the
  // button they pressed, and no second export while the first rasterises.
  const [exporting, setExporting] = useState(false);
  const picture = usePicture(args, exportOptions?.theme);
  const { exportTheme, exportBounds, titleBlockOf, renderExportRef } = picture;

  /** What the bitmap will measure, told to the dialog before it is made. */
  const exportSize = useMemo(
    () => (exportOptions
      ? exportBitmapSize(exportBounds(), 48, undefined, exportFooterHeight(titleBlockOf(exportOptions)))
      : undefined),
    [exportOptions, exportBounds, titleBlockOf],
  );
  const openExport = useCallback(() => {
    if (!diagram || exporting) return;
    setExportOptions({
      theme: theme.palette.mode,
      showLabels: args.showEdgeLabels,
      titleBlock: diagram.showTitleBlock !== false,
      legend: true,
    });
  }, [diagram, exporting, theme.palette.mode, args.showEdgeLabels]);
  const preview = useExportPreview(exportOptions, exportBounds, renderExportRef, reportLayoutError, t);
  const { setExportPreview } = preview;
  const closeExport = useCallback(() => {
    setExportOptions(undefined);
    setExportPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return undefined;
    });
  }, [setExportPreview]);

  const confirmExport = useConfirmExport(args, exportOptions, setExporting, renderExportRef, closeExport);

  return {
    exportOptions, setExportOptions, exporting, exportTheme, exportSize,
    exportPreview: preview.exportPreview, previewBusy: preview.previewBusy,
    openExport, closeExport, confirmExport,
  };
}

export type ExportDialogState = ReturnType<typeof useExportDialog>;

/**
 * The export itself, from the dialog. Rasterising a large board takes
 * seconds; the dialog's button spins and its options hold still meanwhile.
 * `finally` frees it either way — a failed export that left the dialog
 * locked would be worse than the failure.
 */
function useConfirmExport(
  args: ExportArgs,
  exportOptions: ExportOptions | undefined,
  setExporting: (exporting: boolean) => void,
  renderExportRef: RenderRef,
  closeExport: () => void,
) {
  const { props, titleBlock, reportLayoutError } = args;
  const { diagram, t } = titleBlock;
  return useCallback(() => {
    if (!exportOptions || !diagram) return;
    const shot = diagram;
    setExporting(true);
    void (async () => {
      await painted();
      const blob = await renderExportRef.current(exportOptions);
      // The editor can be gone by the time that frame arrives — a diagram
      // switched, a project closed, a window shut. Nothing to hand over.
      if (!blob) return;
      downloadBlob(blob, pngFilename(props.exportTitleBlock?.client ?? titleBlock.model.name, shot));
      closeExport();
    })().catch((error: unknown) => {
      reportLayoutError(t('error.export'), error);
    }).finally(() => {
      setExporting(false);
    });
  }, [exportOptions, diagram, titleBlock.model.name, props.exportTitleBlock, closeExport, reportLayoutError, t, renderExportRef, setExporting]);
}

/** The picture renderer, read through a ref (see `usePicture`). */
type RenderRef = RefObject<(options: ExportOptions, pixelRatio?: number) => Promise<Blob | undefined>>;

/**
 * The picture, at a ratio: the export's own when none is named, a small one
 * for the preview. One function for both, so the preview cannot show a
 * picture the export would not make. The theme is the one it is made in: the
 * board is rendered under it for as long as the dialog is open, which is what
 * lets a dark window export a light sheet — every token the nodes and lines
 * draw with comes off the theme they are rendered in.
 */
function usePicture(args: ExportArgs, exportMode: 'light' | 'dark' | undefined) {
  const { props, wrapperRef, theme, titleBlock } = args;
  const { diagram } = titleBlock;
  const { getNodes } = useReactFlow();
  const exportTheme = useMemo(
    () => (exportMode && exportMode !== theme.palette.mode ? createTheme({ palette: { mode: exportMode } }) : theme),
    [exportMode, theme],
  );
  /** The region the export captures: the whole board, and on a landscape the sheet itself. */
  const exportBounds = useCallback((): Rect => {
    const nodesBounds = getNodesBounds(getNodes());
    return diagram?.kind === 'layer7'
      ? (unionRects([canvasRect(diagram.geometry), nodesBounds]) as Rect)
      : nodesBounds;
  }, [diagram, getNodes]);
  const { model, lookingAt, host, showLifecycle, t, language } = titleBlock;
  const titleBlockOf = useCallback(
    (options: ExportOptions) => titleBlockFor(options, { diagram, model, lookingAt, host, theme: exportTheme, showLifecycle, t, language }),
    [diagram, lookingAt, host, model, t, language, exportTheme, showLifecycle],
  );
  const renderExport = useCallback(async (options: ExportOptions, pixelRatio?: number) => {
    const container = wrapperRef.current;
    if (!container || !diagram) return undefined;
    return exportDiagramPng({
      container,
      bounds: exportBounds(),
      pixelRatio,
      background: exportTheme.palette.background.default,
      palette: getExportTokens(exportTheme),
      onImagesMissing: props.logos?.onExportImagesMissing,
      titleBlock: titleBlockOf(options),
    });
  }, [diagram, exportBounds, exportTheme, props.logos?.onExportImagesMissing, titleBlockOf, wrapperRef]);
  // Read through a ref by the preview, so it is drawn again when a CHOICE
  // changes and not whenever a parent happens to render: the host hands over
  // a fresh `exportTitleBlock` object every time it does.
  const renderExportRef = useRef(renderExport);
  renderExportRef.current = renderExport;
  return { exportTheme, exportBounds, titleBlockOf, renderExportRef };
}

/**
 * The preview, drawn again whenever a choice changes. It waits a beat for the
 * board to be rendered under the new choice — the theme is a re-render, every
 * element mounting is a bigger one — and then a paint, because the capture
 * reads the DOM. A choice made while one is drawing cancels it: the picture
 * arriving late would be of the wrong choice.
 */
function useExportPreview(
  exportOptions: ExportOptions | undefined,
  exportBounds: () => Rect,
  renderExportRef: RenderRef,
  reportLayoutError: (message: string, cause: unknown) => void,
  t: TitleBlockContext['t'],
) {
  /** An object URL of the last preview drawn, revoked when the next replaces it. */
  const [exportPreview, setExportPreview] = useState<string | undefined>(undefined);
  const [previewBusy, setPreviewBusy] = useState(false);
  useEffect(() => {
    if (!exportOptions) return;
    // No object URLs is a test runtime; the dialog then shows its waiting line
    // and everything else about it still works.
    if (typeof URL.createObjectURL !== 'function') return;
    let live = true;
    setPreviewBusy(true);
    const timer = setTimeout(() => {
      void (async () => {
        await painted();
        if (!live) return;
        const bounds = exportBounds();
        const longEdge = Math.max(bounds.width, bounds.height, 1);
        const blob = await renderExportRef.current(exportOptions, Math.min(1, PREVIEW_LONG_EDGE / longEdge));
        if (!live || !blob) return;
        setExportPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
      })().catch((error: unknown) => {
        reportLayoutError(t('error.export'), error);
      }).finally(() => {
        if (live) setPreviewBusy(false);
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [exportOptions, exportBounds, reportLayoutError, t, renderExportRef]);
  return { exportPreview, setExportPreview, previewBusy };
}

/**
 * The board as pixels for a host — an agent asking through the shell
 * (ADR-0007). The export's capture without its download, its title block or
 * its size question: the host chose the region and the ratio, and the budget
 * is its. A hidden window cannot paint, and `html-to-image` waits on a frame
 * that never comes; saying so is the difference between a refusal and a hang.
 * `capturing` mounts the whole board for as long as it takes.
 */
export function useBoardCapture(
  wrapperRef: RefObject<HTMLDivElement | null>,
  diagram: DesignDiagram | undefined,
  theme: Theme,
  onImagesMissing: NonNullable<SolutionDesignEditorProps['logos']>['onExportImagesMissing'],
) {
  const [capturing, setCapturing] = useState(false);
  const captureBoard = useCallback(async (options: { bounds: Rect; pixelRatio: number; padding: number }) => {
    if (!wrapperRef.current || !diagram) throw new EditorRefused('gone');
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') throw new EditorRefused('hidden');
    setCapturing(true);
    try {
      await painted();
      const container = wrapperRef.current;
      if (!container) throw new EditorRefused('gone');
      return await exportDiagramPng({
        container,
        bounds: options.bounds,
        pixelRatio: options.pixelRatio,
        padding: options.padding,
        background: theme.palette.background.default,
        onImagesMissing,
      });
    } finally {
      setCapturing(false);
    }
  }, [diagram, theme, onImagesMissing, wrapperRef]);
  return { capturing, captureBoard };
}
