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
import type { Command } from '../model/commands'
import type { HostModel } from '../model/fromInterchange'
import type { IdPolicy, MakeId } from '../model/keys'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import type { Translate } from '../i18n/strings'
import { answer } from './answer'
import type { ReadTool } from './answer'
import { commandFor } from './commandFor'
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
  /**
   * The one way in (ADR-0002): apply a command at the session, so it is one
   * undo step and one Activity line. Answers with nothing when the reducer
   * refused, which the handler has already asked about itself.
   */
  dispatch(command: Command, options?: { activeDiagramId?: string }): HostModel | undefined
  /** Where a new element's or connection's id comes from. The session's, so nothing collides. */
  ids: IdPolicy
  /** Where a diagram's or a decision's id comes from. */
  makeId: MakeId
  /** Today as `yyyy-mm-dd`, for a decision's date. */
  today(): string
  translate: Translate
  /** What a container view is called, after its application. */
  containerName(applicationName: string): string
}

export function handle(request: AgentRequest, session: SessionView): AgentAnswer {
  if (!isToolName(request.tool)) return refused('agent.unknownTool', request.tool)
  const spec = toolSpec(request.tool)
  const view = {
    model: session.indexed(),
    current: session.current,
    activeDiagramId: session.activeDiagramId(),
    groupDecisions: session.groupDecisions(),
  }
  if (spec.tier === 'read') return answer(request.tool as ReadTool, request.args, view)

  const blocked = session.blocked()
  if (blocked) return refused(blocked)
  const prepared = commandFor(request.tool, request.args, {
    ...view,
    ids: session.ids,
    makeId: session.makeId,
    today: session.today,
    translate: session.translate,
    containerName: session.containerName,
  })
  if ('ok' in prepared) return prepared

  // Asked of the reducer first, so a refusal comes back with its reason: the
  // session shows one to the person and answers with nothing, and an agent
  // needs the key. Applying twice is cheap; a command touches the path it
  // names and copies nothing else.
  const trial = apply(view.model, prepared.command)
  if (!trial.ok) return refused(trial.reason)
  session.dispatch(prepared.command, prepared.activeDiagramId ? { activeDiagramId: prepared.activeDiagramId } : undefined)
  return prepared.answer
}
