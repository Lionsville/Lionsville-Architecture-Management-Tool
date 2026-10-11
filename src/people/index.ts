// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The people register (ADR-0036): who the organisation's people are, kept
 * outside the history so a name can be forgotten. The rules are pure — what
 * an entry is, what each change does, the four signs of a duplicate and the
 * pairs answered as not the same person, what a
 * reference reads as, the policy, a list imported, what we hold — and the
 * page is React. A module that computes names the file it wants, not this.
 */
export * from './person'
export * from './pseudonym'
export * from './register'
export * from './duplicates'
export * from './distinct'
export * from './shown'
export * from './policy'
export * from './me'
export * from './leave'
export * from './csv'
export * from './hold'
export { PeoplePage } from './ui/PeoplePage'
export type { PeoplePageProps } from './ui/PeoplePage'
export type { PeopleRegisterAccess } from './ui/access'
