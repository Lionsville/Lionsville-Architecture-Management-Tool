/**
 * The words themselves live one slice per module (`<module>/strings/en.ts`),
 * composed into the two tables by `strings.en.ts` and `strings.nl.ts`; this
 * suite checks that every registered language table is COMPLETE and consistent,
 * and that the composition itself is sound.
 *
 * Everything below loops over `STRINGS` rather than naming `en` and `nl`. That
 * is the point: adding `strings.de.ts` and one line in the registry brings it
 * under all of these checks without touching this file. TypeScript already
 * guarantees the key set (a table is typed `StringTable`); what it cannot see is
 * an empty value, a dropped `{placeholder}`, or a table that was copied from
 * English and never translated.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRANSLATE,
  LANGUAGES,
  STRINGS,
  detectBrowserLanguage,
  interpolate,
  isLanguage,
  plural,
  t,
  translator,
  type Language,
  type StringKey,
} from './strings';
import { CANVAS_SHORTCUTS } from '../editor/keymap';
import { EN as adaptersEn } from '../adapters/strings/en';
import { EN as appEn } from '../app/strings/en';
import { EN as decisionsEn } from '../decisions/strings/en';
import { EN as documentationEn } from '../documentation/strings/en';
import { EN as editorEn } from '../editor/strings/en';
import { EN as modelEn } from '../model/strings/en';
import { EN as projectsEn } from '../projects/strings/en';
import { EN as searchEn } from '../search/strings/en';
import { EN as commonEn } from './strings/en';

/** Every slice, by the module that owns it — the composition, spelled out once. */
const SLICES: Record<string, Record<string, string>> = {
  adapters: adaptersEn, app: appEn, common: commonEn, decisions: decisionsEn,
  documentation: documentationEn, editor: editorEn, model: modelEn,
  projects: projectsEn, search: searchEn,
};

/** English is the schema, so its keys are THE keys. */
const keys = Object.keys(STRINGS.en) as StringKey[];

/** Every registered language, which is what all the completeness checks run over. */
const languages = Object.keys(STRINGS) as Language[];

/** The other languages: the ones that must differ from the schema's wording. */
const translations = languages.filter((language) => language !== 'en');

const placeholders = (value: string) =>
  (value.match(/\{(\w+)\}/g) ?? []).slice().sort().join(',');

describe('the string registry', () => {
  it('registers at least English and Dutch', () => {
    expect(languages.sort()).toEqual(['en', 'nl']);
  });

  it('offers every registered language in the toggle', () => {
    // A language in the registry but not in LANGUAGES exists and is unreachable.
    expect([...LANGUAGES].sort()).toEqual(languages.slice().sort());
  });

  it('recognises exactly the registered languages', () => {
    for (const language of languages) expect(isLanguage(language), language).toBe(true);
    expect(isLanguage('de')).toBe(false);
  });
});

describe.each(languages)('the %s table is complete', (language) => {
  const table = STRINGS[language];

  it('has exactly the schema keys — none missing, none extra', () => {
    expect(Object.keys(table).sort()).toEqual(keys.slice().sort());
  });

  it('has no empty value', () => {
    for (const key of keys) {
      expect(table[key].trim(), `${language}.${key}`).not.toBe('');
    }
  });

  it('keeps every {placeholder} the schema uses', () => {
    for (const key of keys) {
      expect(placeholders(table[key]), `${language}.${key}`)
        .toBe(placeholders(STRINGS.en[key]));
    }
  });

  it('is reachable through t() for every key', () => {
    for (const key of keys) {
      expect(t(language, key), `${language}.${key}`).toBe(table[key]);
    }
  });
});

describe.each(translations)('the %s table is actually translated', (language) => {
  it('does not simply repeat the English wording', () => {
    // A handful legitimately do (proper nouns, "Actor", "Protocol", …). The test
    // guards the ratio, so a table that was copied from English and never
    // translated fails loudly while a few shared words stay allowed.
    const identical = keys.filter((key) => STRINGS[language][key] === STRINGS.en[key]);
    expect(identical.length).toBeLessThan(keys.length * 0.2);
  });
});

