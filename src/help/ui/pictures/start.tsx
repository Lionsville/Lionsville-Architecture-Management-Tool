// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Getting started's pictures: one small screen a step, from the same parts as
 * the chapters' and in the app's own words, with the place the step is about
 * marked by a ring (`data-mark`) so the eye finds it first.
 */
import type { ComponentType } from 'react'
import { Card } from '../../../widgets/kit/Card'
import { Mark } from '../../../widgets/kit/Mark'
import '../../../widgets/kit/HelpPress.css'
import { Btn, Rows, Say, Screen, SidePanel, Tree } from './parts'

const TREE = <Tree at="Warehouse" rows={[['Acme Logistics', 0], ['Warehouse', 1], ['Shared platforms', 1], ['Topics', 1]]} />
const PLACES = [<Say key="d" k="shell.decisions" />, <Say key="o" k="shell.observations" />, <Say key="r" k="shell.roadmap" />]

function Home({ mark }: { mark?: 'views' }) {
  return (
    <div className="hp-home">
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
  return <Screen trail={['Acme Logistics', 'Warehouse']} tree={TREE} tabs={PLACES} height={230}><Home /></Screen>
}

function TheFrame() {
  return (
    <div className="hp-marked-frame">
      <Screen trail={['Acme Logistics', 'Warehouse']} tree={TREE} tabs={PLACES} height={230}>
        <div className="hp-split">
          <Home />
          <SidePanel kind="Application" name="Dispatch" rows={[[<Say key="l" k="register.colLifecycle" />, <Say key="v" k="lifecycle.live" />]]} />
        </div>
      </Screen>
      <span className="hp-callout" data-at="one">1</span>
      <span className="hp-callout" data-at="two">2</span>
      <span className="hp-callout" data-at="tree">3</span>
      <span className="hp-callout" data-at="panel">4</span>
    </div>
  )
}

function OpenAView() {
  return <Screen trail={['Acme Logistics', 'Warehouse']} tree={TREE} tabs={PLACES} height={230}><Home mark="views" /></Screen>
}

function AddAndConnect() {
  return (
    <Screen trail={['Acme Logistics', 'Warehouse', 'Application landscape']} tabs={['Application landscape']} on={0} height={230}>
      <div className="hp-viewbar"><b data-mark=""><Say k="shell.add" /></b><Say k="bar.arrange" /><Say k="landscape.show" /></div>
      <div className="hp-split">
        <div className="hp-canvas">
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
    <Screen trail={['Acme Logistics', 'Warehouse']} tabs={PLACES} on={1} height={230}>
      <div className="hp-viewbar"><b><Say k="observation.stageSeen" /></b><Say k="observation.stageWhy" /><Say k="observation.stageSolve" /><span data-mark=""><Btn primary><Say k="observation.new" /></Btn></span></div>
      <Rows rows={[
        <span key="a"><b>OB-0001</b> Quoted one price, billed another</span>,
        <span key="b"><b>OB-0002</b> Two delivery estimates for one parcel</span>,
        <span key="c"><b>OB-0003</b> Handover to the carrier waits a day</span>,
      ]} />
    </Screen>
  )
}

function GoNext() {
  return (
    <div className="hp-window" style={{ height: 120 }}>
      <div className="kit-frame__row kit-frame__row--one hp-row">
        <span className="hp-glyph">‹</span><span className="hp-glyph">›</span>
        <span className="hp-trail"><span>Acme Logistics</span><span data-last="">Warehouse</span></span>
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
