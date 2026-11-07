// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The source's attachments, for every editor and reader under the shell. Handed
 * down once, as what a document refers to is: no page has to know whether this
 * source keeps files at all. On its own, because the shell holds it and the
 * editor and the link come later.
 */
import { createContext, useContext, type ReactNode } from 'react'
import type { DocumentAttachments } from '../attachments'

const AttachmentsContext = createContext<DocumentAttachments | undefined>(undefined)

export function AttachmentsProvider({ value, children }: { value: DocumentAttachments | undefined; children: ReactNode }) {
  return <AttachmentsContext.Provider value={value}>{children}</AttachmentsContext.Provider>
}

export function useAttachments(): DocumentAttachments | undefined {
  return useContext(AttachmentsContext)
}
