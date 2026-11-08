// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help as it is read: Getting started first, then every chapter — what it
 * is for and what most people do there before any detail, a picture, a worked
 * example folded away, a section per task — and last the reference, each
 * chapter's account of how it works, folded until it is asked for. A place
 * inside something folded is unfolded when it is gone to (`HelpApp`).
 */
import { Fragment, memo } from 'react'
import type { ReactNode } from 'react'
import type { Translate } from '../../i18n/strings'
import { readMarkdown } from '../markdown'
import type { Block, Inline } from '../markdown'
import { GETTING_STARTED } from '../types'
import type { HelpChapterOutline, HelpSectionOutline, HelpText } from '../types'
import { PICTURES } from './pictures'
import { START_PICTURES } from './pictures/start'

export const HelpDocument = memo(function HelpDocument({ outline, text, t, hidden }: {
  outline: readonly HelpChapterOutline[]; text: HelpText; t: Translate; hidden: boolean
}) {
  const reference = outline.filter((chapter) => (text.background[chapter.id] ?? []).length > 0)
  return (
    <div className="help-document" hidden={hidden}>
      {text.start && <GettingStarted start={text.start} t={t} />}
      {outline.map((chapter) => <Chapter key={chapter.id} chapter={chapter} text={text} t={t} />)}
      {reference.length > 0 && (
        <section className="help-chapter help-reference" aria-labelledby={`${REFERENCE}-h`} id={REFERENCE}>
          <h2 id={`${REFERENCE}-h`} tabIndex={-1}>{t('help.reference')}</h2>
          <p className="help-chapter__intro">{t('help.referenceIntro')}</p>
          {reference.map((chapter) => <Background key={chapter.id} chapter={chapter} text={text} t={t} />)}
        </section>
      )}
    </div>
  )
})

/** The address of the reference part, where each chapter's account of how it works is kept. */
export const REFERENCE = 'reference'

