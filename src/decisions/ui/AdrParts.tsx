// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the reader and the writer of a record share: who it names, what acceptance
 * still needs, and the reviewers. Reading and writing draw the same list of what
 * holds a record, so the author sees the rules from the first draft rather than on
 * meeting them.
 */
import type { StringKey, Translate } from '../../i18n'
import { adrGate, adrOptionNames, transitionsFrom } from '../adr'
import type { Adr, AdrGateItem, AdrSigner, AdrVerdict } from '../adr'
import { VERDICT_LABEL } from '../adrScope'
import type { PersonNames } from '../../people/ui/names'
import { PersonRefField } from '../../people/ui/PersonRefField'
import { Button, IconButton } from '../../widgets/kit/Button'
import { Select, TextInput } from '../../widgets/kit/Field'
import { CheckIcon, CloseIcon } from '../../widgets/icons'

/**
 * Who signed, as the record says it (ADR-0036 §8): the name a signature kept
 * where there is one — it stays after the person is forgotten — and what the
 * register says otherwise. Once the signer is forgotten or gone, the kept
 * name is shown alone, and nothing on the page — no pseudonym, no picked
 * person to follow — connects it to the entry.
 */
export function signerText(signer: AdrSigner, names: PersonNames): string {
  return signer.signedAs ?? names.text(signer.name)
}

/** Who proposed it: the name fixed when the record was signed, or what the register says. */
export function proposerText(adr: Pick<Adr, 'proposedBy' | 'proposedAs'>, names: PersonNames): string {
  return adr.proposedAs ?? names.text(adr.proposedBy)
}

/** Each line of a gate, in the words the page says it in. */
const GATE_LABEL: Record<AdrGateItem, StringKey> = {
  context: 'adr.gate.context',
  options: 'adr.gate.options',
  outcome: 'adr.gate.outcome',
  consequence: 'adr.gate.consequence',
  approved: 'adr.gate.approved',
  predecessors: 'adr.gate.predecessors',
  reason: 'adr.gate.reason',
  rejection: 'adr.gate.rejection',
  successor: 'adr.gate.successor',
}

/** What each line looks for: the rule a person would otherwise have to guess. */
export const GATE_HINT: Record<AdrGateItem, StringKey> = {
  context: 'adr.gateHint.context',
  options: 'adr.gateHint.options',
  outcome: 'adr.gateHint.outcome',
  consequence: 'adr.gateHint.consequence',
  approved: 'adr.gateHint.approved',
  predecessors: 'adr.gateHint.predecessors',
  reason: 'adr.gateHint.reason',
  rejection: 'adr.gateHint.rejection',
  successor: 'adr.gateHint.successor',
}

/**
 * The hint for one line. The outcome's also says which names it is looking
 * for, read off this record's options: "names one of the options" is a rule
 * about exact words, and the words are the part nobody can guess.
 */
function gateHint(item: AdrGateItem, body: string, s: Translate): string {
  const rule = s(GATE_HINT[item])
  if (item !== 'outcome') return rule
  const names = adrOptionNames(body)
  return `${rule} ${names.length === 0
    ? s('adr.gateHint.outcomeNone')
    : s('adr.gateHint.outcomeNames', { names: names.map((name) => s('adr.gateHint.quoted', { name })).join(', ') })}`
}

/** The gate to acceptance, while acceptance is still ahead of the record. */
export function acceptGateOf(adr: Adr, list: readonly Adr[]) {
  return adr.status === 'proposed' || transitionsFrom(adr.status).includes('accepted') ? adrGate(adr, 'accepted', { list }) : undefined
}

/** How many lines still hold a record back from acceptance. */
export function stillOpen(adr: Adr, list: readonly Adr[]): number {
  return acceptGateOf(adr, list)?.items.filter((one) => !one.ok).length ?? 0
}

