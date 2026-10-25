// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the building-block screens read and write through (ADR-0043): every
 * block in the tree with the scope that keeps it, every scope's evaluation of
 * one, and the changes — a block's in the scope that keeps it, an evaluation's
 * in the scope that evaluates, each under that scope's rights. Handed down
 * once by the home the pages are opened over.
 *
 * A write is said and not awaited where a screen has nothing to wait for:
 * the access lands it, says a refusal, and the screens draw what it reads
 * after.
 */
import { createContext, useContext, type ReactNode } from 'react'
import type { Evaluation } from '../../model/evaluation'
import type { BlockCapability, DesignElement } from '../../model/types'

/** A building block where it is kept. */
export type BlockRow = { readonly scope: string; readonly block: DesignElement }

/** A scope's evaluation of a block. */
export type EvaluationRow = { readonly scope: string; readonly evaluation: Evaluation }

/** What may be changed of a block from its page: its name, its document and its three lists. */
export type BlockPatch = Partial<Pick<DesignElement, 'name' | 'description' | 'capabilities' | 'contexts' | 'sbbs'>>

/** A citation of a principle by the block, read where its page is drawn. */
export type BlockCitation = { readonly label: string; readonly stance: string }

export type BlocksAccess = {
  /** Moves whenever the tree is read again. */
  readonly version: number
  /** Every building block, by where it is kept and then by name. */
  blocks(): readonly BlockRow[]
  block(id: string): BlockRow | undefined
  /** Every scope's evaluation of a block. */
  evaluationsOf(block: string): readonly EvaluationRow[]
  /** The scopes that keep or evaluate a block, at or under a home. */
  blocksAt(path: string): { kept: readonly BlockRow[]; evaluated: readonly BlockRow[] }
  /** May the person change what this scope keeps. */
  mayWrite(scope: string): boolean
  scopeLabel(path: string): string
  /** A principle's aspect as a chip says it, and its title on hover. */
  aspectLabel(aspect: NonNullable<BlockCapability['aspect']>): { label: string; title: string } | undefined
  /** The principles the block cites, read-only here: a citation is made where the block is open. */
  citationsOf(block: string): readonly BlockCitation[]
  /** The principles' aspects in force where a block is kept, for a capability to answer to. */
  aspectChoices(scope: string): readonly { aspect: NonNullable<BlockCapability['aspect']>; label: string }[]
  /** An element a solution is, as a line says it; its id where nobody knows it. */
  elementName(id: string): string
  /** The applications, platforms and services a solution may be: every one in the tree, once. */
  elementChoices(): readonly { id: string; name: string }[]
  /** The scopes a block may be kept in: the topics first, then every scope. */
  placeChoices(): readonly { path: string; name: string }[]
  /** The scopes that may evaluate a block and have not yet. */
  evaluateChoices(block: string): readonly { path: string; name: string }[]
  /** A new building block, kept in `scope`: its id once it is there. */
  create(scope: string, name: string): Promise<string | undefined>
  /** A block's fields changed, as one step in the scope that keeps it. */
  update(block: string, patch: BlockPatch): void
  /** An evaluation started for a scope, with the contexts that apply there, its ratings copied from another scope's where said. */
  evaluate(block: string, scope: string, contexts: readonly string[], copyFrom?: string): Promise<boolean>
  /** A scope's evaluation changed, as one step there. */
  updateEvaluation(scope: string, evaluation: Evaluation): void
  /** A scope's evaluation taken away. */
  removeEvaluation(scope: string, evaluation: string): void
  /** *Propose a decision…* from a scope's evaluation, choosing `option`: the decision's id once it is there. */
  propose(scope: string, block: string, option: string): Promise<string | undefined>
  /** A decision, opened on its scope's decisions page. */
  openDecision(scope: string, id: string): void
  /** A block's page, on a scope's evaluation where one is named. */
  openBlock(block: string, evaluation?: string): void
  makeId(prefix: string): string
  today(): string
}

const BlocksContext = createContext<BlocksAccess | undefined>(undefined)

export function BlocksProvider({ value, children }: { value: BlocksAccess | undefined; children: ReactNode }) {
  return <BlocksContext.Provider value={value}>{children}</BlocksContext.Provider>
}

export function useBlocks(): BlocksAccess | undefined {
  return useContext(BlocksContext)
}