/** What the help opens on: a few steps, each a few lines and a picture. */
function GettingStarted({ start, t }: { start: NonNullable<HelpText['start']>; t: Translate }) {
  return (
    <section className="help-chapter help-start" aria-labelledby={`${GETTING_STARTED}-h`} id={GETTING_STARTED}>
      <h2 id={`${GETTING_STARTED}-h`} tabIndex={-1}>{start.title}</h2>
      <p className="help-chapter__intro">{start.intro}</p>
      <ol className="help-start__steps">
        {start.steps.map((step, at) => {
          const Picture = START_PICTURES[at]
          return (
            <li key={at} className="help-start__step" id={`${GETTING_STARTED}~${at}`}>
              <div className="help-start__words">
                <h3 tabIndex={-1}><span className="help-start__n" aria-hidden="true">{at + 1}</span>{step.title}</h3>
                <p><Words text={step.text} /></p>
              </div>
              {Picture && (
                <figure className="help-figure help-figure--small">
                  <div className="help-screen" aria-hidden="true" inert><Picture /></div>
                  <figcaption>{step.picture || t('help.picture')}</figcaption>
                </figure>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Chapter({ chapter, text, t }: { chapter: HelpChapterOutline; text: HelpText; t: Translate }) {
  const words = text.chapters[chapter.id]
  const Picture = PICTURES[chapter.id]
  const first = (chapter.first ?? []).filter((id) => text.sections[id])
  const hasBackground = (text.background[chapter.id] ?? []).length > 0
  return (
    <section className="help-chapter" aria-labelledby={`${chapter.id}-h`} id={chapter.id}>
      <h2 id={`${chapter.id}-h`} tabIndex={-1}>{words?.title ?? chapter.id}</h2>
      {words?.intro && <p className="help-chapter__intro">{words.intro}</p>}
      {first.length > 0 && (
        <p className="help-first">
          <span>{t('help.mostDo')}</span>{' '}
          {first.map((id, at) => <Fragment key={id}>{at > 0 && ' · '}<a href={`#${id}`}>{text.sections[id][0]}</a></Fragment>)}
        </p>
      )}
      {Picture && (
        <figure className="help-figure">
          <div className="help-screen" aria-hidden="true" inert><Picture /></div>
          <figcaption>{words?.picture ?? t('help.picture')}</figcaption>
        </figure>
      )}
      {words?.worked && (
        <details className="help-worked">
          <summary>{t('help.tryIt')}: {words.worked.title}</summary>
          <ol>{words.worked.steps.map((step, at) => <li key={at}><Words text={step} /></li>)}</ol>
        </details>
      )}
      {chapter.sections.map((one) => <Section key={one.id} outline={one} text={text} t={t} />)}
      {hasBackground && <p className="help-see"><a href={`#${chapter.id}~0`}>{t('help.howItWorks', { chapter: words?.title ?? chapter.id })}</a></p>}
    </section>
  )
}

/** A chapter's account of how it works, in the reference part: folded until it is asked for. */
function Background({ chapter, text, t }: { chapter: HelpChapterOutline; text: HelpText; t: Translate }) {
  const title = text.chapters[chapter.id]?.title ?? chapter.id
  return (
    <details className="help-background" data-background={chapter.id}>
      <summary><h3>{title}</h3></summary>
      {(text.background[chapter.id] ?? []).map((topic, at) => (
        <Fragment key={at}>
          <h4 id={`${chapter.id}~${at}`} tabIndex={-1}>{topic.title}</h4>
          {readMarkdown(topic.text).map((block, n) => <MarkdownBlock key={n} block={block} />)}
        </Fragment>
      ))}
      <p className="help-chapter__top"><a href={`#${chapter.id}`}>{t('help.backToChapter', { chapter: title })}</a></p>
    </details>
  )
}

function Section({ outline, text, t }: { outline: HelpSectionOutline; text: HelpText; t: Translate }) {
  const said = text.sections[outline.id]
  if (!said) return null
  const [name, what, where, steps, example, keys] = said
  const badges = [
    outline.on === 'desktop' && t('help.onDesktop'),
    outline.on === 'web' && t('help.onWeb'),
    outline.on === 'hosted' && t('help.onHosted'),
    outline.writes && t('help.writes'),
  ].filter((one): one is string => Boolean(one))
  const seeAlso = (outline.seeAlso ?? []).filter((id) => text.sections[id])
  return (
    <div className="help-section" id={outline.id} data-section={outline.id}>
      <h3 tabIndex={-1}>{name}</h3>
      <p>{what}</p>
      {steps.length > 0 && <ol className="help-steps">{steps.map((step, at) => <li key={at}>{step}</li>)}</ol>}
      <p className="help-facts">
        <span><b>{t('help.where')}</b> {where}</span>
        {keys && <span><b>{t('help.keys')}</b> {keys}</span>}
      </p>
      <details className="help-more">
        <summary>{t('help.example')}{badges.length > 0 ? ` · ${badges.join(' · ')}` : ''}</summary>
        <p className="help-example">{example}</p>
        {badges.length > 0 && <p className="help-badges">{badges.map((one) => <span key={one}>{one}</span>)}</p>}
        {seeAlso.length > 0 && (
          <p className="help-see">
            {t('help.seeAlso')}:{' '}
            {seeAlso.map((id, at) => <Fragment key={id}>{at > 0 && ' · '}<a href={`#${id}`}>{text.sections[id][0]}</a></Fragment>)}
          </p>
        )}
      </details>
    </div>
  )
}

/** A line of the help's own words, which may carry the same bold and code the background does. */
function Words({ text }: { text: string }) {
  return <>{readMarkdown(text).flatMap((block) => (block.kind === 'p' ? [<InlineRun key="p" inline={block.inline} />] : []))}</>
}

function MarkdownBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case 'p': return <p><InlineRun inline={block.inline} /></p>
    case 'ul': return <ul>{block.items.map((item, at) => <li key={at}><InlineRun inline={item} /></li>)}</ul>
    case 'ol': return <ol>{block.items.map((item, at) => <li key={at}><InlineRun inline={item} /></li>)}</ol>
    // Focusable, because a block wider than the column scrolls and the keyboard has to reach it.
    case 'code': return <pre tabIndex={0}><code>{block.text}</code></pre>
    case 'table': return (
      <div className="help-table" tabIndex={0}>
        <table>
          <thead><tr>{block.head.map((cell, at) => <th key={at} scope="col"><InlineRun inline={cell} /></th>)}</tr></thead>
          <tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, at) => <td key={at}><InlineRun inline={cell} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
}

function InlineRun({ inline }: { inline: readonly Inline[] }): ReactNode {
  return inline.map((one, at) => {
    switch (one.kind) {
      case 'text': return <Fragment key={at}>{one.text}</Fragment>
      case 'code': return <code key={at}>{one.text}</code>
      case 'strong': return <strong key={at}><InlineRun inline={one.children} /></strong>
      case 'em': return <em key={at}><InlineRun inline={one.children} /></em>
      case 'link': return <a key={at} href={one.href} target="_blank" rel="noopener noreferrer"><InlineRun inline={one.children} /></a>
    }
  })
}
