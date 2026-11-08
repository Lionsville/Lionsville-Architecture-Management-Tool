// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One small screen per chapter, drawn from the example organisation's neutral
 * names and the app's own words for its controls. Each is a picture, not a
 * control: the help hides it from the keyboard and from a screen reader, and
 * says in its caption what it shows.
 */
import type { ReactNode } from 'react'
import { Card } from '../../../widgets/kit/Card'
import { Mark } from '../../../widgets/kit/Mark'
import { useStrings } from '../../../i18n/LanguageContext'
import { Btn, Chip, Rows, Say, Screen, SidePanel, Tree, ViewBar } from './parts'

const TRAIL = ['Acme Logistics', 'Warehouse', 'Application landscape']
const TREE = <Tree at="Warehouse" rows={[['Acme Logistics', 0], ['Warehouse', 1], ['Application landscape', 2], ['Shared platforms', 1], ['Topics', 1]]} />
const VIEWS = ['Application landscape', 'Landscape in 2027']

export function StartPicture() {
  return (
    <div className="hp-window hp-first" style={{ height: 250 }}>
      <div className="hp-first__head">Lionsville Architect</div>
      <div className="hp-first__ways">
        <div className="hp-first__way"><b><Say k="first.start" /></b><span className="hp-field">Acme Logistics</span><Btn primary><Say k="first.start" /></Btn></div>
        <div className="hp-first__way"><b><Say k="first.lookAround" /></b><span>Acme Logistics</span><Btn><Say k="first.openExample" /></Btn></div>
        <div className="hp-first__way"><b><Say k="first.carryOn" /></b><Btn><Say k="menu.open" /></Btn><Btn><Say k="menu.connect" /></Btn></div>
      </div>
    </div>
  )
}

export function FramePicture() {
  return (
    <Screen trail={TRAIL.slice(0, 2)} tree={TREE} tabs={[<Say key="d" k="shell.decisions" />, <Say key="o" k="shell.observations" />, <Say key="r" k="shell.roadmap" />]}>
      <div className="hp-home">
        <div className="hp-home__title">Warehouse</div>
        <Rows title={<Say k="org.viewsHere" />} rows={VIEWS.map((view) => <span key={view}>{view}</span>)} />
        <Rows title={<Say k="org.keptHere" />} rows={[<span key="d"><Say k="shell.decisions" /> · 2</span>, <span key="o"><Say k="shell.observations" /> · 3</span>, <span key="r"><Say k="shell.roadmap" /> · 2</span>]} />
      </div>
    </Screen>
  )
}

export function WorkPicture() {
  return (
    <Screen crop trail={TRAIL.slice(0, 1)} tree={TREE} height="auto">
      <div className="hp-split">
        <div className="hp-home"><div className="hp-home__title">Acme Logistics</div><Rows title={<Say k="org.viewsHere" />} rows={VIEWS.map((view) => <span key={view}>{view}</span>)} /></div>
        <SidePanel kind={<Say k="frame.yourWork" />} name="~/Documents/acme" facts={<Say k="shell.sourceBrowser" />} rows={[
          [<Say key="a" k="menu.exportWorkingFile" />, ''], [<Say key="b" k="menu.snapshot" />, ''], [<Say key="c" k="menu.history" />, ''], [<Say key="d" k="menu.open" />, ''],
        ]} />
      </div>
    </Screen>
  )
}

export function BoardPicture() {
  return (
    <Screen crop trail={TRAIL} tabs={VIEWS} on={0} height="auto">
      <ViewBar items={[<Say key="a" k="shell.add" />, <Say key="b" k="bar.arrange" />, <Say key="c" k="landscape.show" />, <Say key="d" k="kit.colour" />, <Say key="e" k="kit.day" />]} />
      <div className="hp-split">
        <div className="hp-canvas">
          <div className="hp-band">Order to delivery</div>
          <div className="hp-cards">
            <Card name="Order Management" sub={<Say k="lifecycle.live" />} marks={<><Mark kind="managed" /><Mark kind="partial" /></>} />
            <Card name="Dispatch" sub={<Say k="lifecycle.live" />} selected marks={<Mark kind="managed" />} />
            <Card name="Rating (legacy)" sub={<Say k="lifecycle.retiring" />} marks={<Mark kind="risk" />} />
          </div>
          <div className="hp-line">routes · REST</div>
        </div>
        <SidePanel kind="Application" name="Dispatch" facts={<><Say k="lifecycle.live" /> · 6 · 1</>} tabs={[<Say key="p" k="inspector.properties" />, <Say key="a" k="tab.appearance" />, <Say key="c" k="comments.title" />]} rows={[
          [<Say key="l" k="register.colLifecycle" />, <Say key="v" k="lifecycle.live" />], [<Say key="o" k="register.colOwner" />, 'Warehouse team'], [<Say key="c" k="register.colCategory" />, 'Planning'],
        ]} />
      </div>
    </Screen>
  )
}

