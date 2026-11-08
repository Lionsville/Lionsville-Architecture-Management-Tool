// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help as one document: its contents on the left, every chapter one after
 * the other on the right, and a search over all of it.
 *
 * Its address is the whole of its state: the language in the query, the place
 * after the `#`. A link from the app, an agent or the README lands on the
 * section it names, and the browser's own Back walks the places read. A search
 * is not a place: it is what is typed, and a hit is a link like any other.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { LANGUAGES, LANGUAGE_NAME, translator } from '../../i18n/strings'
import type { Language } from '../../i18n/languages'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { readHelpAddress } from '../../platform/helpAddress'
import { helpOutline, loadHelpText } from '../registry'
import { helpIndex, searchHelp } from '../helpSearch'
import type { HelpChapterOutline, HelpText } from '../types'
import { HelpDocument, REFERENCE, othersOf } from './HelpDocument'
import { GETTING_STARTED } from '../types'
import './help.css'

type Loaded = { language: Language; text: HelpText } | { language: Language; failed: true }

export function HelpApp({ initial }: { initial: Language }) {
  const [language, setLanguage] = useState<Language>(initial)
  const [loaded, setLoaded] = useState<Loaded | undefined>()
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState(() => readHelpAddress(location.search, location.hash).section)
  const outline = useMemo(() => helpOutline(), [])
  const t = useMemo(() => translator(language), [language])
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let current = true
    loadHelpText(language).then(
      (text) => { if (current) setLoaded({ language, text }) },
      () => { if (current) setLoaded({ language, failed: true }) },
    )
    document.documentElement.lang = language
    return () => { current = false }
  }, [language])

  useEffect(() => {
    // A place chosen — a chapter in the contents, a link — leaves the search for it.
    const moved = () => { setPlace(readHelpAddress(location.search, location.hash).section); setQuery('') }
    addEventListener('hashchange', moved)
    return () => removeEventListener('hashchange', moved)
  }, [])

  const text = loaded && 'text' in loaded && loaded.language === language ? loaded.text : undefined
  useEffect(() => { document.title = `${t('help.title')} · ${t('help.product')}` }, [t])
  // Once the words are there, the place the address names: brought into view and given the focus.
  useEffect(() => {
    if (!text || !place) return
    const target = document.getElementById(place)
    if (!target) return
    // A place inside something folded is unfolded to be read: the reference, a section's example.
    for (let at: HTMLElement | null = target; at; at = at.parentElement) if (at instanceof HTMLDetailsElement) at.open = true
    target.scrollIntoView({ block: 'start' })
    const heading = target.matches('h2, h3, h4') ? target : target.querySelector<HTMLElement>('h2, h3, h4')
    heading?.focus({ preventScroll: true })
    // The contents follow: the place read is the one in view beside it.
    document.querySelector('.help-nav [aria-current]')?.scrollIntoView({ block: 'nearest' })
  }, [text, place])

  useEffect(() => {
    const slash = (event: globalThis.KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) { event.preventDefault(); search.current?.focus() }
    }
    addEventListener('keydown', slash)
    return () => removeEventListener('keydown', slash)
  }, [])

  const choose = (next: Language) => {
    const url = new URL(location.href)
    url.searchParams.set('lang', next)
    history.replaceState(null, '', url)
    setLanguage(next)
    // A query in the old language finds nothing in the new one.
    setQuery('')
  }

  const index = useMemo(() => (text ? helpIndex(outline, text) : []), [outline, text])
  const hits = useMemo(() => searchHelp(index, query), [index, query])
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') setQuery('')
    if (event.key === 'Enter' && hits[0]) {
      // The document is shown again before the address moves, as a pressed hit's link does: a place gone to while
      // the document is hidden is unfolded and scrolled to under React's feet, and the window was left blank.
      const id = hits[0].id
      flushSync(() => setQuery(''))
      location.hash = id
    }
  }

  return (
    <LanguageProvider language={language}>
      <a className="help-skip" href="#help-main">{t('help.skip')}</a>
      <header className="help-head">
        <h1 className="help-head__title"><span>{t('help.product')}</span> {t('help.title')}</h1>
        <div className="help-head__search">
          <input
            ref={search} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onSearchKey}
            aria-label={t('help.search')} placeholder={t('help.searchHint')} aria-controls="help-hits" data-testid="help-search"
          />
          <kbd aria-hidden>/</kbd>
        </div>
        <label className="help-head__language">
          <span>{t('help.language')}</span>
          <select value={language} onChange={(event) => choose(event.target.value as Language)} data-testid="help-language">
            {LANGUAGES.map((one) => <option key={one} value={one}>{t(LANGUAGE_NAME[one])}</option>)}
          </select>
        </label>
      </header>
      <div className="help-body">
        <Contents outline={outline} text={text} place={place} label={t('help.contents')} t={t} />
        <main id="help-main" className="help-main" tabIndex={-1}>
          <div id="help-hits" aria-live="polite">
            {query.trim() && text && <Hits hits={hits} query={query} text={text} t={t} onGo={() => setQuery('')} />}
          </div>
          {!text && <p className="help-state">{loaded && 'failed' in loaded ? t('help.failed') : t('help.loading')}</p>}
          {text && <HelpDocument outline={outline} text={text} t={t} hidden={query.trim().length > 0} />}
        </main>
      </div>
    </LanguageProvider>
  )
}

