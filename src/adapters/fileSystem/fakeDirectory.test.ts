// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The double every folder suite runs on, held to the port it stands in for.
 *
 * A double that drifted from the port would make every suite built on it
 * prove the wrong thing, so it passes the same contract the real handles do.
 */
import { describeDirectoryHandle } from '../../ports/DirectoryHandle.contract'
import { FakeDirectory } from './fakeDirectory'

describeDirectoryHandle('in memory', () => new FakeDirectory())
