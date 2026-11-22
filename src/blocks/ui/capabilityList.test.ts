// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { capabilitiesFrom } from './capabilityList'

describe('capabilities pasted as a list', () => {
  it('reads one per line, a ! at either end a must, bullets and numbers left off, blank lines skipped', () => {
    expect(capabilitiesFrom('Routes by content\r\n! Keeps an audit trail\n\n- Signs every message!\n2) Retries   \n* ')).toEqual([
      { text: 'Routes by content', must: false },
      { text: 'Keeps an audit trail', must: true },
      { text: 'Signs every message', must: true },
      { text: 'Retries', must: false },
    ])
  })

  it('adds a line once, and none the block already has', () => {
    expect(capabilitiesFrom('Routes\nroutes\nAudits', ['  audits '])).toEqual([{ text: 'Routes', must: false }])
  })
})
