/**
 * The uploaded library, and resolving a key against both sides.
 *
 * The vocabulary itself — the marks, the categories, and the rule for what is
 * built in — is `model/logoRegistry.ts` and has to be, because the interchange
 * export asks whether a key is built in and may not import the editor to find
 * out. What is left here is the half that needs React: the context the uploaded
 * marks arrive through, and the resolver that reads it.
 */
import { createContext, useContext } from 'react';
import { builtInLogo, type LogoEntry } from '../../model/logoRegistry';
import { UPLOADED_KEY_PREFIX } from '../../model/logo';
import type { UploadedLogo } from '../../model/types';

/**
 * The vocabulary, re-exported so a call site keeps one import for "the logo
 * library" whether it needs the data or the hook.
 */
export {
  LOGO_CATEGORIES, LOGO_ENTRIES, isBuiltInLogoKey, logoCategoryLabel, matchesLogoQuery, searchLogos,
} from '../../model/logoRegistry';
export type { LogoCategory, LogoEntry } from '../../model/logoRegistry';
export { UPLOADED_KEY_PREFIX } from '../../model/logo';

const LogoLibraryContext = createContext<UploadedLogo[]>([]);

/** Wraps the editor so nodes and pickers reach uploaded marks without prop drilling. */
export const LogoLibraryProvider = LogoLibraryContext.Provider;

/** The host's uploaded library, or an empty list when it supplied none. */
export function useLogoLibrary(): UploadedLogo[] {
  return useContext(LogoLibraryContext);
}

export type ResolvedLogo =
  | { source: 'builtin'; entry: LogoEntry }
  | { source: 'uploaded'; entry: UploadedLogo };

/**
 * Resolve an `iconKey` against both sources. A `lib:` key looks in the uploaded
 * library FIRST (that prefix is the shell's promise that the mark is an upload,
 * and honouring it means a built-in can never shadow one); every other key looks
 * at the built-ins first. Either way the other side is still consulted, so a key
 * that outlives its namespace still renders.
 *
 * `undefined` for an absent or unresolvable key, so every caller falls back to
 * the kind's glyph.
 */
export function useResolvedLogo(iconKey: string | undefined): ResolvedLogo | undefined {
  const library = useLogoLibrary();
  if (!iconKey) return undefined;
  const builtIn = builtInLogo(iconKey);
  const uploaded = library.find((entry) => entry.key === iconKey);
  if (iconKey.startsWith(UPLOADED_KEY_PREFIX)) {
    if (uploaded) return { source: 'uploaded', entry: uploaded };
    return builtIn ? { source: 'builtin', entry: builtIn } : undefined;
  }
  if (builtIn) return { source: 'builtin', entry: builtIn };
  return uploaded ? { source: 'uploaded', entry: uploaded } : undefined;
}

/**
 * `LogoMark` lives in `PathMark.tsx` — the module that owns mark RENDERING —
 * and is re-exported here so every call site keeps one import for "the logo
 * library". This file stays plain TypeScript: it is the registry and the
 * resolver, and neither needs JSX.
 */
export { LogoMark, PathMark } from './PathMark';
export type { PathMarkProps } from './PathMark';
