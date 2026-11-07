// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two pages a new organisation opens on: what this is and the real ways in,
 * and, once it has a name, what to write down first. A newcomer decides here
 * whether to stay, and a dashboard of twelve empty cards does not help them.
 */
import { useState } from 'react'
import type { StringKey, Translate } from '../../i18n'
import type { Page } from '../../agent/screen'
import type { SourceWayIn } from '../../platform/sourceProvider'
import type { ExampleOffer } from '../../projects/examples/catalogue'
import { Button } from '../../widgets/kit/Button'
import { TextInput } from '../../widgets/kit/Field'
import { FirstRunPage, StructurePicture } from '../../widgets/kit/FirstRun'
import { MenuButton } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { LinkLine } from '../../widgets/kit/Section'

export function FirstChoices({ examples, waysIn, onName, onCopy, onOpenFile, where, places, goPlace, s }: {
  examples: readonly ExampleOffer[]
  waysIn: readonly SourceWayIn[]
  onName: (name: string) => void
  onCopy: (example: ExampleOffer) => void
  onOpenFile?: (() => void) | undefined
  /** Where work is kept, in the source's own sentence. */
  where: string
  places: readonly { readonly page: Page; readonly label: StringKey }[]
  goPlace: (page: Page) => void
  s: Translate
}) {
  const [name, setName] = useState('')
  const start = () => { if (name.trim()) onName(name) }
  const example = examples[0]
  const hasWork = waysIn.length > 0 || onOpenFile !== undefined
  return (
    <FirstRunPage
      data-testid="organisation-first"
      title={s('org.firstTitle')}
      body={s('org.firstBody')}
      picture={(
        <StructurePicture
          label={s('org.firstPicture')} top={s('org.firstPictureTop')}
          middle={[s('org.firstPictureDivision'), s('org.firstPictureTeam'), s('org.firstPictureLandscape')]}
          kept={[s('org.firstPictureViews'), s('org.firstPictureRecords')]}
        />
      )}
      choices={[
        {
          id: 'own', title: s('org.firstOwn'), body: s('org.firstOwnBody'),
          children: (
            <>
              <TextInput
                aria-label={s('org.nameThis')} placeholder={s('org.nameThis')} value={name} data-testid="organisation-name-field"
                onChange={(event) => setName(event.target.value)}
                // The Enter it acts on is consumed, so it cannot go on to press whatever button takes the focus next.
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); start() } }}
              />
              <Button variant="primary" reason={name.trim() ? undefined : s('picker.nameFirst')} onClick={start}>{s('org.firstStart')}</Button>
            </>
          ),
        },
        ...(example ? [{
          id: 'example', title: s('org.firstExample'), body: example.description,
          children: examples.map((one) => <Button key={one.key} data-testid="copy-example" onClick={() => onCopy(one)}>{examples.length === 1 ? s('org.firstCopyOne') : s('org.firstCopy', { name: one.label })}</Button>),
        }] : []),
        ...(hasWork ? [{
          id: 'work', title: s('org.firstWork'), body: s('org.firstWorkBody'),
          children: (
            <>
              {waysIn.map((way) => (
                // The provider's key, from its own table or from this one's (`i18n/registerStrings`); the shell only renders it.
                <Button key={way.kind} data-testid={`connect-source-${way.kind}`} onClick={way.onConnect}>{s(way.labelKey as StringKey)}</Button>
              ))}
              {onOpenFile && <Button data-testid="first-open-file" onClick={onOpenFile}>{s('org.firstOpenFile')}</Button>}
            </>
          ),
        }] : []),
      ]}
      foot={(
        <>
          {where && <span data-testid="organisation-subtitle">{where} </span>}
          <LinkLine label={s('org.firstAnyTime')} links={places.map((place) => ({ label: s(place.label), onPress: () => goPlace(place.page) }))} />
        </>
      )}
    />
  )
}

/** Named and nothing filed: the next step in words, with one main choice among four. */
export function NamedNothingYet({ writable, newView, onNewScope, onObservation, onOperating, where, s }: {
  writable: boolean
  newView: readonly MenuEntry[]
  onNewScope: () => void
  onObservation: () => void
  onOperating: () => void
  where: string
  s: Translate
}) {
  if (!writable) return <p className="kit-factline" data-testid="organisation-subtitle">{where}</p>
  return (
    <FirstRunPage
      data-testid="organisation-next"
      title={s('org.nextTitle')}
      {...(where ? { body: <span data-testid="organisation-subtitle">{where}</span> } : {})}
      choices={[
        { id: 'layout', title: s('org.nextLayout'), body: s('org.nextLayoutBody'), children: <Button variant="primary" data-testid="new-scope" data-guide="org.newScope" onClick={onNewScope}>{s('picker.newScope')}</Button> },
        { id: 'draw', title: s('org.nextDraw'), body: s('org.nextDrawBody'), children: <MenuButton label={s('org.newBoard')} items={newView} data-guide="org.newBoard" data-testid="new-board" /> },
        { id: 'note', title: s('org.nextNote'), body: s('org.nextNoteBody'), children: <Button data-testid="open-observations" data-guide="org.card.observations" onClick={onObservation}>{s('org.stepObservation')}</Button> },
        { id: 'who', title: s('org.nextWho'), body: s('org.nextWhoBody'), children: <Button data-testid="next-operating" onClick={onOperating}>{s('org.nextWhoOpen')}</Button> },
      ]}
    />
  )
}