export function PanelPicture() {
  return (
    <Screen crop trail={TRAIL} tabs={VIEWS} on={0}>
      <div className="hp-split hp-split--wide">
        <div className="hp-record">
          <div className="hp-home__title">Warehouse Management</div>
          <p className="hp-text">Runs the warehouse: receiving, slotting, picking and shipping.</p>
          <Rows title={<Say k="inspector.properties" />} rows={[
            <span key="a"><Say k="register.colLifecycle" />: <Say k="lifecycle.live" /></span>,
            <span key="b"><Say k="register.colOwner" />: Warehouse team</span>,
            <span key="c"><Say k="register.colTechnology" />: Java</span>,
          ]} />
        </div>
        <SidePanel kind="Application" name="Warehouse Management" tabs={[<Say key="p" k="inspector.properties" />, <Say key="a" k="tab.appearance" />, <Say key="c" k="comments.title" />]} rows={[
          [<Say key="l" k="register.colLifecycle" />, <Say key="v" k="lifecycle.live" />], [<Say key="o" k="register.colOwner" />, 'Warehouse team'], ['+', <Say key="m" k="inspector.more" />],
        ]} />
      </div>
    </Screen>
  )
}

export function TechnologyPicture() {
  const column = (title: ReactNode, rows: string[], picked?: string) => (
    <div className="hp-column"><div className="hp-rows__title">{title}</div>{rows.map((row) => <div key={row} className="hp-tech" data-on={row === picked || undefined}>{row}</div>)}</div>
  )
  return (
    <Screen crop trail={['Acme Logistics', 'Shared platforms']} tabs={['Technology landscape']} on={0}>
      <div className="hp-columns">
        {column(<Say k="landscape.applications" />, ['Order Management', 'Warehouse Management', 'Billing', 'Dispatch'], 'Warehouse Management')}
        {column(<Say k="register.tabServices" />, ['Container platform', 'Message brokering', 'Managed database', 'Identity'], 'Container platform')}
        {column(<Say k="landscape.platforms" />, ['Cloud environment', 'OpenShift  16', 'Event broker'], 'OpenShift  16')}
      </div>
    </Screen>
  )
}

export function SheetPicture() {
  const tile = (name: string, tone: 'apps' | 'people' | 'none') => <span key={name} className="hp-tile" data-tone={tone}>{name}</span>
  return (
    <Screen crop trail={['Acme Logistics']} tabs={['Business architecture']} on={0}>
      <ViewBar items={[<Say key="p" k="sheet.reading.poster" />, <Say key="n" k="sheet.reading.names" />, <Say key="c" k="shell.newMap" />, <Say key="k" k="kit.colour" />]} />
      <div className="hp-journey">{['Sell', 'Plan', 'Move', 'Bill'].map((phase) => <span key={phase}>{phase}</span>)}</div>
      <div className="hp-areas">
        <div className="hp-area"><b>Commercial</b>{tile('Quote', 'apps')}{tile('Key accounts', 'people')}</div>
        <div className="hp-area"><b>Operations</b>{tile('Dispatch', 'apps')}{tile('Dangerous goods', 'none')}</div>
        <div className="hp-area"><b>Finance</b>{tile('Invoicing', 'apps')}{tile('Claims settlement', 'none')}</div>
      </div>
      <div className="hp-key"><Mark kind="cov-apps" /> <Say k="sheet.coverage" /> · <Mark kind="cov-people" /> · <Mark kind="cov-none" /></div>
    </Screen>
  )
}

export function PosterPicture() {
  return (
    <Screen crop trail={['Acme Logistics']} tabs={['Business architecture']} on={0}>
      <ViewBar items={[<Say key="p" k="sheet.reading.poster" />, <span key="r"><b><Say k="doc.read" /></b> | <Say k="sheet.poster.design" /></span>, <Say key="k" k="kit.colour" />, <Say key="d" k="kit.day" />]} />
      <div className="hp-poster">
        <div className="hp-poster__journey">Ship a consignment</div>
        {['Commercial', 'Operations', 'Finance', 'Assets and fleet'].map((area, at) => (
          <div key={area} className="hp-poster__block"><b>{area}</b><div className="hp-poster__tiles">{[0, 1, 2, 3].map((n) => <span key={n} className="hp-tile" data-tone={(n + at) % 3 === 0 ? 'none' : (n + at) % 3 === 1 ? 'apps' : 'people'} />)}</div></div>
        ))}
      </div>
    </Screen>
  )
}

