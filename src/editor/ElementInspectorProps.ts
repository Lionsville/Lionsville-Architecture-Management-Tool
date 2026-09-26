// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ReactNode } from 'react';
import type { EditorOwnership } from './props';
import type { DesignDiagram, DesignElement, DesignModel, ElementId } from '../model/types';
import type { MarkdownRenderOptions } from '../documentation/documentation';
import type { LeverageLine } from '../model/leverage';
import type { EditorActions } from './useEditorState';

export interface ElementInspectorProps {
  element: DesignElement;
  model: DesignModel;
  diagram: DesignDiagram;
  readOnly: boolean;
  actions: EditorActions;
  onRequestDelete(): void;
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode;
  /**
   * Opens the host's logo-upload flow. Absent = the icon picker shows no upload
   * tile, which is the correct state for a host with no library to add to.
   */
  onRequestLogoUpload?(): void;
  /**
   * "Rename" (node menu, F2): focus the Name field and select its text. Keyed
   * by element id so a request for another element is ignored, and handled
   * once per nonce so a re-render never steals focus back.
   */
  renameRequest?: { id: string; nonce: number };
  /**
   * Opens the documentation page for this element. Absent = no expand button
   * beside the description, which is the state inside the page itself.
   */
  onOpenDocumentation?(elementId: ElementId): void;
  /**
   * Start a replacement of this element (ADR-0010): the host opens its dialog.
   * Absent = no Replace… button, which is read-only mode and a host with no
   * plans.
   */
  onReplace?(elementId: ElementId): void;
  /** The page shows the description as the page; it must not show it twice. */
  hideDescription?: boolean;
  /**
   * `tabs` (default) is the panel beside the canvas, where width is scarce.
   * `stacked` lays the three tabs out one under the other, for the
   * documentation page, where it is height that is plentiful.
   */
  layout?: 'tabs' | 'stacked';
  /**
   * Another scope answers for this record (ADR-0012 §10): a stand-in, drawn
   * here and defined there.
   *
   * The fields it names are shown read-only with a line saying where they are
   * answered for and a way to go there. Which fields those are is handed in
   * rather than known here — the editor may not know a scope tree exists, and
   * a list kept in two places is a field greyed out on this panel that an
   * agent is allowed to write.
   *
   * Absent is the ordinary case and means this scope answers for everything.
   */
  owned?: {
    /** What to call the owning scope: its path, or the word for the organisation. */
    label: string;
    fields: readonly string[];
    /** Open it. Absent where the host cannot — a test, or a page with nowhere to go. */
    onOpen?(): void;
    /**
     * The owner's description, shown in place of this record's own when
     * `fields` names `description`: maintained where the thing is defined,
     * read here. Absent while the owner has not been read, or has none.
     */
    description?: string;
  };
  /**
   * Ask to move this record to another scope (ADR-0012 §10).
   *
   * A button and a word for it, and nothing else: which gestures are on offer
   * and what each would write are the host's, because a panel that knew would
   * know what a scope tree is. Absent where there is nothing to offer.
   */
  move?: {
    label: string;
    tip: string;
    onMove(): void;
  };
  /**
   * For a platform service: who uses it from outside the team that maintains
   * it, by name (ADR-0014) — the derived answer the *Shared* tick shows beside
   * itself where nobody has ticked. Absent where the host has no tree to read.
   */
  offeredBeyond?: readonly string[];
  /** The technology the rest of the organisation defines, for *Hosted on* and *Uses* (ADR-0017, ADR-0020). */
  technology?: EditorOwnership['technology'];
  /**
   * The door under *Leverages* (ADR-0020): open the technology landscape
   * with this application selected. Absent where the host has no landscape
   * to open, and the line then stands alone.
   */
  onShowOnTechnology?(elementId: ElementId): void;
  /**
   * Make this application's container diagram. Offered as a button on the
   * General tab of an application that has none, because a view is made on
   * purpose: a double-click on the card only OPENS one (`doubleClick.ts`),
   * and a card with nothing inside gives no hint — this button is the hint.
   * Absent where the host cannot, and under `readOnly`.
   */
  onCreateContainer?(elementId: ElementId): void;
  /**
   * For an application or a container: what it leverages, as the host works
   * it out over the whole tree (ADR-0014). Absent = read off this scope's own
   * rows, which is the answer a shell with no tree can give.
   */
  leverage?: LeverageLine;
}
