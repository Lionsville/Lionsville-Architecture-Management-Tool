// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The writer's marks, on the field in use, and the three ways of showing the
 * text. A toolbar in the ARIA sense: one stop for Tab, the arrows move along
 * it, and a press leaves the focus in the text.
 */
import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { SurfaceMenu as Menu } from '../../widgets/kit/Surface'
import MenuItem from '@mui/material/MenuItem'
import { EyeIcon, PencilIcon } from '../../widgets/icons'
import { useStrings } from '../../i18n/LanguageContext'
import type { StringKey } from '../../i18n'
import type { Edit, HeadingAt, LineMark, Selected } from '../markdownEditing'
import {
  TABLE_SNIPPET, cycleHeading, insertBlock, insertLink, toggleInline, toggleLineMark,
} from '../markdownEditing'
import { AttachIcon, BulletIcon, CodeIcon, NumberIcon, OutlineIcon, QuoteIcon, SideBySideIcon, TableIcon, TaskIcon } from './markdownIcons'
import { LinkIcon } from '../../widgets/icons'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** A shortcut as this machine says it. */
export function shortcutWord(key: string): string {
  return IS_MAC ? `⌘${key}` : `Ctrl+${key}`
}

type Tool = {
  key: string
  word: StringKey
  shortcut?: string
  mark: ReactNode
  edit(state: Selected, linkWords: string): Edit
}

const line = (mark: LineMark) => (state: Selected) => toggleLineMark(state, mark)

/** One list, so the buttons and the keys cannot come to mean different things. */
const TOOLS: readonly (readonly Tool[])[] = [
  [
    { key: 'heading', word: 'md.heading', mark: <b>H</b>, edit: cycleHeading },
    { key: 'bold', word: 'md.bold', shortcut: 'B', mark: <b>B</b>, edit: (state) => toggleInline(state, '**') },
    { key: 'italic', word: 'md.italic', shortcut: 'I', mark: <i>I</i>, edit: (state) => toggleInline(state, '_') },
    { key: 'code', word: 'md.code', shortcut: 'E', mark: <CodeIcon />, edit: (state) => toggleInline(state, '`') },
    { key: 'link', word: 'md.link', shortcut: 'K', mark: <LinkIcon />, edit: insertLink },
  ],
  [
    { key: 'bullet', word: 'md.bullet', shortcut: '⇧8', mark: <BulletIcon />, edit: line('bullet') },
    { key: 'number', word: 'md.number', shortcut: '⇧7', mark: <NumberIcon />, edit: line('number') },
    { key: 'task', word: 'md.task', shortcut: '⇧9', mark: <TaskIcon />, edit: line('task') },
    { key: 'quote', word: 'md.quote', mark: <QuoteIcon />, edit: line('quote') },
    { key: 'table', word: 'md.table', mark: <TableIcon />, edit: (state) => insertBlock(state, TABLE_SNIPPET) },
  ],
]

/** What a key does, by the same list: `b`, `i`, `e`, `k`, and with shift the digits of the lists. */
export function toolOfKey(key: string, code: string, shift: boolean): Tool | undefined {
  const wanted = shift
    ? { Digit8: '⇧8', Digit7: '⇧7', Digit9: '⇧9' }[code]
    : key.toUpperCase()
  if (!wanted) return undefined
  return TOOLS.flat().find((tool) => tool.shortcut === wanted)
}

/** Move along a toolbar with the arrows, Home and End. */
function moveAlong(event: KeyboardEvent<HTMLElement>) {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
  let next: number | undefined
  if (step !== undefined) next = (at + step + buttons.length) % buttons.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = buttons.length - 1
  if (next === undefined) return
  event.preventDefault()
  buttons[next]?.focus()
}