export function ChartPicture() {
  // The example's names are its own and stay English; the word for a role nobody holds is the chart's.
  const { t } = useStrings()
  const vacant = t('unit.vacant').replace(/^\+\s*/, '')
  const box = (type: string, name: string, roles: [string, string][]) => (
    <div className="hp-unit"><div className="hp-unit__type">{type}</div><b>{name}</b>{roles.map(([role, who]) => <div key={role} className="hp-unit__role">{role}: <span data-vacant={who === '' || undefined}>{who || vacant}</span></div>)}</div>
  )
  return (
    <Screen crop trail={['Acme Logistics']} tabs={['Organisation chart']} on={0}>
      <ViewBar items={[<Say key="l" k="map.levels" />, <Say key="p" k="org.people" />, <Say key="n" k="conway.lines" />, '+', <Say key="d" k="kit.day" />]} />
      <div className="hp-chart">
        {box('Department', 'Terminal', [['Head', 'Anna de Vries']])}
        <div className="hp-chart__row">
          {box('Team', 'Dock crew', [['Lead', 'Tom Berger'], ['Member', '']])}
          {box('Team', 'Yard crew', [['Lead', 'Lena Fischer']])}
          {box('Team', 'Warehouse team', [['Lead', '']])}
        </div>
      </div>
    </Screen>
  )
}

export function DrawingPicture() {
  return (
    <Screen crop trail={TRAIL} tabs={['Application landscape', 'Dock flow']} on={1}>
      <ViewBar items={['Dock flow', '3 links', <Say key="e" k="drawing.edit" />, 'Export…']} />
      <div className="hp-drawing">
        <span className="hp-shape" data-linked>Warehouse Management</span>
        <span className="hp-arrow">→</span>
        <span className="hp-shape">Dock door</span>
        <span className="hp-arrow">→</span>
        <span className="hp-shape" data-linked>Dispatch</span>
      </div>
    </Screen>
  )
}

export function DecisionsPicture() {
  return (
    <Screen crop trail={TRAIL} tabs={VIEWS} on={undefined}>
      <div className="hp-split hp-split--wide">
        <div>
          <Rows title={<Say k="adr.groupOpen" />} rows={['ADR-0003 Keep carrier rates in the tariff engine']} />
          <Rows title={<Say k="adr.groupInForce" />} rows={['ADR-0002 Buy a yard system', 'ADR-0001 One place where a price is decided']} />
          <Rows title={<Say k="adr.groupEnded" />} rows={[]} />
        </div>
        <div className="hp-record">
          <div className="hp-steps"><span data-done><Say k="adr.statusProposed" /></span><span data-on><Say k="adr.statusReviewing" /></span><span><Say k="adr.statusAccepted" /></span></div>
          <div className="hp-home__title">ADR-0003 Keep carrier rates in the tariff engine</div>
          <p className="hp-text">Context and problem statement. Considered options. Decision outcome.</p>
        </div>
      </div>
    </Screen>
  )
}

export function ObservationsPicture() {
  const node = (label: string, title: string, kind: 'obs' | 'cause' | 'root' | 'sol') => <div className="hp-node" data-kind={kind}><b>{label}</b> {title}</div>
  return (
    <Screen crop trail={TRAIL} tabs={[<Say key="o" k="shell.observations" />]} on={0}>
      <ViewBar items={[<Say key="s" k="observation.stageSeen" />, <b key="w"><Say k="observation.stageWhy" /></b>, <Say key="v" k="observation.stageSolve" />, <Say key="r" k="observation.stageResults" />]} />
      <div className="hp-lanes">
        <div>{node('OB-0001', 'Quoted one price, billed another', 'obs')}{node('OB-0002', 'Two delivery estimates', 'obs')}</div>
        <div>{node('CA-0001', 'Two systems compute a price', 'cause')}</div>
        <div>{node('RC-0004', 'Pricing rules have no single owner', 'root')}</div>
        <div>{node('SO-0001', 'One place where a price is decided', 'sol')}</div>
      </div>
    </Screen>
  )
}

