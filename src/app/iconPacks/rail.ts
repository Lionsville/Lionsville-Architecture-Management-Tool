import type { LogoEntry, LogoPack } from '../../model/logoRegistry';

/**
 * RAIL MARKS — the domain set for a railway landscape.
 *
 * A PACK, and the first one: it ships with this build but is not built in.
 * `app/composition.ts` registers it, which is the whole of its wiring, and
 * deleting that line is the whole of removing it. It lives under `app/` because
 * a general-purpose architecture tool has no business knowing what a catenary
 * is — the model knows what a mark is, and the composition decides which ones
 * this build offers.
 *
 * Same drawing contract as `marks/generic.ts` (one 24×24 stroke path,
 * `currentColor`), and the same promise about keys: `rail-*` keys are persisted
 * on elements and in the interchange `iconType` vocabulary, so they are
 * append-only.
 *
 * EVERY entry carries Dutch keywords, because this is the one category where the
 * word someone types is nearly always the Dutch one — "materieel", "perron",
 * "dienstregeling", "sein", "wissel", "meldkamer", "reisinformatie". The English
 * label is what the picker shows (the UI is English until the i18n phase lands);
 * the keywords are what makes it findable today.
 */

const mark = (key: string, label: string, keywords: string[], path: string): LogoEntry => ({
  key,
  label,
  category: 'rail',
  keywords,
  path,
  render: 'stroke',
});

export const RAIL_MARKS: LogoEntry[] = [
  mark('rail-train', 'Train', ['trein', 'materieel', 'sprinter', 'intercity', 'locomotief'],
    'M7 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 9h14M8.5 13h1M14.5 13h1M8 17l-2 4M16 17l2 4M9 21h6'),
  mark('rail-rolling-stock', 'Rolling stock', ['materieel', 'rijtuig', 'wagon', 'bak', 'vloot'],
    'M3 6h18v9H3zM8 6v9M13 6v9M6.5 19a2 2 0 1 0 0-4a2 2 0 1 0 0 4M17.5 19a2 2 0 1 0 0-4a2 2 0 1 0 0 4'),
  mark('rail-station', 'Station', ['station', 'halte', 'stationsgebouw', 'stationshal'],
    'M2 8l10-5l10 5M4 9v12M20 9v12M2 21h20M8 13h8v5H8zM10 18l-1 3M14 18l1 3'),
  mark('rail-platform', 'Platform', ['perron', 'spoor', 'instappen', 'halte'],
    'M2 17h20v3H2zM5 17V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9M5 11h12M8 14h1.5M13 14h1.5'),
  mark('rail-timetable', 'Timetable', ['dienstregeling', 'rooster', 'vertrekstaat', 'vertrektijden', 'planning'],
    'M3 5h18v13H3zM3 9h18M6 12h6M15 12h3M6 15h4M14 15h4M8 18v2M16 18v2M6 20h12'),
  mark('rail-crew', 'Crew', ['personeel', 'machinist', 'conducteur', 'bemanning', 'dienst'],
    'M12 12a3.2 3.2 0 1 0 0-6.4a3.2 3.2 0 1 0 0 6.4M6 21c1-3.6 3.2-5.5 6-5.5s5 1.9 6 5.5M7 5.5h10M8.8 5.5C9.4 3.9 10.6 3 12 3s2.6.9 3.2 2.5'),
  mark('rail-signalling', 'Signalling', ['sein', 'seinwezen', 'beveiliging', 'ertms', 'atb'],
    'M9 3h6v10H9zM12 13v8M8 21h8M12 5a1.3 1.3 0 1 0 0 2.6a1.3 1.3 0 1 0 0-2.6M12 8.8a1.3 1.3 0 1 0 0 2.6a1.3 1.3 0 1 0 0-2.6'),
  mark('rail-track', 'Track and switch', ['spoor', 'wissel', 'rails', 'baan', 'infra'],
    'M7 21L10 4M17 21L14 4M4 18h16M6 13h12M8 8h8'),
  mark('rail-depot', 'Depot and maintenance', ['onderhoud', 'depot', 'werkplaats', 'opstelterrein', 'revisie'],
    'M2 10l10-6l10 6M4 10v11h16V10M8 21v-6a4 4 0 0 1 8 0v6M2 21h20'),
  mark('rail-control-room', 'Control room', ['meldkamer', 'verkeersleiding', 'regelcentrum', 'bijsturing'],
    'M3 4h8v6H3zM13 4h8v6h-8zM3 12h8v6H3zM13 12h8v6h-8zM8 21h8'),
  mark('rail-passenger-info', 'Passenger information', ['reisinformatie', 'reisinfo', 'omroep', 'vertrektijden'],
    'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7.2v1.4M12 11.5v5.5'),
  mark('rail-travel-card', 'Travel card', ['ov-chipkaart', 'chipkaart', 'check-in', 'poortjes', 'kaartje'],
    'M3 6h18v12H3zM6 9h4v3.5H6zM14.5 10a4 4 0 0 1 0 4M17.5 8.5a6.5 6.5 0 0 1 0 7'),
  mark('rail-camera', 'Camera', ['camera', 'cctv', 'toezicht', 'beeld', 'beveiliging'],
    'M3 8l15-4l1.5 5.5L4.5 13.5L3 8zM6.5 13.2L5 20M2.5 20h7M19.5 9.5L22 8.8M18 13.5v1.5a3 3 0 0 1-3 3h-2'),
];

/** What `registerLogoPack` is handed. The heading's words are in app's slice. */
export const RAIL_PACK: LogoPack = {
  category: 'rail',
  labelKey: 'logo.category.rail',
  marks: RAIL_MARKS,
};
