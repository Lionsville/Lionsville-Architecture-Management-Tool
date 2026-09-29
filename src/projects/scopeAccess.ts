// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The app's questions about scopes, asked of the repositories (ADR-0031 §1)
 * in the words the screens already use.
 *
 * A screen names a scope by its address and draws a tree of summaries; the
 * repository names one by its identity and answers a tree of nodes. This is
 * the fold between the two, written once: the tree as a summary, a scope read
 * by its address, and a change made to one as steps that expect what was
 * read — and made again, over a scope somebody moved in between, from what
 * it holds now.
 *
 * **A refusal is a `ShellError`** with the repository's key, here and nowhere
 * earlier: the repository answers one as a value, and the screens above have
 * always been handed a refusal they can say (`app/messageFor.ts`).
 */
import type { UploadedLogo } from '../model'
import { ShellError } from '../platform/errors'
import type { IndexedScope, IndexRead } from '../ports/OrganisationIndex'
import type { Created, Refused, ScopeNode, ScopeRepository, ScopeTree } from '../ports/ScopeRepository'
import { SCOPE_MOVED } from './revision'
import { resolveActive } from './scope'
import type { ScopeModel, ScopeSnapshot, ScopeSummary } from './scope'
import { STEP_ELSEWHERE } from './scopeState'
import type { ScopeAddress, ScopeCommand, ScopeId, ScopeRefusal, ScopeState, ScopeStep } from './scopeState'

/** The tree as the screens draw it: one summary per node, the root first. */
export function summaryOf(tree: ScopeTree): ScopeSummary {
  const summary = summaryOfNode(tree.root)
  return tree.unreadable?.length ? { ...summary, unreadable: [...tree.unreadable] } : summary
}

function summaryOfNode(node: ScopeNode): ScopeSummary {
  return {
    path: node.address,
    id: node.id,
    name: node.name,
    ...(node.kind !== undefined ? { kind: node.kind } : {}),
    ...(node.client !== undefined ? { client: node.client } : {}),
    ...(node.description !== undefined ? { description: node.description } : {}),
    ...(node.links !== undefined ? { links: node.links } : {}),
    diagrams: node.diagrams,
    children: node.children.map(summaryOfNode),
    ...(node.updatedAt !== undefined ? { updatedAt: node.updatedAt } : {}),
  }
}

/** Every node of a tree, the root first, depth first. */
export function nodesOf(node: ScopeNode): ScopeNode[] {
  return [node, ...node.children.flatMap(nodesOf)]
}

/** The node at an address, or nothing. */
export function nodeAt(tree: ScopeTree, address: ScopeAddress): ScopeNode | undefined {
  return nodesOf(tree.root).find((node) => node.address === address)
}

/**
 * A scope's state as the app holds one open: its address as a path, the view
 * it opens on resolved against the views it has, and the marks as a list.
 */
export function snapshotOf(state: ScopeState): ScopeSnapshot {
  const { id, address, model, activeDiagramId, logoLibrary, kind, client, links, updatedAt, unreadable, revision } = state
  return {
    path: address,
    id,
    model,
    activeDiagramId: resolveActive(model, activeDiagramId),
    logoLibrary: [...(logoLibrary ?? [])] as UploadedLogo[],
    ...(kind !== undefined ? { kind } : {}),
    ...(client !== undefined ? { client } : {}),
    ...(links !== undefined ? { links } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(unreadable?.length ? { unreadable } : {}),
    revision,
  }
}

/** The part of a repository a read by address takes. */
export type ScopeReader = Pick<ScopeRepository, 'tree' | 'state'>

/** One scope, by its address; `undefined` where no scope is there. */
export async function readScope(scopes: ScopeReader, address: ScopeAddress): Promise<ScopeSnapshot | undefined> {
  const node = nodeAt(await scopes.tree(), address)
  const state = node && await scopes.state(node.id)
  return state && snapshotOf(state)
}

/** Every scope's records and rows, as the index folds them (`scopeIndex.ts`). */
export function modelsOf(read: IndexRead): ScopeModel[] {
  return read.scopes.map(modelOf)
}

export function modelOf(scope: IndexedScope): ScopeModel {
  return { path: scope.address, model: scope.model }
}

/** A step, minted here: one command, with a name nobody else will give one. */
export function stepOf(command: ScopeCommand, at = Date.now()): ScopeStep {
  return { stepId: crypto.randomUUID(), command, at }
}

/**
 * A refusal, as what the app throws: a `ShellError` with its key — but a step
 * sent to the wrong scope is a fault in whoever sent it, with no sentence for
 * a person, and is thrown as the fault it is.
 */
export function refusedError(refused: ScopeRefusal): Error {
  return refused === STEP_ELSEWHERE ? new Error(`a step was sent to a scope it was not made for (${refused})`) : new ShellError(refused)
}

/** The answer, or the refusal it was, thrown. */
export function landed<T extends object>(answer: T | Refused): T {
  if ('refused' in answer) throw refusedError(answer.refused)
  return answer
}

/** How many times a change is made again over a scope that moved before it lands. */
export const CHANGE_TRIES = 3

/**
 * Change one scope: read it, work out the commands from what it holds, and
 * apply them expecting what was read.
 *
 * Nothing to do — `change` answers nothing, or no command — is an answer, and
 * nothing is applied. Over a scope somebody changed in between, the change is
 * worked out again from what it holds now, a few times, and then the refusal
 * is said: a change made from a state nobody read is the write this exists to
 * avoid. What comes back is the scope as the change left it.
 */
export async function changeScope(
  scopes: ScopeReader & Pick<ScopeRepository, 'apply'>,
  address: ScopeAddress,
  change: (held: ScopeSnapshot) => readonly ScopeCommand[] | undefined,
): Promise<ScopeSnapshot | undefined> {
  for (let tried = 1; ; tried += 1) {
    const held = await readScope(scopes, address)
    if (!held?.id) return undefined
    const commands = change(held)
    if (!commands?.length) return held
    const answer = await scopes.apply([{ scope: held.id, steps: commands.map((command) => stepOf(command)), expects: held.revision }])
    if (!('refused' in answer)) return readScope(scopes, address)
    if (answer.refused !== SCOPE_MOVED || tried >= CHANGE_TRIES) throw refusedError(answer.refused)
  }
}

/**
 * A scope at an address, made there where there is none: its identity either
 * way. The scopes above it that are not there are made too — the repository's
 * rule, since a scope filed under nothing would be addressed by nothing.
 */
export async function ensureScope(
  scopes: Pick<ScopeRepository, 'tree' | 'create'>,
  address: ScopeAddress,
  scope: { name: string; kind?: ScopeSnapshot['kind'] },
): Promise<ScopeId> {
  const held = nodeAt(await scopes.tree(), address)
  if (held) return held.id
  const answer: Created | Refused = await scopes.create(address, scope)
  // Somebody made one there in between: theirs is the one.
  if ('refused' in answer && answer.refused === 'shell.scopeTaken') {
    const theirs = nodeAt(await scopes.tree(), address)
    if (theirs) return theirs.id
  }
  return landed(answer).id
}

