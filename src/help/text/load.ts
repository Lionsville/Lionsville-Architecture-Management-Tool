// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Core's words, one script per language, fetched when the help opens in it:
 * nobody reading in German downloads the English and the Dutch as well.
 */
import type { Language } from '../../i18n/languages'
import type { HelpText } from '../types'

const LOADERS: Record<Language, () => Promise<{ TEXT: HelpText }>> = {
  en: () => import('./en'),
  nl: () => import('./nl'),
  de: () => import('./de'),
}

export async function loadCoreText(language: Language): Promise<HelpText> {
  return (await LOADERS[language]()).TEXT
}
