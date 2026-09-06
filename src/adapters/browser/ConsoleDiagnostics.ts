/**
 * Diagnostics to the console, and to a ring buffer beside it.
 *
 * Two consumers, one report. The console line is for whoever has devtools open
 * — and, on the desktop, for the main process, which relays renderer console
 * output into a log file (`electron/main/index.ts`); the fixed prefix is what
 * makes our lines findable in among React's and the router's. The buffer is for
 * the user, who has no devtools and no log file to find: the crash boundary's
 * "Copy diagnostics" reads it.
 *
 * Reporting must never itself throw — a console that refuses (a sandbox, a page
 * mid-teardown) would otherwise turn one failure into two, and the second one
 * lands inside the handler for the first.
 */
import { pushBounded, formatDiagnostic, RING_SIZE } from '../../platform/diagnostics'
import type { Diagnostic, DiagnosticEntry } from '../../platform/diagnostics'
import type { Diagnostics } from '../../ports/Diagnostics'

/** What our lines start with, so they can be grepped out of everyone else's. */
export const LOG_PREFIX = '[lvarch]'

const METHOD: Record<Diagnostic['level'], 'error' | 'warn' | 'info'> = {
  error: 'error', warn: 'warn', info: 'info',
}

export class ConsoleDiagnostics implements Diagnostics {
  readonly id = 'console'
  private entries: DiagnosticEntry[] = []

  constructor(
    private readonly limit: number = RING_SIZE,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  report(entry: Diagnostic): void {
    const stamped: DiagnosticEntry = { ...entry, at: this.now() }
    this.entries = pushBounded(this.entries, stamped, this.limit)
    try {
      // The cause goes as a second argument rather than into the string: devtools
      // can then expand it, and the relay to the log file still gets the line.
      console[METHOD[entry.level]](`${LOG_PREFIX} ${formatDiagnostic(stamped)}`, entry.cause ?? '')
    } catch {
      // Nothing to do and nowhere to say it. The buffer already has the entry.
    }
  }

  recent(): DiagnosticEntry[] {
    return [...this.entries]
  }
}
