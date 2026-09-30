// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { SavedFilters } from '../observations/filter'
import type { WindowChrome } from '../platform/windowChrome'
import type { WorkingSource } from '../platform/workingSource'
import type { ScopeModel, ScopeSnapshot } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import type { AppHost, AppProps } from './appProps'
import type { IndexHook } from './useIndex'
import type { Organisation } from './organisation/useOrganisation'
import type { ProjectSettings } from './ProjectSettingsDialog'
import type { AgentServer } from './useAgentServer'
import type { HomeParts } from './useHomeParts'
import type { MachineSettings } from './useMachineSettings'
import type { useOpenIntoPrompt } from './useOpenIntoPrompt'
import type { usePasswordPrompt } from './usePasswordPrompt'
import type { ProviderParts } from './useProviderParts'
import type { ScopeAncestry } from './useScopeAncestry'
import type { ShellAgent } from './useShellAgent'
import type { ShellCommands } from './useShellCommands'
import type { ShellNavigation } from './useShellNavigation'
import type { ShellServices, useProjectOrder } from './useShellServices'
import type { TreeFindings } from './useTreeFindings'
import type { CarriedOut } from '../ports/Interchange'
import type { AdoptScopes } from './workingFileFlows'

/**
 * The shell's state, as the hooks that hold it hand it out: one object per
 * concern, so a panel names the concerns it reads — the shape
 * `workspaceParts.ts` gives the workspace and `editor/editorParts.ts` the
 * editor body. Built once per render by `App`.
 */
export interface ShellParts {
  props: AppProps
  /** The groups the props left out, filled in: what `App` reads is never absent. */
  source: WorkingSource
  host: AppHost
  hostMenu: boolean
  windowChrome: WindowChrome
  services: ShellServices
  nav: ShellNavigation
  /** The organisation's index (ADR-0012 §2), for both screens. */
  tree: IndexHook
  organisation: Organisation
  findings: TreeFindings
  home: HomeParts
  ancestry: ScopeAncestry
  agentServer: AgentServer
  agent: ShellAgent
  machine: MachineSettings
  commands: ShellCommands
  provider: ProviderParts
  order: ReturnType<typeof useProjectOrder>
  /** The observation filters this person saved, offered in every scope (ADR-0032 §8). */
  savedFilters: SavedFilters
  /** The one password dialog and the one *where does it land* dialog, lent to both file flows (ADR-0023, ADR-0025). */
  prompts: { password: ReturnType<typeof usePasswordPrompt>; openInto: ReturnType<typeof useOpenIntoPrompt> }
  /** What the open workspace is handed to write through: the shell's side of each write it asks for. */
  writes: {
    readTreeModels: () => Promise<ScopeModel[]>
    carryOut: (held: readonly ScopeSnapshot[]) => Promise<CarriedOut>
    adoptScopes: AdoptScopes
    readScope: (path: ScopePath) => Promise<ScopeSnapshot | undefined>
    treeChanged: () => void
    applyProjectSettings: (settings: ProjectSettings, current: ScopeSnapshot) => Promise<void>
  }
  /** Today, read once per render rather than per card. */
  todayDay: string
}