describe('t', () => {
  it('looks a key up in the requested language', () => {
    expect(t('en', 'common.cancel')).toBe('Cancel');
    expect(t('nl', 'common.cancel')).toBe('Annuleren');
  });

  it('interpolates named parameters', () => {
    expect(t('en', 'toolbar.backTo', { name: 'Landscape' })).toBe('Back to Landscape');
    expect(t('nl', 'toolbar.backTo', { name: 'Landschap' })).toBe('Terug naar Landschap');
  });

  it('falls back to English for an unknown language', () => {
    expect(t('de' as Language, 'common.cancel')).toBe('Cancel');
  });

  it('returns the key itself when the key is unknown', () => {
    expect(t('en', 'no.such.key' as StringKey)).toBe('no.such.key');
  });
});

describe('interpolate', () => {
  it('leaves a placeholder standing when no parameter matches', () => {
    expect(interpolate('Back to {name}')).toBe('Back to {name}');
    expect(interpolate('Back to {name}', { other: 'x' })).toBe('Back to {name}');
  });

  it('replaces every occurrence', () => {
    expect(interpolate('{a} and {a} and {b}', { a: 1, b: 2 })).toBe('1 and 1 and 2');
  });
});

describe('translator', () => {
  it('binds a language', () => {
    expect(translator('nl')('common.close')).toBe('Sluiten');
    expect(translator('en')('common.close')).toBe('Close');
  });

  it('defaults to English so pure label tables keep their wording', () => {
    expect(DEFAULT_TRANSLATE('common.close')).toBe('Close');
  });
});

describe('plural', () => {
  it('picks the singular for one and the plural otherwise', () => {
    const keysOf = { one: 'inspector.elementsOne', other: 'inspector.elementsOther' } as const;
    expect(plural(translator('en'), keysOf, 1)).toBe('1 element');
    expect(plural(translator('en'), keysOf, 3)).toBe('3 elements');
    expect(plural(translator('nl'), keysOf, 1)).toBe('1 element');
    expect(plural(translator('nl'), keysOf, 3)).toBe('3 elementen');
  });
});

describe('detectBrowserLanguage', () => {
  it('picks Dutch for any nl- tag', () => {
    expect(detectBrowserLanguage(['nl-NL', 'en-GB'])).toBe('nl');
    expect(detectBrowserLanguage('nl')).toBe('nl');
    expect(detectBrowserLanguage(['NL-be'])).toBe('nl');
  });

  it('picks English for anything else', () => {
    expect(detectBrowserLanguage(['en-US'])).toBe('en');
    expect(detectBrowserLanguage(['de-DE', 'fr'])).toBe('en');
    expect(detectBrowserLanguage([])).toBe('en');
    expect(detectBrowserLanguage(undefined)).toBe('en');
  });

  it('honours order — the first understood tag wins', () => {
    expect(detectBrowserLanguage(['de', 'nl', 'en'])).toBe('nl');
    expect(detectBrowserLanguage(['de', 'en', 'nl'])).toBe('en');
  });

  it('ignores non-string entries', () => {
    expect(detectBrowserLanguage([undefined as unknown as string, 'nl'])).toBe('nl');
  });
});

describe('isLanguage', () => {
  it('accepts only registered languages', () => {
    expect(isLanguage('nl')).toBe(true);
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('de')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
    expect(isLanguage('toString')).toBe(false);
  });
});

describe('the keymap and the tables agree', () => {
  it('gives every shortcut a translated label in every language', () => {
    for (const def of CANVAS_SHORTCUTS) {
      for (const language of languages) {
        expect(t(language, def.labelKey), `${language}.${def.id}`).not.toBe(def.labelKey);
      }
    }
  });
});

describe('the composition', () => {
  it('loses no key: every slice’s keys are in the table', () => {
    const composed = new Set(keys);
    for (const [module, slice] of Object.entries(SLICES)) {
      for (const key of Object.keys(slice)) {
        expect(composed.has(key as StringKey), `${module} owns ${key}, which the table does not have`).toBe(true);
      }
    }
  });

  it('adds no key: the table is exactly the slices together', () => {
    const owned = new Set(Object.values(SLICES).flatMap((slice) => Object.keys(slice)));
    for (const key of keys) {
      expect(owned.has(key), `${key} is in the table but no module owns it`).toBe(true);
    }
  });

  it('lets no two modules define the same key', () => {
    // A spread would silently let the later slice win, and the loser's module
    // would go on believing it owned the word.
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const [module, slice] of Object.entries(SLICES)) {
      for (const key of Object.keys(slice)) {
        const first = owner.get(key);
        if (first) clashes.push(`${key}: ${first} and ${module}`);
        else owner.set(key, module);
      }
    }
    expect(clashes).toEqual([]);
  });
});
