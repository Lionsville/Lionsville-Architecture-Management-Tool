// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the renderer draws, under the text rather than on a card over it, so a
 * writer can read it and go on typing.
 *
 * The syntax column is not translated, because it is not words: it is what a
 * person types, and it is the same in every language. Only the sentence beside
 * each row is. The rows are the renderer's actual vocabulary (`MarkdownView`
 * and the block registry), which is why the picture and file rows are withdrawn
 * where the host cannot take one in: help that describes a thing the page
 * cannot do is not help.
 */
import { useStrings } from '../../i18n/LanguageContext'
import type { StringKey } from '../../i18n'

type Row = { syntax: string; label: StringKey; images?: true; attachments?: true }

/** In the order a writer meets them: structure first, then the things only this app draws. */
const ROWS: readonly Row[] = [
  { syntax: '/', label: 'md.helpSlash' },
  { syntax: '[[ or @', label: 'md.helpRefer' },
  { syntax: '# Title\n## Section\n### Heading', label: 'docHelp.heading' },
  { syntax: '**bold**  _italic_', label: 'docHelp.emphasis' },
  { syntax: '- item\n1. step', label: 'docHelp.lists' },
  { syntax: '- [ ] to do\n- [x] done', label: 'docHelp.tasks' },
  { syntax: '[[Order Management]]', label: 'docHelp.elementLink' },
  { syntax: '[text](https://example.org)', label: 'docHelp.link' },
  { syntax: '![caption](image:file.png)', label: 'docHelp.image', images: true },
  { syntax: '[report.pdf](attachment:…)', label: 'md.helpAttachment', attachments: true },
  { syntax: '![caption](view:id)', label: 'docHelp.view' },
  { syntax: '| a | b |\n|---|---|\n| 1 | 2 |', label: 'docHelp.table' },
  { syntax: '> quoted', label: 'docHelp.quote' },
  { syntax: '`code`\n```\nblock\n```', label: 'docHelp.code' },
  { syntax: '```mermaid\nflowchart LR\n  A --> B\n```', label: 'docHelp.mermaid' },
  { syntax: '```business-case\n…\n```', label: 'docHelp.businessCase' },
  { syntax: '---', label: 'docHelp.rule' },
]

export function MarkdownGuide({ images, attachments }: { images: boolean; attachments: boolean }) {
  const { t } = useStrings()
  const rows = ROWS.filter((row) => (images || !row.images) && (attachments || !row.attachments))
  return (
    <div className="md-editor__guide" data-testid="markdown-help">
      <table>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.syntax}</td>
              <td>{t(row.label)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{images && `${t('docHelp.imagesNote')} `}{t('docHelp.htmlNote')}</p>
    </div>
  )
}
