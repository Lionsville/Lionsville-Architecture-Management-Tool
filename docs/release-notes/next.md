# Release notes, next version — draft

*What has landed on `main` since 4.0.0 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

## For a build composed from this one

- **A source may say what it cannot keep yet.** `ProviderParts.cannotKeep`
  (`SourceCannotKeep`, `UnkeptPart`, on `composed/process/provider`): asked
  about a part of a record, a provider answers the key of its own sentence, or
  nothing. Where it answers, the field that would have offered the part says
  the sentence instead — today the *About* field of an observation — and an
  agent that names the part is refused `agent.notKeptHere`, a new refusal. The
  three sources that ship say nothing, and nothing changes for them
  (ADR-0022, amended 22 November 2026).
- On the surface, `ProviderParts`, `SessionView` and `AgentRefusal` each
  gained what the line above names; nothing was renamed or removed.
