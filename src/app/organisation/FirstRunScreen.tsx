// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The first screen of an organisation nobody has started: name it, look around
 * the example, or carry on with what you have. Where the work will be kept is said
 * before any work exists, with what can lose it. The address stays the home's,
 * so an agent reaches it, and the first step taken leaves it for good.
 */
import { TextSizeControl } from '../../widgets/kit/TextSizeControl'
import { DEFAULT_TEXT_SIZE, TEXT_SIZES } from '../../platform/textSize'
import { useState } from 'react'
import { LANGUAGES, LANGUAGE_NAME } from '../../i18n'
import type { Language, StringKey } from '../../i18n'
import { DESKTOP_APP_LINK } from '../../platform/menu'
import { blank } from '../../projects/scopeAccess'
import { ROOT_SCOPE } from '../../projects/scopePath'
import { Button } from '../../widgets/kit/Button'
import { TextInput, Select } from '../../widgets/kit/Field'
import { FirstRunPage, FirstRunWay } from '../../widgets/kit/FirstRunPage'
import type { ShellParts } from '../shellParts'

/**
 * An organisation with nothing in it and no name, that this person may start, and
 * nothing asked for over it. Only once it is known: a root that holds records and
 * no name is somebody's work, and a listing that would not read is not an empty
 * one, so neither may be met by a page that says nothing is here. `waiting` is the
 * tick before the answer, in which nothing is drawn rather than the wrong screen.
 */
export function firstRunUp(parts: ShellParts): 'up' | 'waiting' | 'no' {
  const { props, nav, organisation, machine, frame, agent } = parts
  if (!props.offersFirstRun || props.visiting || props.provider?.publishesSteps) return 'no'
  if (nav.project || nav.home !== ROOT_SCOPE) return 'no'
  if (machine.open || frame.get().panel !== undefined) return 'no'
  const asked = agent.orgPageRequest
  if (asked && asked.page !== 'home') return 'no'
  if (!organisation.listed || !organisation.ready) return 'waiting'
  const { tree, root } = organisation
  if (organisation.listFailed || (root !== undefined && !blank(root))) return 'no'
  return tree.name.trim() === '' && tree.children.length === 0 && tree.diagrams === 0 && !tree.unreadable?.length && parts.writable(ROOT_SCOPE) ? 'up' : 'no'
}

export function FirstRunScreen({ parts }: { parts: ShellParts }) {
  const { props, services: { s, prefs }, commands: { bus }, organisation, provider } = parts
  const [name, setName] = useState('')
  const ways = provider.offered ?? []
  const said = (key: string) => s(key as StringKey)
  const sayings = props.provider?.sayings
  const place = sayings?.labelKey ? s(sayings.labelKey as StringKey, { name: parts.source.name }) : parts.source.name
  const start = () => { if (name.trim()) organisation.nameOrganisation(name) }
  return (
    <FirstRunPage
      brand={s('first.brand')}
      title={s('first.title')}
      intro={s('first.intro')}
      data-testid="first-run-page"
      tools={(
        <>
          <TextSizeControl size={prefs.textSize} steps={TEXT_SIZES} normal={DEFAULT_TEXT_SIZE} onChoose={prefs.chooseTextSize} />
          <Select
            aria-label={s('prefs.language')} value={prefs.language} onChange={(event) => prefs.chooseLanguage(event.target.value as Language)}
            options={LANGUAGES.map((held) => ({ value: held, label: s(LANGUAGE_NAME[held]) }))} data-guide="first.language"
          />
          <Button size="small" variant="quiet" onClick={() => bus.send({ type: 'manual' })}>{s('menu.userManual')}</Button>
        </>
      )}
      foot={(
        <>
          <div className="kit-firstrun__way-control">
            <span>{place}</span>
            {ways.map((way) => (
              <Button key={way.kind} size="small" variant="quiet" onClick={way.onConnect} data-testid={`first-kept-${way.kind}`}>{said(way.firstLabelKey ?? way.labelKey)}</Button>
            ))}
            {!parts.hostMenu && <Button size="small" variant="quiet" onClick={() => props.hostControls.openExternal(DESKTOP_APP_LINK.href)}>{s(DESKTOP_APP_LINK.label)}</Button>}
          </div>
          {sayings?.riskKey && <p data-testid="first-risk">{said(sayings.riskKey)}</p>}
          <p>{s('first.nothingLeaves')}</p>
        </>
      )}
    >
      <FirstRunWay title={s('first.startOwn')} stacked>
        <TextInput
          autoFocus aria-label={s('first.nameLabel')} placeholder={s('first.nameLabel')} value={name} data-testid="organisation-name-field" data-guide="first.name"
          onChange={(event) => setName(event.target.value)}
          // The Enter it acts on is consumed, so it cannot go on to press whatever button takes the focus next.
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); start() } }}
        />
        <Button variant="primary" disabled={!name.trim()} onClick={start} data-testid="first-run-start">{s('first.start')}</Button>
      </FirstRunWay>
      {props.onVisitExample && props.examples.map((example) => (
        <FirstRunWay key={example.key} title={s('first.lookAround')} body={`${example.description} ${s('first.exampleApart')}`}>
          <Button onClick={() => props.onVisitExample?.(example)} data-testid="open-example" data-guide="first.example">{s('first.openExample')}</Button>
        </FirstRunWay>
      ))}
      <FirstRunWay title={s('first.carryOn')} body={s(ways.length > 0 ? 'first.carryOnBody' : 'first.carryOnFile')}>
        <Button onClick={() => bus.send({ type: 'open' })} data-testid="first-open-file">{s('menu.open')}</Button>
        {ways.map((way) => (
          <Button key={way.kind} onClick={way.onConnect} data-testid={`connect-source-${way.kind}`}>{s('menu.connect')}</Button>
        ))}
      </FirstRunWay>
    </FirstRunPage>
  )
}
