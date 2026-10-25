// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope offered in a picker, where it stands in the tree: indented by its
 * depth, so *Retail* under *Operations* reads as under it and two scopes of
 * one name are told apart by what they are under; and a topic under a
 * heading of its own, since a topic is not a part of the organisation.
 */
import type { HTMLAttributes, Key, ReactNode } from 'react'
import Box from '@mui/material/Box'
import ListSubheader from '@mui/material/ListSubheader'
import MenuItem from '@mui/material/MenuItem'

export type ScopeChoice = {
  path: string
  name: string
  /** How far under the top it is: the organisation 0, a scope under it 1; a topic counted from the topics' own place. */
  depth: number
  /** It is a topic, listed under the topics' heading. */
  topic?: true
}

const indent = (depth: number) => ({ pl: 2 + depth * 1.75 })

/** A picker's list's line for a scope, indented by its depth (`Autocomplete`'s `renderOption`). */
export function renderScopeOption(props: HTMLAttributes<HTMLLIElement> & { key?: Key }, choice: ScopeChoice): ReactNode {
  const { key, ...rest } = props
  return (
    <Box component="li" key={key ?? choice.path} {...rest} sx={{ ...indent(choice.depth), fontSize: 14 }} data-depth={choice.depth}>
      {choice.name}
    </Box>
  )
}

/** The topics' heading, for `Autocomplete`'s `groupBy`, where a list holds topics and scopes both. */
export function scopeGroup(choice: ScopeChoice, words: { topics: string; scopes: string }): string {
  return choice.topic ? words.topics : words.scopes
}

/**
 * A select's items for scopes: indented by depth, the topics under their
 * heading and the rest under theirs where the list holds both.
 */
export function scopeMenuItems(choices: readonly ScopeChoice[], words: { topics: string; scopes: string }): ReactNode[] {
  const both = choices.some((one) => one.topic) && choices.some((one) => !one.topic)
  const items: ReactNode[] = []
  let heading: string | undefined
  for (const one of choices) {
    const under = scopeGroup(one, words)
    if (both && under !== heading) {
      heading = under
      items.push(<ListSubheader key={`heading-${under}`} sx={{ lineHeight: '32px', fontSize: 12 }}>{under}</ListSubheader>)
    }
    items.push(<MenuItem key={one.path} value={one.path} sx={indent(one.depth)} data-depth={one.depth}>{one.name}</MenuItem>)
  }
  return items
}
