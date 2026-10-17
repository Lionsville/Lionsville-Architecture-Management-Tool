// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * English, for a thread of comments (ADR-0037): the thread every reader
 * mounts, what it asks once, and what a comment says about itself.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` and
 * `de.ts` beside it cannot be missing one and cannot invent one.
 */
export const EN = {
  'comments.title': 'Comments',
  'comments.count': 'Comments ({count})',
  'comments.empty': 'No comments yet. A comment is about this record and never changes it.',
  'comments.write': 'Write a comment',
  'comments.writeReply': 'Write a reply',
  'comments.send': 'Comment',
  'comments.reply': 'Reply',
  'comments.edit': 'Edit',
  'comments.save': 'Save',
  'comments.cancel': 'Cancel',
  'comments.remove': 'Remove',
  'comments.removeTip': 'Takes this comment out of the thread and leaves a mark where it stood, so the replies keep their place',
  'comments.removed': 'Comment removed',
  'comments.edited': 'edited',
  'comments.you': 'you',
  'comments.via': 'via {agent}',
  /** Before the record a comment came with, which is drawn after it as a link where it can be opened. */
  'comments.cameWith': 'Came with',
  'comments.who': 'Who is writing? Pick yourself from the register once, and the app keeps it as This is me.',
  'comments.noRegister': 'A comment is signed by a person in the register, and the register is not read here.',
  'comments.elsewhere': 'This record is kept in another scope: its comments are read and written there.',
  'comments.readOnly': 'This scope is read here and not changed, so nothing can be commented.',
  'comments.refused': 'The comment was not written.',
  'comments.notLoaded': 'Comments could not be loaded.',
} as const
