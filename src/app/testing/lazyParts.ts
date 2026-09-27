// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every part the app fetches later, fetched before a suite's first test.
 *
 * A page behind a card arrives in a script of its own (`widgets/lazyPart`),
 * and a test that clicks the card and reads the page is about the page, not
 * about when its script arrived. This setup file (`vitest.config.ts`) loads
 * every part the suite's imports made, after they were made and before the
 * first test, so each is drawn at once — as it is in a tab that has opened it
 * before. What a part does while it is on the way is `lazyPart.test.tsx`'s.
 */
import { beforeAll } from 'vitest'
import { preloadLazyParts } from '../../widgets/lazyPart'

beforeAll(async () => { await preloadLazyParts() })
