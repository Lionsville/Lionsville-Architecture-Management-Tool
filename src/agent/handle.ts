/**
 * One request in, one answer out: the handler the shell binds to the seam.
 *
 * It takes the session as a *narrow* view — what it needs and nothing wider,
 * the way every consumer in this codebase declares its interface — so that it
 * is tested in node over the real reducer with no window, the arrangement
 * `editor/testing/editorHost` uses for the editor.
 *
 * Everything about a call may say no, and every no is a key from
 * `tools.ts`: a tool nobody registered, arguments that do not fit, a session
 * that is waiting on a person. The reducer's own refusals pass through.
 */
import type { Adr } from '../model/adr'
import type { HostModel } from '../model/fromInterchange'
import type { Model } from '../model/normalised'
import { answer } from './answer'
import type { AgentAnswer, AgentRefusal, AgentRequest } from './tools'
import { isToolName, refused, toolSpec } from './tools'

/** What the handler needs from the live session. Every one of these is on `ModelSession`. */
export type SessionView = {
  /** The model as a command is built against. */
  indexed(): Model
  /** The same model as the file has it, cached by the session. */
  current(): HostModel
  activeDiagramId(): string
  /** The group's own records, which live beside the project rather than on it. */
  groupDecisions(): readonly Adr[]
  /**
   * Why nothing may change right now, or nothing: the person is resolving a
   * conflict, or the project is read-only. A read still answers.
   */
  blocked(): Extract<AgentRefusal, 'agent.conflict' | 'agent.readOnly'> | undefined
}

export function handle(request: AgentRequest, session: SessionView): AgentAnswer {
  if (!isToolName(request.tool)) return refused('agent.unknownTool', request.tool)
  const spec = toolSpec(request.tool)
  if (spec.tier === 'read') {
    return answer(request.tool, request.args, {
      model: session.indexed(),
      current: session.current,
      activeDiagramId: session.activeDiagramId(),
      groupDecisions: session.groupDecisions(),
    })
  }
  const blocked = session.blocked()
  if (blocked) return refused(blocked)
  // The write and see tiers land in later steps of ADR-0007; until then a
  // tool of theirs is one the list does not carry, and this line is unreachable.
  return refused('agent.unknownTool', request.tool)
}
