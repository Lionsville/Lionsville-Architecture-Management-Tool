// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the providers registered in this build bring to the shell (ADR-0022):
 * the session handed to the one that answers for the open source, the chip,
 * the ways in worth drawing here, and the lines in the menu. A provider's own
 * code runs in here, so one that throws costs its own part and nothing else.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SourceChip, SourceMenuEntry, SourceOffer, SourceWayIn } from '../platform/sourceProvider'
import { sourceIsReadOnly, sourceProviderKind } from '../platform/workingSource'
import type { WorkingSource } from '../platform/workingSource'
import type { ShellDiagnostics, SourceOpen } from './App'
import type { AppProvider } from './appProps'
import type { ScopeSession } from './useModelSession'

export type ProviderParts = ReturnType<typeof useProviderParts>

/** No lines and no strips: every build in this repository. */
const NONE: readonly never[] = []

export function useProviderParts(deps: {
  provider: AppProvider
  source: WorkingSource
  diagnostics: ShellDiagnostics
  openSomewhere: SourceOpen
}) {
  const { source, diagnostics, openSomewhere } = deps
  const {
    onWork: onSourceWork, chip: sourceChip, menu: menus = NONE, onScopeSession, chrome: chromes = NONE,
    agentPanel: AgentPanel, chipPanel: ChipPanel, waysIn,
  } = deps.provider
  /**
   * The scope that is open, as whoever answers for the source sees it — held
   * here only so the provider's own chrome can be handed it.
   *
   * The session is made inside the workspace and handed out through
   * `onScopeSession`, which is a subscription and not a render: a strip that has
   * to say something about the open scope cannot reach it any other way. Taken
   * back the moment the workspace lets go, which is every scope switch, so
   * nothing here can name a session whose model has been unmounted.
   *
   * Left undefined where neither the provider nor its chrome asked, so the
   * workspace is handed nothing at all and behaves as it always has.
   */
  const [openScope, setOpenScope] = useState<ScopeSession>()
  const holdScopeSession = useCallback((session: ScopeSession) => {
    setOpenScope(session)
    const stop = onScopeSession?.(session)
    return () => { setOpenScope(undefined); stop?.() }
  }, [onScopeSession])
  // Held for whoever will be handed it, and for nobody else: a subscription per
  // scope ever opened is a leak with a slow fuse, and a build that registered
  // none of these asks the workspace for nothing.
  const takeScopeSession = chromes.length > 0 || menus.length > 0 || onScopeSession || AgentPanel || ChipPanel
    ? holdScopeSession
    : undefined
  /**
   * Which registration answers for the source that is open, so that one chrome
   * is handed the session and the others are not. A built-in source is its own
   * provider's kind, and a registered one names it.
   */
  const openProvider = sourceProviderKind(source)

  /**
   * What the chip on a home says, as the provider says it now.
   *
   * State rather than a read at the draw, because the answer moves without
   * anything on this screen moving: a handshake finishes, somebody signs out,
   * and the name on the chip was decided when the source was opened. The
   * provider says *ask me again* through the one signal it already has, and
   * both this and the word on the bar are re-read from it.
   */
  const [chip, setChip] = useState<SourceChip | undefined>(() => sourceChip?.())
  useEffect(() => {
    if (!sourceChip) { setChip(undefined); return }
    setChip(sourceChip())
    return onSourceWork?.(() => setChip(sourceChip()))
  }, [sourceChip, onSourceWork])

  /**
   * Which ways in are worth drawing here, and what each says — the answer every
   * provider that offers one gives about the source that is open now.
   *
   * A standing button per registration is right on a screen asking where work
   * should live for the first time, and wrong for the provider that already
   * answers for the open source: *connect to…* then offers a person where they
   * already are. Only the provider can tell those apart, so it is asked, and
   * asked HERE rather than at the boot because the answer moves while the window
   * is open — a `useMemo` over the same *ask me again* the chip is re-read on,
   * and afresh per source, because a source that changes is a fresh mount.
   *
   * A provider's own code runs while a screen draws, so one that throws costs
   * its own button the label it asked for and nothing else: the button stands as
   * it was registered, and the trail takes the cause.
   */
  const [askedWaysIn, setAskedWaysIn] = useState(0)
  useEffect(() => onSourceWork?.(() => setAskedWaysIn((n) => n + 1)), [onSourceWork])
  // `askedWaysIn` is a dependency nothing below reads: it is the provider
  // saying its answer has moved, and asking again is the whole of what that
  // means here.
  const offered = useMemo(() => waysInOffered(waysIn, source, diagnostics), [waysIn, source, diagnostics, askedWaysIn])

  /**
   * Every provider's menu lines, asked for at the moment the menu draws them.
   *
   * A provider's own code runs here, so a provider that throws costs its own
   * lines and not the menu: the rest of the list is what a person came to the
   * menu for, and half a menu is worse than a missing section. It goes into the
   * trail the way every other failure in this shell does.
   */
  const sourceEntries = useCallback((): readonly SourceMenuEntry[] => {
    const lines: SourceMenuEntry[] = []
    for (const { kind, menu } of menus) {
      try {
        lines.push(...menu({
          session: kind === openProvider ? openScope : undefined,
          readOnly: sourceIsReadOnly(source),
          open: openSomewhere,
        }))
      } catch (cause) {
        diagnostics.report({ level: 'error', where: 'sourceMenu', message: kind, cause })
      }
    }
    return lines
  }, [menus, openProvider, openScope, source, diagnostics, openSomewhere])

  /**
   * What the menu is given about the providers, and nothing at all where no
   * provider registered a line — so a build with none passes the menu exactly
   * what it always passed, and the section is not there to be empty.
   */
  const overflowSource = menus.length > 0 ? { sourceEntries, onSourceWork } : undefined

  return { chromes, AgentPanel, ChipPanel, openScope, takeScopeSession, openProvider, chip, offered, overflowSource }
}

/** Each way in as its provider now says it: as registered, relabelled, or not drawn at all. */
function waysInOffered(
  waysIn: readonly SourceWayIn[] | undefined, source: WorkingSource, diagnostics: ShellDiagnostics,
): SourceWayIn[] | undefined {
  if (!waysIn) return undefined
  const drawn: SourceWayIn[] = []
  for (const way of waysIn) {
    if (!way.offer) { drawn.push(way); continue }
    let said: SourceOffer | null | undefined
    try {
      said = way.offer(source)
    } catch (cause) {
      diagnostics.report({ level: 'error', where: 'sourceOffer', message: way.kind, cause })
      drawn.push(way)
      continue
    }
    if (said === null) continue
    drawn.push(said ? { ...way, labelKey: said.labelKey } : way)
  }
  return drawn
}
