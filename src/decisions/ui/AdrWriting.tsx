// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One decision, written, in a full window with nothing else on screen: a box per
 * section, each with the one markdown editor inside, and the whole source one
 * press away, because a heading is changed there, and which then fills the window.
 * The list of what acceptance still needs stays beside the text and follows it,
 * with what is not text under it, the reviewers first because that list asks for
 * them: at the foot of the text they would be a long scroll away or take the
 * editor's height.
 *
 * One save, so one step for Undo and one line in Activity; Cancel asks if anything
 * changed. Every field that changes the record is here, so that reading has none.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Language, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { linkElementRefs } from '../../documentation'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
import type { DocumentImages } from '../../documentation/ui/MarkdownEditor'
import { usePersonNames } from '../../people/ui/names'
import { PersonRefField } from '../../people/ui/PersonRefField'
import { Field, TextField } from '../../widgets/kit/Field'
import { FocusedWindow } from '../../widgets/kit/FocusedWindow'
import { Segmented } from '../../widgets/kit/Segmented'
import { formatAdrNumber, madrTemplate } from '../adr'
import type { Adr, AdrGateItem, AdrPatch } from '../adr'
import { joinSections, sectionOfGate, shownText, splitSections, templateTexts, withText } from '../adrSections'
import { AdrGateList, proposerText, SignersEdit } from './AdrParts'

export type AdrWritingProps = {
  adr: Adr
  /** The list it sits in: what it may supersede, and what the gate reads. */
  list: readonly Adr[]
  /** Where to land: the line of the gate that was pressed. */
  at?: AdrGateItem
  s: Translate
  language: Language
  today: () => string
  elements: readonly { id: string; name: string }[]
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
  onSave: (patch: AdrPatch) => void
  onCancel: () => void
  /** Never saved yet: Save makes it, even with nothing changed since the title. */
  unsaved?: boolean
}

type Mode = 'sections' | 'source'

/**
 * A box per section. The boxes hold what was typed as it was typed, trailing line
 * and all, and the body is worked out from them; a box over the template's own
 * text starts empty, and goes back to that text while it stays so, because what
 * nobody wrote is not to be lost or to read as written.
 */
function SectionBoxes({ body, onBody, s, preview, editor }: {
  body: string
  onBody: (next: string) => void
  s: Translate
  preview: (text: string) => ReactNode
  editor: Pick<AdrWritingProps, 'onAddImage' | 'images'>
}) {
  // The boxes are this mount's; a change of mode remounts them.
  const [start] = useState(() => splitSections(body))
  const template = useMemo(() => templateTexts(s), [s])
  const written = (index: number) => {
    const section = start[index]
    if (!section) return ''
    const text = shownText(section)
    return template.get(section.name) === text ? '' : text
  }
  const [boxes, setBoxes] = useState(() => start.map((_, index) => written(index)))
  const change = (index: number, text: string) => {
    const next = boxes.map((one, at) => (at === index ? text : one))
    setBoxes(next)
    onBody(joinSections(next.reduce((sections, typed, at) => {
      const section = start[at]
      if (!section || (typed === '' && written(at) === '')) return sections
      return withText(sections, at, typed)
    }, start)))
  }
  const own = (index: number) => start[index]?.heading === '' && boxes[index] === ''
  return (
    <>
      {start.map((section, index) => (own(index) && start.length > 1 ? null : (
        <div key={index} id={`adr-write-${index}`} className="adr-box" data-level={section.heading.startsWith('### ') ? 3 : 2}>
          <MarkdownEditor
            variant="field"
            label={section.name || s('adr.sectionBefore')}
            value={boxes[index] ?? ''}
            onChange={(text) => change(index, text)}
            placeholder={s('adr.notWritten')}
            minRows={3}
            renderPreview={preview}
            attachable
            {...editor}
          />
        </div>
      )))}
    </>
  )
}

