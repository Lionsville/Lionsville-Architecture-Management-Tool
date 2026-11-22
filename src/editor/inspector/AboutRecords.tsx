// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Decisions about this* and *Observations on this* (ADR-0032, amended 22
 * November 2026): what is said about an element, a short list each, one press
 * to the record on its page. Which decisions touch an application and what is
 * open on it took four presses through another page and a filter; they are
 * read here, where the element is.
 *
 * The host answers (`EditorRecordsAbout`): the editor knows no decision and no
 * scope. Each list says how far it looked where that is less than the tree,
 * and a list with nothing in it says so quietly rather than vanishing, so an
 * empty section is a fact and not a missing one.
 */
import type { Translate } from '../../i18n/strings';
import { PanelLink, PanelSection } from '../../widgets/kit/Panel';
import type { AboutRecordRow, AboutRecords } from '../props';

export type AboutKind = 'decisions' | 'observations';

const WORDS: Record<AboutKind, { title: 'inspector.decisionsAbout' | 'inspector.observationsOn'; none: 'inspector.noDecisionsAbout' | 'inspector.noObservationsOn'; guide: string }> = {
  decisions: { title: 'inspector.decisionsAbout', none: 'inspector.noDecisionsAbout', guide: 'record.decisionsAbout' },
  observations: { title: 'inspector.observationsOn', none: 'inspector.noObservationsOn', guide: 'record.observationsOn' },
};

/** One list's heading, with its count: what the panel's section and the record's rail both say. */
export function aboutHeading(kind: AboutKind, records: AboutRecords, t: Translate): string {
  return t('inspector.aboutCount', { name: t(WORDS[kind].title), count: records[kind].length });
}

/** How far a list looked, where that is less than the reader might think. */
function reach(kind: AboutKind, records: AboutRecords, t: Translate): string | undefined {
  if (kind === 'decisions') return t('inspector.decisionsHere');
  return records.observationsAcross ? undefined : t('inspector.observationsHere');
}

/** One list, unheaded: the record's section under the page's own heading, or the panel's under its own. */
export function AboutList({ kind, records, onOpen, t }: { kind: AboutKind; records: AboutRecords; onOpen(row: AboutRecordRow): void; t: Translate }) {
  const rows = records[kind];
  const said = reach(kind, records, t);
  return (
    <div className="inspector-about" data-testid={`record-${kind}-about`} data-guide={WORDS[kind].guide}>
      {rows.length === 0
        ? <p className="inspector-note">{t(WORDS[kind].none)}</p>
        : (
          <span className="inspector-links">
            {rows.map((row) => (
              <PanelLink key={`${row.scope ?? ''}/${row.id}`} onPress={() => onOpen(row)} data-testid={`about-${row.kind}-${row.id}`}>
                <span className="inspector-about__status" data-tone={row.tone}>{row.status}</span>
                {` ${row.label} ${row.title}`}
                {row.where ? <span className="inspector-about__where">{` · ${row.where}`}</span> : null}
              </PanelLink>
            ))}
          </span>
        )}
      {said && <p className="inspector-note">{said}</p>}
    </div>
  );
}

/** Both lists as the panel's sections, each headed with its count. */
export function AboutSections({ records, onOpen, t }: { records: AboutRecords; onOpen(row: AboutRecordRow): void; t: Translate }) {
  return (
    <>
      {(['decisions', 'observations'] as const).map((kind) => (
        <PanelSection key={kind} title={t(WORDS[kind].title)} aside={String(records[kind].length)}>
          <AboutList kind={kind} records={records} onOpen={onOpen} t={t} />
        </PanelSection>
      ))}
    </>
  );
}
