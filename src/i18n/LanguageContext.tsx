import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  translator,
  type Language,
  type StringKey,
  type StringParams,
  type StringTable,
  type Translate,
} from './strings';
import { STRINGS } from './strings';

/**
 * The language the React tree is rendering in.
 *
 * The package owns no storage and no preference — it takes a `language` prop and
 * hands changes back through `onLanguageChange`, the same seam the view
 * preferences use. The default is **English**, deliberately: a component tested
 * in isolation, with no provider around it, renders exactly the English it
 * always did, which is why 466 string-based assertions needed no rewriting.
 */
export interface Strings {
  language: Language;
  /** The whole table for the current language, for a caller that wants the map. */
  s: StringTable;
  /** The lookup, with `{placeholder}` interpolation. */
  t: Translate;
}

const EN_VALUE: Strings = { language: 'en', s: STRINGS.en, t: translator('en') };

const LanguageContext = createContext<Strings>(EN_VALUE);

export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const value = useMemo<Strings>(
    () => ({ language, s: STRINGS[language] ?? STRINGS.en, t: translator(language) }),
    [language],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** `const { t, language } = useStrings()` — the one hook every component uses. */
export function useStrings(): Strings {
  return useContext(LanguageContext);
}

export type { Language, StringKey, StringParams, StringTable, Translate };