export function MarkdownToolbar({ onTool, onAttach, toolbarRef }: {
  onTool(tool: Tool): void
  /** Offered only where the source keeps attachments. */
  onAttach?: () => void
  toolbarRef?: React.Ref<HTMLDivElement>
}) {
  const { t } = useStrings()
  const titled = (tool: Tool) => (tool.shortcut ? `${t(tool.word)} (${shortcutWord(tool.shortcut)})` : t(tool.word))
  return (
    <div ref={toolbarRef} className="md-editor__tools" role="toolbar" aria-label={t('md.toolbar')} onKeyDown={moveAlong}>
      {TOOLS.map((group, index) => (
        <span key={group[0]!.key} style={{ display: 'contents' }}>
          {index > 0 && <span className="md-editor__rule" aria-hidden />}
          {group.map((tool) => (
            <button
              key={tool.key} type="button" className="md-editor__tool" title={titled(tool)} aria-label={t(tool.word)}
              tabIndex={tool.key === 'heading' ? 0 : -1} data-tool={tool.key}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onTool(tool)}
            >
              {tool.mark}
            </button>
          ))}
        </span>
      ))}
      {onAttach && (
        <>
          <span className="md-editor__rule" aria-hidden />
          <button
            type="button" className="md-editor__tool" title={t('md.attach')} aria-label={t('md.attach')} tabIndex={-1}
            data-testid="md-attach" onMouseDown={(event) => event.preventDefault()} onClick={onAttach}
          >
            <AttachIcon />
          </button>
        </>
      )}
    </div>
  )
}

export type MarkdownViewMode = 'write' | 'preview' | 'split'

/** Write, Preview, and both side by side where the window has the room. */
export function ViewSwitch({ view, onView, sideBySide, words, single }: {
  view: MarkdownViewMode
  onView(next: MarkdownViewMode): void
  sideBySide: boolean
  /** The words beside the glyphs, where the bar has the room. */
  words: boolean
  /** One button that says where it goes, in a field: its row is shared with the tools, and a panel is narrow. */
  single?: boolean
}) {
  const { t } = useStrings()
  if (single) {
    const next = view === 'write' ? 'preview' : 'write'
    const word = t(next === 'preview' ? 'md.preview' : 'md.write')
    return (
      <button type="button" className="md-editor__tool" aria-label={word} title={word} data-view-mode={next} onMouseDown={(event) => event.preventDefault()} onClick={() => onView(next)}>
        {next === 'preview' ? <EyeIcon size={15} /> : <PencilIcon size={15} />}
      </button>
    )
  }
  const modes: { mode: MarkdownViewMode; word: StringKey; mark: ReactNode }[] = [
    { mode: 'write', word: 'md.write', mark: <PencilIcon size={13} /> },
    { mode: 'preview', word: 'md.preview', mark: <EyeIcon size={13} /> },
    ...(sideBySide ? [{ mode: 'split' as const, word: 'md.sideBySide' as const, mark: <SideBySideIcon size={13} /> }] : []),
  ]
  return (
    <div className="md-editor__switch" role="group" aria-label={t('md.showing')}>
      {modes.map(({ mode, word, mark }) => (
        <button key={mode} type="button" aria-pressed={view === mode} aria-label={t(word)} title={t(word)} onClick={() => onView(mode)} data-view-mode={mode}>
          {mark}{words && t(word)}
        </button>
      ))}
    </div>
  )
}

/** The headings of a long document: press one and the caret, and the preview, go there. */
export function OutlineMenu({ headings, current, onPick }: {
  headings: readonly HeadingAt[]
  current: number
  onPick(heading: HeadingAt): void
}) {
  const { t } = useStrings()
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={anchor} type="button" className="md-editor__tool" title={t('md.outline')} aria-label={t('md.outline')}
        aria-haspopup="menu" aria-expanded={open} data-testid="md-outline" onClick={() => setOpen(true)}
      >
        <OutlineIcon />
      </button>
      <Menu anchorEl={anchor.current} open={open} onClose={() => setOpen(false)} slotProps={{ paper: { sx: { maxHeight: 420, maxWidth: 420 } } }}>
        {headings.map((heading, index) => (
          <MenuItem
            key={`${heading.at}`} dense selected={index === current}
            sx={{ pl: 1 + (heading.level - 1) * 1.5, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
            onClick={() => { setOpen(false); onPick(heading) }}
          >
            {heading.text}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
