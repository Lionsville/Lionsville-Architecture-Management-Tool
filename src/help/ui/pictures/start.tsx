// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Getting started's pictures: one small screen a step, from the same parts as
 * the chapters' and in the app's own words, with the place the step is about
 * marked by a ring (`data-mark`) so the eye finds it first. A step's picture
 * is cut to the parts its words name (`data-crop`), never to numbers: the cut
 * is taken out to whole lines of text where it stands (`HelpFigure`).
 */
import type { ComponentType } from 'react'
import { Card } from '../../../widgets/kit/Card'
import { Mark } from '../../../widgets/kit/Mark'
import '../../../widgets/kit/HelpPress.css'
import { Btn, Rows, Say, Screen, SidePanel, Tree } from './parts'

const TREE = <Tree at="Warehouse" rows={[['Acme Logistics', 0], ['Warehouse', 1], ['Shared platforms', 1], ['Topics', 1]]} />
const PLACES = [<Say key="d" k="shell.decisions" />, <Say key="o" k="shell.observations" />, <Say key="r" k="shell.roadmap" />]

/** `crop`: the home is what the step is about, and the cut is its. */
function Home({ mark, crop }: { mark?: 'views'; crop?: boolean }) {
  return (
    <div className="hp-home" data-crop={crop || undefined}>
      <div className="hp-home__title">Warehouse</div>
      <p className="hp-text">Receiving, slotting, picking and shipping.</p>
      <div data-mark={mark === 'views' || undefined}>
        <Rows title={<Say k="org.viewsHere" />} rows={[<span key="a">Application landscape</span>, <span key="b">Organisation chart</span>]} />
      </div>
      <Rows title={<Say k="org.keptHere" />} rows={[<span key="d"><Say k="shell.decisions" /> · 2</span>, <span key="o"><Say k="shell.observations" /> · 3</span>]} />
    </div>
  )
}

function WhatFor() {
  return <Screen trail={['Acme Logistics', 'Warehouse']} tree={TREE} tabs={PLACES} height="auto"><Home crop /></Screen>
}

function TheFrame() {
  return (
    <div className="hp-marked-frame">
      <Screen trail={['Acme Logistics', 'Warehouse']} tree={TREE} tabs={PLACES} height="auto">
        <div className="hp-split">
          <Home />
          <SidePanel kind="Application" name="Dispatch" rows={[[<Say key="l" k="register.colLifecycle" />, <Say key="v" k="lifecycle.live" />]]} />
        </div>
      </Screen>
      {/* Cut to the first three numbers: the panel's would take the cut wider than a step's column, and the caption names it. */}
      <span className="hp-callout" data-at="one" data-crop="">1</span>
      <span className="hp-callout" data-at="two" data-crop="">2</span>
      <span className="hp-callout" data-at="tree" data-crop="">3</span>
      <span className="hp-callout" data-at="panel">4</span>
    </div>
  )
}

function OpenAView() {
  return <Screen trail={['Acme Logistics', 'Warehouse']} tree={TREE} tabs={PLACES} height="auto"><Home mark="views" /></Screen>
}

function AddAndConnect() {
  return (
    <Screen trail={['Acme Logistics', 'Warehouse', 'Application landscape']} tabs={['Application landscape']} on={0} height="auto">
      <div className="hp-viewbar"><b data-mark="" data-crop=""><Say k="shell.add" /></b><span><Say k="bar.arrange" /></span><span><Say k="landscape.show" /></span></div>
      <div className="hp-split">
        <div className="hp-canvas" data-crop="">
          <div className="hp-cards">
            <Card name="Order Management" sub={<Say k="lifecycle.live" />} marks={<Mark kind="managed" />} />
            <Card name="Route Optimiser" sub={<Say k="lifecycle.planned" />} selected />
          </div>
          <div className="hp-line">routes · REST</div>
        </div>
        <SidePanel kind="Application" name="Route Optimiser" rows={[[<Say key="l" k="register.colLifecycle" />, <Say key="v" k="lifecycle.planned" />], [<Say key="o" k="register.colOwner" />, 'Planning team']]} />
      </div>
    </Screen>
  )
}

function RecordOne() {
  return (
    <Screen trail={['Acme Logistics', 'Warehouse']} tabs={PLACES} on={1} height="auto">
      <div className="hp-viewbar"><b><Say k="observation.stageSeen" /></b><span><Say k="observation.stageWhy" /></span><span><Say k="observation.stageSolve" /></span><span data-mark="" data-crop=""><Btn primary><Say k="observation.new" /></Btn></span></div>
      <Rows rows={[
        <span key="a" data-crop=""><b>OB-0001</b> Quoted one price, billed another</span>,
        <span key="b" data-crop=""><b>OB-0002</b> Two delivery estimates for one parcel</span>,
        <span key="c" data-crop=""><b>OB-0003</b> Handover to the carrier waits a day</span>,
      ]} />
    </Screen>
  )
}

function GoNext() {
  return (
    <div className="hp-window" style={{ height: 96, width: 376 }} data-crop="">
      <div className="kit-frame__row kit-frame__row--one hp-row">
        <span className="hp-trail"><span data-last="">Warehouse</span></span>
        <span className="kit-frame__grow" />
        <span className="hp-status"><span className="hp-dot" /> <Say k="frame.yourWork" /></span>
        <span className="hp-word" data-mark=""><span className="kit-help-press">?</span></span>
        <span className="hp-word"><Say k="frame.help" /> ▾</span>
      </div>
      <div className="hp-main hp-keys"><span className="kit-frame__kbd">F1</span> <Say k="frame.helpHere" /> · <span className="kit-frame__kbd">?</span> <Say k="frame.shortcutsTitle" /></div>
    </div>
  )
}

/** One per step of Getting started, in its order. */
export const START_PICTURES: readonly ComponentType[] = [WhatFor, TheFrame, OpenAView, AddAndConnect, RecordOne, GoNext]
