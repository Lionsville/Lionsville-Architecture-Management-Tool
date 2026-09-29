// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope put back whole as an entry of its history held it: what a scope
 * that could not be read whole is mended with (`ScopeState.unreadable`).
 *
 * Not the model's `restore`, which is a step on a scope that reads and keeps
 * what a restore keeps: a scope that did not read whole takes no such step.
 * It takes one that says what the whole scope is to be, `scope.replace`,
 * expecting the scope as it was just read — so it never lands over a change
 * somebody made in between.
 *
 * **The pictures come back where their bytes are still kept.** A source that
 * keeps its history's bytes puts every one back; one that keeps only what its
 * library names now refuses a picture it no longer has
 * (`shell.imageBytesGone`), and the scope is then put back with the pictures
 * it still holds, and the rest counted for the person to be told. A document
 * that names one left out shows its caption.
 */
import type { HistoryEntry, HistoryRepository } from '../ports/HistoryRepository'
import type { ScopeRepository } from '../ports/ScopeRepository'
import { landed, stepOf } from './scopeAccess'
import type { ScopeContent, ScopeId, ScopeState } from './scopeState'

/** What a state holds that a replace carries. */
function contentOfState(state: ScopeState): ScopeContent {
  const { id: _id, address: _address, revision: _revision, updatedAt: _updatedAt, unreadable: _unreadable, ...content } = state
  return content
}

/**
 * Put one scope back as an entry held it, answering how many of the entry's
 * pictures were no longer kept and were left out; `undefined` where the
 * entry or the scope is not there to be read. A refusal is thrown, as the
 * app's writes throw one (`landed`).
 */
export async function putBackWhole(
  repositories: { scopes: Pick<ScopeRepository, 'state' | 'apply'>; history: Pick<HistoryRepository, 'stateAt'> },
  scope: ScopeId,
  entry: Pick<HistoryEntry, 'id' | 'scope'>,
): Promise<{ left: number } | undefined> {
  const { scopes, history } = repositories
  const [then, now] = await Promise.all([history.stateAt(entry.scope, entry.id), scopes.state(scope)])
  if (!then || !now) return undefined
  const content = contentOfState(then)
  const put = (images: ScopeContent['images']) => scopes.apply([{
    scope, steps: [stepOf({ type: 'scope.replace', content: { ...content, images } })], expects: now.revision,
  }])
  const answer = await put(content.images)
  if (!('refused' in answer) || answer.refused !== 'shell.imageBytesGone') {
    landed(answer)
    return { left: 0 }
  }
  const held = new Set(now.images.map((image) => image.contentAddress))
  const kept = content.images.filter((image) => held.has(image.contentAddress))
  landed(await put(kept))
  return { left: content.images.length - kept.length }
}