export function AdrWriting({ adr, list, at, s, language, today, elements, renderMarkdown, onAddImage, images, onSave, onCancel, unsaved = false }: AdrWritingProps) {
  const names = usePersonNames()
  const [title, setTitle] = useState(adr.title)
  const [body, setBody] = useState(adr.body)
  const [signers, setSigners] = useState(adr.signers)
  const [proposedBy, setProposedBy] = useState(adr.proposedBy)
  const [supersedes, setSupersedes] = useState(adr.supersedes ?? [])
  const [mode, setMode] = useState<Mode>('sections')
  const root = useRef<HTMLDivElement>(null)
  const facts = useRef<HTMLDivElement>(null)
  const preview = (text: string) => renderMarkdown(linkElementRefs(text, elements))
  const day = (value: string) => formatDay(value, language)

  const patch: AdrPatch = {
    ...(title !== adr.title ? { title: title.trim() } : {}),
    ...(body !== adr.body ? { body } : {}),
    ...(signers !== adr.signers ? { signers } : {}),
    ...(proposedBy !== adr.proposedBy ? { proposedBy } : {}),
    ...(supersedes !== (adr.supersedes ?? []) && supersedes.join() !== (adr.supersedes ?? []).join() ? { supersedes } : {}),
  }
  const changed = Object.keys(patch).length > 0
  const drafted: Adr = { ...adr, title, body, signers, supersedes }
  const sections = useMemo(() => splitSections(body), [body])
  const supersedable = list.filter((other) => other.id !== adr.id && other.status === 'accepted')

  const goTo = (item: AdrGateItem) => {
    const index = sectionOfGate(sections, item)
    const found = index === undefined
      ? facts.current?.querySelector<HTMLElement>(item === 'approved' ? '[data-testid="adr-signers"]' : '[data-testid="adr-supersedes"]')
      : root.current?.querySelector<HTMLElement>(`#adr-write-${index}`)
    found?.scrollIntoView?.({ block: 'center' })
    found?.querySelector<HTMLElement>('textarea, input')?.focus()
  }
  // Ready to write: the first box, or what answers the line of the gate that was pressed. A frame on,
  // because the window's focus trap takes the focus as it opens.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (at) goTo(at)
      else root.current?.querySelector<HTMLElement>('.adr-box textarea')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  // Where it lands is said once, on arrival.
  }, [])

  return (
    <FocusedWindow
      open
      title={s('adr.writing')}
      number={formatAdrNumber(adr.number)}
      // A decision never saved holds its title as a draft: Cancel drops it, so Cancel asks.
      changed={changed || (unsaved && title.trim() !== '')}
      onSave={() => { if (changed || unsaved) onSave(patch); else onCancel() }}
      saveRefused={title.trim() ? undefined : s('adr.titleNeeded')}
      onCancel={onCancel}
      middle={(
        <Segmented
          label={s('adr.writeHow')}
          value={mode}
          onChange={setMode}
          options={[{ value: 'sections', label: s('adr.writeSections') }, { value: 'source', label: s('adr.writeSource') }]}
        />
      )}
      aside={(
        <div className="adr-write__aside" ref={facts}>
          <AdrGateList adr={drafted} list={list} onGo={goTo} s={s} />
          <section className="adr-section" data-testid="adr-signers" data-guide="decision.signers">
            <h2>{s('adr.signers')}</h2>
            <SignersEdit signers={signers} names={names} s={s} day={day} today={today} onChange={setSigners} />
          </section>
          {adr.proposedAs !== undefined && names.apart(adr.proposedBy)
            ? <Field label={s('adr.proposedBy')}>{() => <span data-testid="adr-proposed-by">{proposerText(adr, names)}</span>}</Field>
            : (
              <PersonRefField
                value={proposedBy} names={names} label={s('adr.proposedBy')} variant="field" commit="blur"
                onChange={(next) => setProposedBy(next)} testId="adr-proposed-by" s={s}
              />
            )}
          {supersedable.length > 0 && (
            <fieldset className="adr-write__supersedes" data-testid="adr-supersedes">
              <legend>{s('adr.supersedesField')}</legend>
              <p className="adr-note">{s('adr.supersedesHelp')}</p>
              {supersedable.map((other) => (
                <label key={other.id}>
                  <input
                    type="checkbox" checked={supersedes.includes(other.id)}
                    onChange={(event) => setSupersedes(event.target.checked ? [...supersedes, other.id] : supersedes.filter((id) => id !== other.id))}
                  />
                  <span>{formatAdrNumber(other.number)} {other.title}</span>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      )}
    >
      <div className="adr-write" ref={root} data-mode={mode} data-guide="decision.writing">
        <TextField label={s('adr.titleField')} value={title} onChange={setTitle} required />
        {mode === 'sections'
          ? <SectionBoxes body={body} onBody={setBody} s={s} preview={preview} editor={{ ...(onAddImage ? { onAddImage } : {}), ...(images ? { images } : {}) }} />
          : (
            <div className="adr-write__source">
              <MarkdownEditor
                variant="pane" label={s('adr.source')} value={body} onChange={setBody} autoFocus renderPreview={preview}
                template={{ label: s('md.fromTemplate'), text: madrTemplate(s) }} attachable
                {...(onAddImage ? { onAddImage } : {})} {...(images ? { images } : {})}
              />
            </div>
          )}
      </div>
    </FocusedWindow>
  )
}