export function RoadmapPicture() {
  const bar = (name: string, from: number, to: number, kind: string) => (
    <div className="hp-timeline__row"><span>{name}</span><span className="hp-timeline__track"><span className="hp-timeline__bar" data-kind={kind} style={{ left: `${from}%`, width: `${to - from}%` }} /></span></div>
  )
  return (
    <Screen crop trail={TRAIL} tabs={VIEWS} on={undefined}>
      <ViewBar items={[<Say key="w" k="kit.axis.weeks" />, <b key="m"><Say k="kit.axis.months" /></b>, <Say key="q" k="kit.axis.quarters" />, <Say key="y" k="kit.axis.years" />, <Say key="t" k="roadmap.today" />, <Say key="f" k="kit.axis.fit" />]} />
      <div className="hp-timeline">
        <div className="hp-timeline__today" />
        {bar('TR-0002 Bring in yard management', 10, 70, 'plan')}
        {bar('Yard Management', 45, 100, 'live')}
        {bar('Rating (legacy)', 0, 60, 'retiring')}
        {bar('Tariff Engine', 55, 100, 'live')}
      </div>
    </Screen>
  )
}

export function RegistersPicture() {
  return (
    <Screen crop trail={['Acme Logistics']} tabs={[<Say key="r" k="org.register" />]} on={0}>
      <ViewBar items={[<b key="a"><Say k="register.tabApplications" /></b>, <Say key="s" k="register.tabServices" />, <Say key="p" k="register.tabPlatforms" />]} />
      <div className="hp-table">
        <div className="hp-table__head"><span>Name</span><span><Say k="register.colMaster" /></span><span><Say k="register.colLifecycle" /></span><span><Say k="register.colFindings" /></span></div>
        {[['Billing', 'Application landscape', 'live', 1], ['Dispatch', 'Application landscape', 'live', 0], ['Rating (legacy)', 'Application landscape', 'retiring', 2]].map(([name, where, life, found]) => (
          <div key={String(name)} className="hp-table__row"><span>{name}</span><span>{where}</span><span><Say k={life === 'live' ? 'lifecycle.live' : 'lifecycle.retiring'} /></span><span>{Number(found) > 0 ? <><Mark kind="fix" /> {found}</> : ''}</span></div>
        ))}
      </div>
    </Screen>
  )
}

export function OperatingPicture() {
  const roles = ['PO', 'SM', 'Lead', 'Ops']
  const grid: [string, string[]][] = [['Order the backlog', ['A', 'C', 'I', '']], ['Plan the cycle', ['R', 'C', 'A', '']], ['Keep it running', ['I', '', 'R', 'A']]]
  return (
    <Screen crop trail={['Acme Logistics']} tabs={[<Say key="o" k="org.operating" />]} on={0}>
      <ViewBar items={[<Say key="s" k="operating.tabStructure" />, <Say key="r" k="operating.roles" />, <b key="x"><Say k="operating.tabRaci" /></b>, <Say key="e" k="operating.tabExceptions" />, <Say key="l" k="operating.tabLibraries" />]} />
      <div className="hp-raci">
        <div className="hp-raci__row hp-raci__row--head"><span />{roles.map((role) => <span key={role}>{role}</span>)}</div>
        {grid.map(([name, letters]) => <div key={name} className="hp-raci__row"><span>{name}</span>{letters.map((letter, at) => <span key={at} data-letter={letter || undefined}>{letter || '·'}</span>)}</div>)}
      </div>
    </Screen>
  )
}

export function PeoplePicture() {
  return (
    <Screen crop trail={['Acme Logistics']} tabs={[<Say key="p" k="org.people" />]} on={0}>
      <Rows rows={[
        <span key="a"><b>Anna de Vries</b> · Head in Terminal</span>,
        <span key="t"><b>Tom Berger</b> · Lead in Dock crew <Chip>+1</Chip></span>,
        <span key="l"><b>Lena Fischer</b> · Product owner in Dock crew</span>,
        <span key="p"><b>Pia Schulz</b> · <Chip tone="warn">—</Chip></span>,
      ]} />
    </Screen>
  )
}

export function GuidancePicture() {
  return (
    <Screen crop trail={TRAIL} tabs={[<Say key="g" k="frame.place.guidance" />]} on={0}>
      <ViewBar items={[<b key="p"><Say k="frame.place.principles" /></b>, <Say key="t" k="topics.title" />, <Say key="b" k="blocks.registerTitle" />]} />
      <Rows rows={['PR-0001 Buy before build', 'PR-0002 One source for every fact', 'PR-0003 Tell, do not ask']} />
    </Screen>
  )
}

export function AgentPicture() {
  return (
    <Screen crop trail={TRAIL} tabs={VIEWS} on={0}>
      <div className="hp-canvas hp-canvas--short">
        <div className="hp-cards"><Card name="Order Management" agentChanged /><Card name="Dispatch" /><Card name="Route Optimiser" agentChanged /></div>
      </div>
      <div className="hp-agentband"><Mark kind="agent" /> Claude Code · tidying Application landscape · 3 <Btn><Say k="agent.stop" /></Btn></div>
    </Screen>
  )
}
