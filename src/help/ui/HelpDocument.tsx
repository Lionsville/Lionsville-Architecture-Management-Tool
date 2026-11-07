// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every chapter, one after the other: what it is about, a picture of the
 * screen, a worked example, a section per function, and how it works.
 */
import { Fragment, memo } from 'react'
import type { ReactNode } from 'react'
import type { Translate } from '../../i18n/strings'
import { readMarkdown } from '../markdown'
import type { Block, Inline } from '../markdown'
import type { HelpChapterOutline, HelpSectionOutline, HelpText } from '../types'
import { PICTURES } from './pictures'

export const HelpDocument = memo(function HelpDocument({ outline, text, t, hidden }: {
  outline: readonly HelpChapterOutline[]; text: HelpText; t: Translate; hidden: boolean
}) {
  return (
    <div className="help-document" hidden={hidden}>
      {outline.map((chapter) => <Chapter key={chapter.id} chapter={chapter} text={text} t={t} />)}
    </div>
  )
})

function Chapter({ chapter, text, t }: { chapter: HelpChapterOutline; text: HelpText; t: Translate }) {
  const words = text.chapters[chapter.id]
  const Picture = PICTURES[chapter.id]
  const background = text.background[chapter.id] ?? []
  return (
    <section className="help-chapter" aria-labelledby={`${chapter.id}-h`} id={chapter.id}>
      <h2 id={`${chapter.id}-h`} tabIndex={-1}>{words?.title ?? chapter.id}</h2>
      {words?.intro && <p className="help-chapter__intro">{words.intro}</p>}
      {Picture && (
        <figure className="help-figure">
          <div className="help-screen" aria-hidden="true" inert><Picture /></div>
          <figcaption>{words?.picture ?? t('help.picture')}</figcaption>
        </figure>
      )}
      {words?.worked && (
        <div className="help-worked">
          <h3>{t('help.worked')}: {words.worked.title}</h3>
          <ol>{words.worked.steps.map((step, at) => <li key={at}><Words text={step} /></li>)}</ol>
        </div>
      )}
      {chapter.sections.map((one) => <Section key={one.id} outline={one} text={text} t={t} />)}
      {background.length > 0 && (
        <div className="help-background">
          <h3>{t('help.background')}</h3>
          {background.map((topic, at) => (
            <Fragment key={at}>
              <h4 id={`${chapter.id}~${at}`} tabIndex={-1}>{topic.title}</h4>
              {readMarkdown(topic.text).map((block, n) => <MarkdownBlock key={n} block={block} />)}
            </Fragment>
          ))}
        </div>
      )}
      <p className="help-chapter__top"><a href="#help-main">{t('help.toTop')}</a></p>
    </section>
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
      {badges.length > 0 && <p className="help-badges">{badges.map((one) => <span key={one}>{one}</span>)}</p>}
      <p>{what}</p>
      <dl className="help-facts">
        <dt>{t('help.where')}</dt><dd>{where}</dd>
        {keys && <><dt>{t('help.keys')}</dt><dd>{keys}</dd></>}
      </dl>
      {steps.length > 0 && (
        <>
          <p className="help-label">{t('help.steps')}</p>
          <ol className="help-steps">{steps.map((step, at) => <li key={at}>{step}</li>)}</ol>
        </>
      )}
      <p className="help-example"><span>{t('help.example')}</span> {example}</p>
      {seeAlso.length > 0 && (
        <p className="help-see">
          {t('help.seeAlso')}:{' '}
          {seeAlso.map((id, at) => <Fragment key={id}>{at > 0 && ' · '}<a href={`#${id}`}>{text.sections[id][0]}</a></Fragment>)}
        </p>
      )}
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
    case 'code': return <pre><code>{block.text}</code></pre>
    case 'table': return (
      <div className="help-table">
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