function Contents({ outline, text, place, label, t }: {
  outline: readonly HelpChapterOutline[]; text: HelpText | undefined; place: string | undefined; label: string; t: ReturnType<typeof translator>
}) {
  const inReference = place?.includes('~') === true && !place.startsWith(`${GETTING_STARTED}~`)
  const of = (chapter: HelpChapterOutline) => chapter.id === place || place === othersOf(chapter.id) || chapter.sections.some((one) => one.id === place) || place?.startsWith(`${chapter.id}~`)
  const open = inReference ? undefined : outline.find(of)?.id
  const openTopic = inReference ? outline.find(of)?.id : undefined
  const reference = outline.filter((chapter) => (text?.background[chapter.id] ?? []).length > 0)
  const startHere = place === undefined || place === GETTING_STARTED || place.startsWith(`${GETTING_STARTED}~`)
  return (
    <nav className="help-nav" aria-label={label}>
      <ol>
        {text?.start && (
          <li><a href={`#${GETTING_STARTED}`} aria-current={startHere ? 'location' : undefined}>{text.start.title}</a></li>
        )}
        {outline.map((chapter) => (
          <li key={chapter.id}>
            <a href={`#${chapter.id}`} aria-current={open === chapter.id && place === chapter.id ? 'location' : undefined}>{text?.chapters[chapter.id]?.title ?? chapter.id}</a>
            {open === chapter.id && text && (
              <ol>
                {chapter.sections.filter((one) => !one.minor).map((one) => (
                  <li key={one.id}>
                    <a href={`#${one.id}`} aria-current={place === one.id ? 'location' : undefined}>{text.sections[one.id]?.[0] ?? one.id}</a>
                  </li>
                ))}
                {/* The tasks a control's label already says are one line here, as they are one list in the chapter. */}
                {chapter.sections.some((one) => one.minor) && (
                  <li>
                    <a href={`#${othersOf(chapter.id)}`} aria-current={place === othersOf(chapter.id) || chapter.sections.some((one) => one.minor && one.id === place) ? 'location' : undefined}>{t('help.others')}</a>
                  </li>
                )}
              </ol>
            )}
          </li>
        ))}
      </ol>
      {text && reference.length > 0 && (
        <>
          <p className="help-nav__group"><a href={`#${REFERENCE}`} aria-current={place === REFERENCE ? 'location' : undefined}>{t('help.reference')}</a></p>
          {(inReference || place === REFERENCE) && <ol className="help-nav__reference">
            {reference.map((chapter) => (
              <li key={chapter.id}>
                <a href={`#${chapter.id}~0`} aria-current={openTopic === chapter.id && place === `${chapter.id}~0` ? 'location' : undefined}>{text.chapters[chapter.id]?.title ?? chapter.id}</a>
                {openTopic === chapter.id && (
                  <ol>
                    {(text.background[chapter.id] ?? []).map((topic, at) => (
                      <li key={at}><a href={`#${chapter.id}~${at}`} aria-current={place === `${chapter.id}~${at}` ? 'location' : undefined}>{topic.title}</a></li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>}
        </>
      )}
    </nav>
  )
}

function Hits({ hits, query, text, t, onGo }: {
  hits: ReturnType<typeof searchHelp>; query: string; text: HelpText; t: ReturnType<typeof translator>; onGo: () => void
}) {
  const said = query.trim()
  if (hits.length === 0) return <p className="help-state">{t('help.noResults', { query: said })}</p>
  return (
    <section className="help-hits" aria-label={t('help.search')}>
      <p className="help-hits__count">{hits.length === 1 ? t('help.resultsOne', { query: said }) : t('help.results', { count: hits.length, query: said })}</p>
      <ol>
        {hits.map((hit) => (
          <li key={hit.id}>
            <a href={`#${hit.id}`} onClick={onGo}>{hit.title}</a>
            <span className="help-hits__where">{t('help.inChapter', { chapter: hit.chapter === GETTING_STARTED ? (text.start?.title ?? hit.chapter) : (text.chapters[hit.chapter]?.title ?? hit.chapter) })}</span>
            <p>{hit.excerpt}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
