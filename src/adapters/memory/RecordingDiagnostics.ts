/**
 * Diagnostics kept and nothing else. For tests.
 *
 * The console adapter's buffer would do as well, except that it also writes to
 * the console — and a suite that deliberately makes twelve things fail would
 * then print twelve red lines that nobody is meant to read. This one is silent,
 * and its clock is a counter so an assertion can name a timestamp.
 */
import { pushBounded, RING_SIZE } from '../../platform/diagnostics'
import type { Diagnostic, DiagnosticEntry } from '../../platform/diagnostics'
import type { Diagnostics } from '../../ports/Diagnostics'

export class RecordingDiagnostics implements Diagnostics {
  readonly id = 'recording'
  private entries: DiagnosticEntry[] = []
  private tick = 0

  constructor(private readonly limit: number = RING_SIZE) {}

  report(entry: Diagnostic): void {
    this.tick += 1
    this.entries = pushBounded(
      this.entries,
      { ...entry, at: `1970-01-01T00:00:${String(this.tick).padStart(2, '0')}.000Z` },
      this.limit,
    )
  }

  recent(): DiagnosticEntry[] {
    return [...this.entries]
  }

  /** What a test usually wants: the messages, in order. */
  messages(): string[] {
    return this.entries.map((entry) => entry.message)
  }
}