/** What acceptance waits for, as a list: an open line says its rule and goes to where it is answered. */
export function AdrGateList({ adr, list, onGo, s }: {
  adr: Adr
  list: readonly Adr[]
  /** Where a person can act on it; absent, the lines only read. */
  onGo?: (item: AdrGateItem) => void
  s: Translate
}) {
  const gate = acceptGateOf(adr, list)
  if (!gate) return null
  const open = gate.items.filter((one) => !one.ok).length
  return (
    <section className="adr-gate" data-testid="adr-gate">
      <h3>{open > 0 ? s('adr.gateOpen', { count: open }) : s('adr.gateClear')}</h3>
      <ul>
        {gate.items.map(({ item, ok }) => (
          <li key={item} data-gate-item={item} data-ok={ok ? 'true' : 'false'}>
            <span className="adr-gate__mark" aria-hidden="true">{ok && <CheckIcon size={12} />}</span>
            <div>
              {!ok && onGo
                ? <button type="button" className="adr-link" onClick={() => onGo(item)}>{s(GATE_LABEL[item])}</button>
                : <span>{s(GATE_LABEL[item])}</span>}
              {ok && <span className="kit-hidden"> ({s('adr.gateDone')})</span>}
              {!ok && <p>{gateHint(item, adr.body, s)}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

type SignersProps = {
  signers: readonly AdrSigner[]
  names: PersonNames
  s: Translate
  /** A day as the screen says it. */
  day: (value: string) => string
}

/** Who the decision was put to, what they said, and when. */
export function SignersRead({ signers, names, s, day }: SignersProps) {
  return (
    <>
      <p className="adr-note">{s('adr.signersHelp')}</p>
      {signers.length === 0
        ? <p className="adr-note">{s('adr.noSigners')}</p>
        : (
          <table className="adr-table">
            <thead>
              <tr>
                <th scope="col">{s('adr.signerName')}</th><th scope="col">{s('adr.signerRole')}</th>
                <th scope="col">{s('adr.signerVerdict')}</th><th scope="col">{s('adr.signedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {signers.map((signer, index) => (
                <tr key={index}>
                  <td><span data-testid={`adr-signer-${index}`}>{signerText(signer, names)}</span></td>
                  <td>{signer.role ?? ''}</td>
                  <td>{s(VERDICT_LABEL[signer.verdict ?? 'pending'])}</td>
                  <td>{signer.signedAt ? day(signer.signedAt) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </>
  )
}

/**
 * The same table being written. A signer is picked from the register or typed,
 * and the role is typed; the verdict is picked, and picking one stamps today —
 * a signature without a date is not one — and, for a person picked from the
 * register, keeps the name they signed with (ADR-0036 §8), which the page
 * writes beside the id.
 */
export function SignersEdit({ signers, names, s, day, today, onChange }: SignersProps & {
  /** `yyyy-mm-dd`, for a verdict's date. */
  today: () => string
  onChange: (signers: AdrSigner[]) => void
}) {
  const apart = (signer: AdrSigner) => signer.signedAs !== undefined && names.apart(signer.name)
  const edit = (index: number, patch: Partial<AdrSigner>) =>
    onChange(signers.map((signer, at) => (at === index ? { ...signer, ...patch } : signer)))
  const setVerdict = (index: number, verdict: AdrVerdict | 'pending') => {
    const next: AdrSigner = { ...signers[index] } as AdrSigner
    if (verdict === 'pending') { delete next.verdict; delete next.signedAt }
    else { next.verdict = verdict; next.signedAt = today() }
    onChange(signers.map((signer, at) => (at === index ? next : signer)))
  }
  return (
    <>
      <p className="adr-note">{s('adr.signersHelp')}</p>
      {signers.length > 0 && (
        <table className="adr-table">
          <thead>
            <tr>
              <th scope="col">{s('adr.signerName')}</th><th scope="col">{s('adr.signerRole')}</th>
              <th scope="col">{s('adr.signerVerdict')}</th><th scope="col">{s('adr.signedAt')}</th>
              <th scope="col"><span className="kit-hidden">{s('adr.removeColumn')}</span></th>
            </tr>
          </thead>
          <tbody>
            {signers.map((signer, index) => (
              <tr key={index}>
                <td>
                  {/* A signature whose signer is forgotten or gone keeps its name and links to nobody (ADR-0036 §8). */}
                  {apart(signer)
                    ? <span data-testid={`adr-signer-${index}`}>{signerText(signer, names)}</span>
                    : (
                      <PersonRefField
                        value={signer.name} names={names} label={s('adr.signerName')} variant="standard" commit="blur"
                        onChange={(name) => edit(index, { name: name ?? '' })} testId={`adr-signer-${index}`} s={s}
                      />
                    )}
                </td>
                <td><TextInput aria-label={s('adr.signerRole')} value={signer.role ?? ''} onChange={(event) => edit(index, { role: event.target.value || undefined })} /></td>
                <td>
                  <Select
                    aria-label={s('adr.signerVerdict')} value={signer.verdict ?? 'pending'}
                    options={(['pending', 'approved', 'rejected'] as const).map((verdict) => ({ value: verdict, label: s(VERDICT_LABEL[verdict]) }))}
                    onChange={(event) => setVerdict(index, event.target.value as AdrVerdict | 'pending')}
                  />
                </td>
                <td>{signer.signedAt ? day(signer.signedAt) : ''}</td>
                <td>
                  <IconButton label={s('adr.removeSigner', { name: signerText(signer, names) || '…' })} size="small" onClick={() => onChange(signers.filter((_, at) => at !== index))}>
                    <CloseIcon size={12} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Button size="small" onClick={() => onChange([...signers, { name: '' }])}>{s('adr.addSigner')}</Button>
    </>
  )
}
